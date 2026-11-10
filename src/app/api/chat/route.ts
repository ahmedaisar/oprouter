import { NextResponse } from "next/server";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type ChatRequest = { model?: string; messages?: ChatMessage[]; temperature?: number; max_tokens?: number };

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Add OPENROUTER_API_KEY to the server environment to enable chat." }, { status: 503 });

  // Once Supabase is configured, model requests require an authenticated session.
  // Local/demo mode remains available when Supabase credentials are intentionally absent.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Sign in to use the model playground." }, { status: 401 });
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

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "OpRouter"
      },
      body: JSON.stringify({
        model: body.model, messages,
        temperature: Math.min(2, Math.max(0, body.temperature ?? 0.7)),
        max_tokens: Math.min(8192, Math.max(1, body.max_tokens ?? 1200)),
        stream: true
      }),
      signal: request.signal
    });
    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json({ error: `OpenRouter request failed (${upstream.status}).`, detail: detail.slice(0, 1200) }, { status: upstream.status });
    }
    if (!upstream.body) return NextResponse.json({ error: "The provider returned an empty response." }, { status: 502 });
    return new Response(upstream.body, { status: 200, headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }});
  } catch {
    return NextResponse.json({ error: "Unable to reach the model provider." }, { status: 502 });
  }
}
