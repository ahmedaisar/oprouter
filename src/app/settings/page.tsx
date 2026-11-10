export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApiKeyManager } from "@/components/api-key-manager";
export default async function SettingsPage() {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 return <main className="dashboard"><p className="eyebrow">WORKSPACE SETTINGS</p><h1>Your <span>account.</span></h1><p className="intro">Manage your account and developer access to the OpRouter gateway.</p><section className="callout" style={{marginTop:36}}><div><p className="eyebrow">SIGNED IN AS</p><h2>{user?.email ?? "Authenticated user"}</h2><p>Your model requests are associated with this account.</p></div><form action="/auth/signout" method="post"><button className="auth-signout" type="submit">Sign out</button></form></section><ApiKeyManager/><p style={{marginTop:28,color:"#91a0b4",fontSize:13}}><Link href="/activity">View your usage history →</Link></p></main>;
}
