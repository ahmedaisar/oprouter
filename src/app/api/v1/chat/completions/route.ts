import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimatePromptTokens, getMonthlyTokenLimit } from "@/lib/usage-quota";
import { createRateLimitHeaders, getGatewayRateLimit } from "@/lib/gateway-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
type Message = { role: "system" | "user" | "assistant" | "tool"; content: string };
type Body = { model?: string; messages?: Message[]; temperature?: number; max_tokens?: number; stream?: boolean };
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
function error(message: string, status: number) {
  return NextResponse.json({ error: { message, type: status === 401 ? "authentication_error" : "invalid_request_error", code: status } }, { status });
}
export async function POST(request: Request) {
  const apiKey = await authenticateApiKey(request).catch(() => null);
  if (!apiKey) return error("Invalid or revoked API key.", 401);

  let rateLimit: number;
  try { rateLimit = getGatewayRateLimit(); }
  catch { return error("Gateway rate limit configuration is invalid.", 503); }
  const admin = createAdminClient();
  const { data: rateData, error: rateError } = await admin.rpc("consume_gateway_rate_limit", {
    p_api_key_id: apiKey.id,
    p_limit: rateLimit,
    p_window_seconds: 60
  });
  const rate = Array.isArray(rateData) ? rateData[0] : null;
  if (rateError || !rate) return error("Unable to verify API key rate limit.", 503);
  const resetAt = new Date(rate.reset_at);
  const rateHeaders = createRateLimitHeaders(rateLimit, rate.remaining, resetAt);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { message: "API key request rate limit exceeded.", type: "rate_limit_error", code: 429 } },
      { status: 429, headers: { ...rateHeaders, "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))) } }
    );
  }

  const providerKey = process.env.OPENROUTER_API_KEY;
  if (!providerKey) return error("Gateway provider is not configured.", 503);
  let body: Body;
  try { body = await request.json() as Body; } catch { return error("Request body must be valid JSON.", 400); }
  if (typeof body.model !== "string" || !body.model || body.model.length > 180) return error("A valid model is required.", 400);
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 40) return error("Provide between 1 and 40 messages.", 400);
  if (body.messages.some((m) => !m || !["system","user","assistant","tool"].includes(m.role) || typeof m.content !== "string" || m.content.length > 20000))
    return error("One or more messages are invalid.", 400);
  if (apiKey.model_allowlist && !apiKey.model_allowlist.includes(body.model)) return error("This API key is not permitted to use the requested model.", 403);
  if (body.temperature !== undefined && (typeof body.temperature !== "number" || !Number.isFinite(body.temperature))) return error("temperature must be finite.", 400);
  if (body.max_tokens !== undefined && (typeof body.max_tokens !== "number" || !Number.isFinite(body.max_tokens) || body.max_tokens < 1)) return error("max_tokens must be a positive number.", 400);
  const maxTokens = Math.min(8192, Math.trunc(body.max_tokens ?? 1200));
  const messages = body.messages;
  let workspaceLimit: number | null;
  try { workspaceLimit = getMonthlyTokenLimit(); }
  catch { return error("Workspace quota configuration is invalid.", 503); }
  let reservationId: string | null = null;
  if (workspaceLimit !== null || apiKey.monthly_token_limit !== null) {
    const { data, error: reserveError } = await admin.rpc("reserve_gateway_quota", {
      p_user_id: apiKey.user_id, p_api_key_id: apiKey.id,
      p_reserved_tokens: estimatePromptTokens(messages) + maxTokens,
      p_workspace_limit: workspaceLimit, p_key_limit: apiKey.monthly_token_limit
    });
    const quota = Array.isArray(data) ? data[0] : null;
    if (reserveError || !quota?.allowed || !quota.reservation_id) return error(reserveError ? "Unable to verify token quota." : "Monthly token quota exceeded.", reserveError ? 503 : 429);
    reservationId = quota.reservation_id;
  }
  const timeoutMs = 120_000;
  const upstreamSignal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]);
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: upstreamSignal,
      headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "X-Title": "OpRouter Gateway" },
      body: JSON.stringify({ ...body, max_tokens: maxTokens, stream: body.stream !== false, ...(body.stream === false ? {} : { stream_options: { include_usage: true } }) })
    });
    if (!upstream.ok || !upstream.body) {
      if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
      const detail = await upstream.text();
      return error(`Provider request failed (${upstream.status}). ${detail.slice(0, 800)}`, upstream.ok ? 502 : upstream.status);
    }
    if (body.stream === false) {
      const raw = await new Response(upstream.body).text();
      let parsed: { usage?: Usage };
      try { parsed = JSON.parse(raw); } catch {
        if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
        return error("Provider returned an invalid response.", 502);
      }
      const usage = parsed.usage ?? {};
      await persist(admin, apiKey.user_id, apiKey.id, body.model, usage, reservationId);
      return NextResponse.json(parsed, { headers: rateHeaders });
    }
    const usage: Usage = {};
    const decoder = new TextDecoder();
    let pending = "";
    let finalized = false;
    const finalize = async () => {
      if (finalized) return;
      finalized = true;
      pending += decoder.decode();
      if (pending) readUsage(pending, usage);
      await persist(admin, apiKey.user_id, apiKey.id, body.model!, usage, reservationId);
    };
    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            await finalize();
            controller.close();
            return;
          }
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? "";
          for (const line of lines) readUsage(line, usage);
          controller.enqueue(value);
        } catch (cause) {
          if (!finalized) {
            finalized = true;
            if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
          }
          if (cause instanceof Error && cause.name === "TimeoutError") {
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ error: { message: "Model provider request timed out.", type: "timeout_error", code: 504 } })}\\n\\ndata: [DONE]\\n\\n`
            ));
            controller.close();
            return;
          }
          controller.error(cause);
        }
      },
      async cancel(reason) {
        try { await reader.cancel(reason); } finally {
          if (!finalized) {
            finalized = true;
            if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
          }
        }
      }
    });
    return new Response(stream, { headers: { ...rateHeaders, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  } catch (cause) {
    if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
    if (cause instanceof Error && cause.name === "TimeoutError") return error("Model provider request timed out.", 504);
    return error("Unable to reach the model provider.", 502);
  }
}
function readUsage(line: string, usage: Usage) {
  if (!line.startsWith("data:")) return;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return;
  try { const event = JSON.parse(payload) as { usage?: Usage }; if (event.usage) Object.assign(usage, event.usage); } catch { /* Preserve provider frames unchanged. */ }
}
async function persist(admin: ReturnType<typeof createAdminClient>, userId: string, apiKeyId: string, model: string, usage: Usage, reservationId: string | null) {
  const hasUsage = [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].some((v) => typeof v === "number" && Number.isFinite(v));
  if (!hasUsage) {
    if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: userId, p_reservation_id: reservationId });
    return;
  }
  const prompt = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
  const completion = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
  const total = Math.max(0, Math.trunc(usage.total_tokens ?? prompt + completion));
  const cost = typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : 0;
  const { error: insertError } = await admin.from("usage_events").insert({ user_id: userId, api_key_id: apiKeyId, model, status: "completed", prompt_tokens: prompt, completion_tokens: completion, total_tokens: total, estimated_cost: cost });
  if (!insertError && reservationId) await admin.rpc("release_usage_reservation", { p_user_id: userId, p_reservation_id: reservationId });
}
