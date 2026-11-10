export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthlyTokenLimit } from "@/lib/usage-quota";

type UsageEvent = {
  id: string;
  model: string;
  status: string;
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
};
type QuotaSnapshot = {
  used_tokens: number;
  reserved_tokens: number;
  monthly_limit: number;
  resets_at: string;
};

const numberFormat = new Intl.NumberFormat("en-US");

export default async function ActivityPage() {
  const supabase = await createClient();
  const [{ data: events, error }, { data: { user } }] = await Promise.all([
    supabase.from("usage_events")
      .select("id,model,status,total_tokens,estimated_cost,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.auth.getUser()
  ]);

  let quota: QuotaSnapshot | null = null;
  let quotaConfigured = false;
  let quotaUnavailable = false;

  try {
    const monthlyLimit = getMonthlyTokenLimit();
    quotaConfigured = monthlyLimit !== null;
    if (monthlyLimit && user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient();
      const { data, error: quotaError } = await admin.rpc("get_usage_quota", {
        p_user_id: user.id,
        p_monthly_token_limit: monthlyLimit
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (quotaError || !row) {
        quotaUnavailable = true;
      } else {
        quota = row as QuotaSnapshot;
      }
    } else if (monthlyLimit) {
      quotaUnavailable = true;
    }
  } catch {
    quotaUnavailable = true;
  }

  const used = Number(quota?.used_tokens ?? 0);
  const reserved = Number(quota?.reserved_tokens ?? 0);
  const committed = used + reserved;
  const percentage = quota ? Math.min(100, (committed / quota.monthly_limit) * 100) : 0;

  return (
    <main className="dashboard">
      <p className="eyebrow">REQUEST HISTORY</p>
      <h1>Your <span>activity.</span></h1>
      <p className="intro">Usage events associated with your account. Records are protected by Supabase row-level security.</p>

      <section className="callout" style={{ marginTop: 36, display: "block" }} aria-live="polite">
        <p className="eyebrow">MONTHLY TOKEN ALLOWANCE</p>
        {quota ? (
          <>
            <h2>{numberFormat.format(used)} <span>/ {numberFormat.format(quota.monthly_limit)} tokens</span></h2>
            <p>{numberFormat.format(reserved)} tokens are reserved for requests currently in progress.</p>
            <progress aria-label="Monthly token allowance used or reserved" value={committed} max={quota.monthly_limit} style={{ width: "100%", marginTop: 12 }} />
            <p style={{ color: "#91a0b4", fontSize: 13 }}>Resets {new Date(quota.resets_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.</p>
          </>
        ) : quotaUnavailable ? (
          <p role="status">Quota status is unavailable. Confirm the quota migration and server-side service-role configuration.</p>
        ) : quotaConfigured ? (
          <p>Monthly quota is configured but usage data is not available yet.</p>
        ) : (
          <p>No monthly token limit is configured for this workspace.</p>
        )}
      </section>

      <section className="callout" style={{ marginTop: 20, display: "block" }}>
        {error ? (
          <p role="status">Usage history is not available yet. Apply the Supabase migrations and confirm your project configuration.</p>
        ) : !events?.length ? (
          <>
            <h2>No usage recorded yet.</h2>
            <p>Usage events will appear here once server-side usage ingestion is enabled.</p>
            <Link href="/playground">Open the playground →</Link>
          </>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Date", "Model", "Status", "Tokens", "Est. cost"].map((label) => <th key={label} style={{ textAlign: "left", padding: 12, color: "#91a0b4" }}>{label}</th>)}</tr></thead>
              <tbody>
                {events.map((item: UsageEvent) => (
                  <tr key={item.id}>
                    <td style={{ padding: 12 }}>{new Date(item.created_at).toLocaleString()}</td>
                    <td style={{ padding: 12 }}>{item.model}</td>
                    <td style={{ padding: 12 }}>{item.status}</td>
                    <td style={{ padding: 12 }}>{numberFormat.format(item.total_tokens)}</td>
                    <td style={{ padding: 12 }}>{"$" + Number(item.estimated_cost).toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
