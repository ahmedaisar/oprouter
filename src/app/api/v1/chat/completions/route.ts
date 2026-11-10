import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimatePromptTokens, getMonthlyTokenLimit } from "@/lib/usage-quota";

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
  const configuredLimit = getMonthlyTokenLimit();
  const limits = [configuredLimit, apiKey.monthly_token_limit].filter((v): v is number => v !== null);
  const monthlyLimit = limits.length ? Math.min(...limits) : null;
  let reservationId: string | null = null;
  if (monthlyLimit) {
    const admin = createAdminClient();
    const { data, error: reserveError } = await admin.rpc("reserve_usage_quota", {
      p_user_id: apiKey.user_id, p_reserved_tokens: estimatePromptTokens(messages) + maxTokens,
      p_monthly_token_limit: monthlyLimit
    });
    const quota = Array.isArray(data) ? data[0] : null;
    if (reserveError || !quota?.allowed || !quota.reservation_id) return error(reserveError ? "Unable to verify token quota." : "Monthly token quota exceeded.", reserveError ? 503 : 429);
    reservationId = quota.reservation_id;
  }
  const admin = createAdminClient();
  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: request.signal,
      headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "X-Title": "OpRouter Gateway" },
      body: JSON.stringify({ ...body, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } })
    });
    if (!upstream.ok || !upstream.body) {
      if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
      const detail = await upstream.text();
      return error(`Provider request failed (${upstream.status}). ${detail.slice(0, 800)}`, upstream.ok ? 502 : upstream.status);
    }
    if (body.stream === false) {
      const raw = await new Response(upstream.body).text();
      let parsed: { usage?: Usage };
      try { parsed = JSON.parse(raw); } catch { return error("Provider returned an invalid response.", 502); }
      const usage = parsed.usage ?? {};
      await persist(admin, apiKey.user_id, apiKey.id, body.model, usage, reservationId);
      return NextResponse.json(parsed);
    }
    const usage: Usage = {};
    const decoder = new TextDecoder();
    let pending = "";
    const stream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split(/\r?\n/); pending = lines.pop() ?? "";
        for (const line of lines) readUsage(line, usage);
        controller.enqueue(chunk);
      },
      async flush() {
        pending += decoder.decode(); if (pending) readUsage(pending, usage);
        await persist(admin, apiKey.user_id, apiKey.id, body.model!, usage, reservationId);
      }
    });
    return new Response(upstream.body.pipeThrough(stream), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
  } catch {
    if (reservationId) await admin.rpc("release_usage_reservation", { p_user_id: apiKey.user_id, p_reservation_id: reservationId });
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
  if (!hasUsage) return; // Reservation expires after two hours if the provider omits usage.
  const prompt = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
  const completion = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
  const total = Math.max(0, Math.trunc(usage.total_tokens ?? prompt + completion));
  const cost = typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : 0;
  const { error: insertError } = await admin.from("usage_events").insert({ user_id: userId, api_key_id: apiKeyId, model, status: "completed", prompt_tokens: prompt, completion_tokens: completion, total_tokens: total, estimated_cost: cost });
  if (!insertError && reservationId) await admin.rpc("release_usage_reservation", { p_user_id: userId, p_reservation_id: reservationId });
}
