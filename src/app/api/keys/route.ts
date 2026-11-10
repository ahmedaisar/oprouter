import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createApiKey } from "@/lib/api-keys";

export const runtime = "nodejs";
async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("api_keys")
    .select("id,name,key_prefix,model_allowlist,monthly_token_limit,created_at,last_used_at,revoked_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load API keys." }, { status: 503 });
  return NextResponse.json({ keys: data });
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: { name?: unknown; model_allowlist?: unknown; monthly_token_limit?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) return NextResponse.json({ error: "Name must contain 1–80 characters." }, { status: 400 });
  let models: string[] | null = null;
  if (body.model_allowlist !== undefined && body.model_allowlist !== null) {
    if (!Array.isArray(body.model_allowlist) || body.model_allowlist.length > 100 || body.model_allowlist.some((m) => typeof m !== "string" || !m.trim() || m.length > 180))
      return NextResponse.json({ error: "model_allowlist must be an array of up to 100 model IDs." }, { status: 400 });
    models = [...new Set(body.model_allowlist as string[])];
  }
  let monthlyLimit: number | null = null;
  if (body.monthly_token_limit !== undefined && body.monthly_token_limit !== null && body.monthly_token_limit !== "") {
    monthlyLimit = Number(body.monthly_token_limit);
    if (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1) return NextResponse.json({ error: "monthly_token_limit must be a positive integer." }, { status: 400 });
  }
  const generated = createApiKey();
  const admin = createAdminClient();
  const { data, error } = await admin.from("api_keys").insert({
    user_id: user.id, name, key_prefix: generated.prefix, key_hash: generated.hash,
    model_allowlist: models, monthly_token_limit: monthlyLimit
  }).select("id,name,key_prefix,model_allowlist,monthly_token_limit,created_at").single();
  if (error || !data) return NextResponse.json({ error: "Unable to create API key." }, { status: 503 });
  return NextResponse.json({ key: data, secret: generated.value }, { status: 201 });
}
export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Provide a key id." }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("revoked_at", null);
  if (error) return NextResponse.json({ error: "Unable to revoke API key." }, { status: 503 });
  return NextResponse.json({ revoked: true });
}
