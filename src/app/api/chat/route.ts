import { NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { estimatePromptTokens, getMonthlyTokenLimit } from "@/lib/usage-quota";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatRequest = { model?: string; messages?: ChatMessage[]; temperature?: number; max_tokens?: number };
type ProviderUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
type QuotaReservation = {
  allowed: boolean;
  used_tokens: number;
  reserved_tokens: number;
  monthly_limit: number;
  resets_at: string;
  reservation_id: string | null;
};

function readUsageLine(line: string, usage: ProviderUsage) {
  if (!line.startsWith("data:")) return;
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return;
  try {
    const event = JSON.parse(payload) as { usage?: ProviderUsage };
    if (event.usage) Object.assign(usage, event.usage);
  } catch {
    // Ignore non-JSON SSE frames while forwarding the original bytes unchanged.
  }
}

async function releaseUsageReservation(userId: string, reservationId: string | null) {
  if (!reservationId) return;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { error } = await admin.rpc("release_usage_reservation", {
      p_user_id: userId,
      p_reservation_id: reservationId
    });
    if (error) console.error("Unable to release usage reservation:", error.message);
  } catch (error) {
    console.error("Usage reservation cleanup failed:", error);
  }
}

async function persistUsage(userId: string, model: string, usage: ProviderUsage, reservationId: string | null) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const hasReportedUsage = [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens]
    .some((value) => typeof value === "number" && Number.isFinite(value));
  if (!hasReportedUsage) {
    // Keep the reservation until its expiry rather than silently granting free usage
    // when the provider omits its final usage frame.
    console.error("OpenRouter stream ended without usage metadata; retaining quota reservation.");
    return;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const promptTokens = Math.max(0, Math.trunc(usage.prompt_tokens ?? 0));
    const completionTokens = Math.max(0, Math.trunc(usage.completion_tokens ?? 0));
    const totalTokens = Math.max(0, Math.trunc(usage.total_tokens ?? promptTokens + completionTokens));
    const cost = typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : 0;
    const { error } = await admin.from("usage_events").insert({
      user_id: userId, model, status: "completed",
      prompt_tokens: promptTokens, completion_tokens: completionTokens,
      total_tokens: totalTokens, estimated_cost: cost
    });
    if (error) {
      console.error("Unable to persist usage event:", error.message);
      return;
    }
    await releaseUsageReservation(userId, reservationId);
  } catch (error) {
    console.error("Usage ingestion failed:", error);
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Add OPENROUTER_API_KEY to the server environment to enable chat." }, { status: 503 });

  let userId: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in to use the model playground." }, { status: 401 });
    userId = user.id;
  }

  let body: ChatRequest;
  try { body = await request.json() as ChatRequest; }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body.model || typeof body.model !== "string" || body.model.length > 180)
    return NextResponse.json({ error: "Choose a valid model." }, { status: 400 });
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40)
    return NextResponse.json({ error: "Provide between 1 and 40 messages." }, { status: 400 });

  const messages = body.messages.filter((m): m is ChatMessage =>
    !!m && ["system", "user", "assistant"].includes(m.role) &&
    typeof m.content === "string" && m.content.length <= 20000
  );
  if (messages.length !== body.messages.length)
    return NextResponse.json({ error: "One or more messages are invalid." }, { status: 400 });

  const maxTokens = Math.min(8192, Math.max(1, body.max_tokens ?? 1200));
  let monthlyLimit: number | null;
  try {
    monthlyLimit = getMonthlyTokenLimit();
  } catch (error) {
    console.error("Invalid monthly quota configuration:", error);
    return NextResponse.json({ error: "Monthly quota configuration is invalid." }, { status: 503 });
  }

  let reservationId: string | null = null;
  if (userId && monthlyLimit) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Monthly quota enforcement requires server-side usage storage to be configured." }, { status: 503 });
    }

    const reservedTokens = estimatePromptTokens(messages) + maxTokens;
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("reserve_usage_quota", {
        p_user_id: userId,
        p_reserved_tokens: reservedTokens,
        p_monthly_token_limit: monthlyLimit
      });
      if (error) {
        console.error("Unable to check monthly quota:", error.message);
        return NextResponse.json({ error: "Unable to verify your monthly quota. Please try again." }, { status: 503 });
      }

      const rows = data as QuotaReservation[] | null;
      const quota = Array.isArray(rows) ? rows[0] : undefined;
      if (!quota) {
        return NextResponse.json({ error: "Monthly quota verification returned an invalid response." }, { status: 503 });
      }
      if (!quota.allowed) {
        return NextResponse.json({
          error: "This request would exceed your monthly token limit.",
          quota: {
            usedTokens: quota.used_tokens,
            reservedTokens: quota.reserved_tokens,
            monthlyLimit: quota.monthly_limit,
            resetsAt: quota.resets_at,
            requestedTokens: reservedTokens
          }
        }, { status: 429 });
      }
      reservationId = quota.reservation_id;
      if (!reservationId) {
        return NextResponse.json({ error: "Unable to reserve monthly quota for this request." }, { status: 503 });
      }
    } catch (error) {
      console.error("Monthly quota check failed:", error);
      return NextResponse.json({ error: "Unable to verify your monthly quota. Please try again." }, { status: 503 });
    }
  }

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "OpRouter"
      },
      body: JSON.stringify({
        model: body.model, messages,
        temperature: Math.min(2, Math.max(0, body.temperature ?? 0.7)),
        max_tokens: maxTokens,
        stream: true, stream_options: { include_usage: true }
      }),
      signal: request.signal
    });
    if (!upstream.ok) {
      await releaseUsageReservation(userId ?? "", reservationId);
      const detail = await upstream.text();
      return NextResponse.json({ error: `OpenRouter request failed (${upstream.status}).`, detail: detail.slice(0, 1200) }, { status: upstream.status });
    }
    if (!upstream.body) {
      await releaseUsageReservation(userId ?? "", reservationId);
      return NextResponse.json({ error: "The provider returned an empty response." }, { status: 502 });
    }

    // Local/demo sessions and deployments without the service-role key keep streaming,
    // but persistent metering and configured quotas require trusted server-side storage.
    if (!userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(upstream.body, { status: 200, headers: {
        "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive", "X-Accel-Buffering": "no"
      }});
    }

    const usage: ProviderUsage = {};
    const decoder = new TextDecoder();
    let pending = "";
    const meter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) readUsageLine(line, usage);
        controller.enqueue(chunk);
      },
      async flush() {
        pending += decoder.decode();
        if (pending) readUsageLine(pending, usage);
        await persistUsage(userId!, body.model!, usage, reservationId);
      }
    });

    return new Response(upstream.body.pipeThrough(meter), { status: 200, headers: {
      "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive", "X-Accel-Buffering": "no"
    }});
  } catch (error) {
    await releaseUsageReservation(userId ?? "", reservationId);
    console.error("Chat request failed:", error);
    return NextResponse.json({ error: "Unable to reach the model provider." }, { status: 502 });
  }
}
