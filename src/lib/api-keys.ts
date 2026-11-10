import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const KEY_PREFIX = "opk_live_";
export type AuthenticatedApiKey = { id: string; user_id: string; model_allowlist: string[] | null; monthly_token_limit: number | null };

export function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createApiKey() {
  const secret = randomBytes(32).toString("base64url");
  const value = KEY_PREFIX + secret;
  return { value, prefix: value.slice(0, 17), hash: hashApiKey(value) };
}

export async function authenticateApiKey(request: Request): Promise<AuthenticatedApiKey | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer (opk_live_[A-Za-z0-9_-]{40,})$/.exec(authorization);
  if (!match) return null;
  const value = match[1];
  const prefix = value.slice(0, 17);
  const admin = createAdminClient();
  const { data, error } = await admin.from("api_keys")
    .select("id,user_id,key_hash,model_allowlist,monthly_token_limit")
    .eq("key_prefix", prefix).is("revoked_at", null).maybeSingle();
  if (error || !data) return null;
  const actual = Buffer.from(hashApiKey(value), "hex");
  const expected = Buffer.from(data.key_hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id, user_id: data.user_id, model_allowlist: data.model_allowlist, monthly_token_limit: data.monthly_token_limit };
}
