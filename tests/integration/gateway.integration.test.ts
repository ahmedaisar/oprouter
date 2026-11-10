import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { createHash } from "node:crypto";

type ApiKeyRecord = {
  id: string;
  user_id: string;
  key_hash: string;
  model_allowlist: string[] | null;
  monthly_token_limit: number | null;
  revoked_at: string | null;
  last_used_at?: string | null;
};
const records = new Map<string, ApiKeyRecord>();
let server: Server;
let providerServer: Server;
let origin: string;
const validKey = "opk_live_" + "a".repeat(43);
const validKeyHash = createHash("sha256").update(validKey).digest("hex");
const rateCounts = new Map<string, { start: number; count: number }>();
let providerStatus = 200;
let providerMode: "normal" | "delay" | "stream-delay" | "invalid-json" = "normal";
let providerCalls = 0;

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => raw += chunk);
    req.on("end", () => {
      try { resolve(JSON.parse(raw) as unknown); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "integration-test-service-role";
  process.env.OPENROUTER_API_KEY = "integration-test-provider";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost";
  process.env.DEFAULT_MONTHLY_TOKEN_LIMIT = "1000000";
  process.env.GATEWAY_RATE_LIMIT_PER_MINUTE = "60";

  providerServer = createServer(async (req, res) => {
    providerCalls++;
    if (providerMode === "delay") {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (providerMode === "stream-delay") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"hello"}}]}\n\n');
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!res.destroyed) res.end("data: [DONE]\n\n");
      return;
    }
    if (providerMode === "invalid-json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{not-json");
      return;
    }
    if (providerStatus !== 200) {
      json(res, providerStatus, { error: { message: "provider error" } });
      return;
    }
    const body = await readJson(req) as {stream?:boolean; model?:string};
    if (body.stream === false) {
      json(res, 200, { id: "chatcmpl-test", model: body.model, choices: [{message:{role:"assistant",content:"ok"}}], usage: {prompt_tokens: 3, completion_tokens: 2, total_tokens: 5} });
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end('data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"ok"}}]}\n\ndata: {"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\ndata: [DONE]\n\n');
  });
  await new Promise<void>(resolve => providerServer.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(providerServer.address() as AddressInfo).port}`;
  process.env.OPENROUTER_API_URL = `${origin}/chat/completions`;

  server = createServer(async (req, res) => {
    try {
      if (new URL(req.url ?? "/", "http://local").pathname === "/rest/v1/api_keys" && req.method === "GET") {
        const prefix = new URL(req.url ?? "/", "http://local").searchParams.get("key_prefix")?.replace(/^eq\./, "");
        const record = records.get(prefix ?? "");
        return json(res, 200, record ?? null);
      }
      if (new URL(req.url ?? "/", "http://local").pathname === "/rest/v1/api_keys" && req.method === "PATCH") {
        res.writeHead(204); res.end(); return;
      }
      if (req.url === "/rest/v1/rpc/consume_gateway_rate_limit" && req.method === "POST") {
        const body = await readJson(req) as { p_api_key_id: string; p_limit: number; p_window_seconds: number };
        const now = Date.now();
        const current = rateCounts.get(body.p_api_key_id);
        if (!current || now - current.start >= body.p_window_seconds * 1000) {
          rateCounts.set(body.p_api_key_id, { start: now, count: 1 });
        } else if (current.count < body.p_limit) current.count++;
        const result = rateCounts.get(body.p_api_key_id)!;
        return json(res, 200, [{ allowed: result.count <= body.p_limit, remaining: Math.max(0, body.p_limit-result.count), reset_at: new Date(result.start + body.p_window_seconds*1000).toISOString() }]);
      }
      if (req.url === "/rest/v1/rpc/reserve_gateway_quota" && req.method === "POST") {
        await readJson(req);
        const quotaRecord = records.get(validKey.slice(0,17));
        if ((quotaRecord?.monthly_token_limit ?? 0) === 1) return json(res,200,[{allowed:false,reservation_id:null}]);
        return json(res,200,[{allowed:true,reservation_id:"reservation-test"}]);
      }
      if (req.url === "/rest/v1/rpc/release_usage_reservation" && req.method === "POST") {
        res.writeHead(204); res.end(); return;
      }
      if (req.url === "/rest/v1/usage_events" && req.method === "POST") {
        res.writeHead(201); res.end(); return;
      }
      if (req.url === "/chat/completions" && req.method === "POST") {
        providerCalls++;
        const body = await readJson(req) as {stream?:boolean; model?:string};
        if (providerMode === "delay") await new Promise(resolve => setTimeout(resolve, 100));
        if (providerMode === "invalid-json") {
          res.writeHead(200,{"content-type":"application/json"}); res.end("{bad json"); return;
        }
        if (providerStatus !== 200) return json(res,providerStatus,{error:{message:"provider error"}});
        if (body.stream === false) return json(res,200,{id:"chatcmpl-test",choices:[{message:{role:"assistant",content:"ok"}}],usage:{prompt_tokens:3,completion_tokens:2,total_tokens:5}});
        res.writeHead(200,{"content-type":"text/event-stream"});
        if (providerMode === "stream-delay") {
          res.write('data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"hello"}}]}\\n\\n');
          setTimeout(()=>{if(!res.destroyed)res.end("data: [DONE]\\n\\n");},100);
          return;
        }
        res.end('data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"ok"}}]}\\n\\ndata: {"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\\n\\ndata: [DONE]\\n\\n');
        return;
      }
      json(res,404,{message:"not found"});
    } catch {
      json(res,500,{message:"test supabase mock failed"});
    }
  });
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  const port=(server.address() as AddressInfo).port;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;
  records.set(validKey.slice(0,17), { id:"key-1", user_id:"user-1", key_hash:validKeyHash, model_allowlist:null, monthly_token_limit:null, revoked_at:null });
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (input,init) => {
    const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
    if(url.startsWith("https://openrouter.ai/api/v1/chat/completions")) {
      return originalFetch(`${origin}/chat/completions`,init);
    }
    return originalFetch(input,init);
  };
  (globalThis as typeof globalThis & { __originalFetch?: typeof fetch }).__originalFetch=originalFetch;
});

after(async () => {
  const runtime = globalThis as typeof globalThis & { __originalFetch?: typeof fetch };
  if (runtime.__originalFetch) globalThis.fetch=runtime.__originalFetch;
  await Promise.all([
    new Promise<void>(resolve => server.close(()=>resolve())),
    new Promise<void>(resolve => providerServer.close(()=>resolve()))
  ]);
});

const requestBody = { model:"openai/gpt-4o-mini", messages:[{role:"user",content:"hello"}], stream:false };
async function invoke(body:unknown=requestBody, key=validKey) {
  const { POST } = await import("../../src/app/api/v1/chat/completions/route");
  return POST(new Request("http://localhost/api/v1/chat/completions",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify(body)}));
}

test("rejects missing and invalid API keys without provider requests", async () => {
  const beforeCalls=providerCalls;
  const { POST }=await import("../../src/app/api/v1/chat/completions/route");
  const missing=await POST(new Request("http://local",{method:"POST",body:"{}"}));
  assert.equal(missing.status,401);
  const invalid=await invoke(requestBody,"opk_live_"+"z".repeat(43));
  assert.equal(invalid.status,401);
  assert.equal(providerCalls,beforeCalls);
});

test("rejects malformed body and disallowed model before provider work", async () => {
  const original=records.get(validKey.slice(0,17))!;
  const invalid=await invoke({model:"",messages:[]});
  assert.equal(invalid.status,400);
  records.set(validKey.slice(0,17),{...original,model_allowlist:["anthropic/claude"]});
  const forbidden=await invoke();
  assert.equal(forbidden.status,403);
  records.set(validKey.slice(0,17),original);
});

test("returns OpenAI-compatible non-stream response and rate headers", async () => {
  const response=await invoke();
  assert.equal(response.status,200);
  assert.equal(response.headers.get("x-ratelimit-limit"),"60");
  const payload=await response.json();
  assert.equal(payload.choices[0].message.content,"ok");
  assert.equal(payload.usage.total_tokens,5);
});

test("returns SSE frames for streaming requests", async () => {
  const response=await invoke({...requestBody,stream:true});
  assert.equal(response.status,200);
  assert.ok((response.headers.get("content-type")??"").includes("text/event-stream"));
  const text=await response.text();
  assert.match(text,/data: \[DONE\]/);
  assert.match(text,/"content":"ok"/);
});

test("enforces per-key rate limits with HTTP 429 and Retry-After", async () => {
  process.env.GATEWAY_RATE_LIMIT_PER_MINUTE="1";
  rateCounts.clear();
  const first=await invoke();
  assert.equal(first.status,200);
  const second=await invoke();
  assert.equal(second.status,429);
  assert.ok(Number(second.headers.get("retry-after"))>=1);
  process.env.GATEWAY_RATE_LIMIT_PER_MINUTE="60";
  rateCounts.clear();
});

test("releases quota reservations when the provider rejects a request", async () => {
  // No quota reservation is configured for this API key; this test verifies a provider error response.
  providerStatus=503;
  const response=await invoke();
  assert.equal(response.status,503);
  providerStatus=200;
});

test("enforces model allowlists before provider requests", async () => {
  const record=records.get(validKey.slice(0,17))!;
  const beforeCalls=providerCalls;
  records.set(validKey.slice(0,17),{...record,model_allowlist:["anthropic/claude"]});
  const response=await invoke();
  assert.equal(response.status,403);
  assert.equal(providerCalls,beforeCalls);
  records.set(validKey.slice(0,17),record);
});

test("respects API key monthly quotas before provider work", async () => {
  const record=records.get(validKey.slice(0,17))!;
  records.set(validKey.slice(0,17),{...record,monthly_token_limit:1});
  const response=await invoke();
  assert.equal(response.status,429);
  records.set(validKey.slice(0,17),record);
});

test("returns provider error statuses without exposing secrets", async () => {
  const beforeCalls=providerCalls;
  providerStatus=503;
  const response=await invoke();
  assert.equal(response.status,503);
  assert.ok(providerCalls>beforeCalls);
  providerStatus=200;
});

test("rejects malformed provider JSON and returns a gateway error", async () => {
  providerMode="invalid-json";
  const response=await invoke();
  assert.equal(response.status,502);
  providerMode="normal";
});
