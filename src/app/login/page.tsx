"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./auth.css";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(destination);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(destination) }
        });
        if (error) throw error;
        setMessage(data.session ? "Account created. You can now continue." : "Check your email to confirm your account, then sign in.");
        if (data.session) window.location.assign(destination);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed."); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><Link href="/" className="auth-brand">◈ OP<span>ROUTER</span></Link><section className="auth-card"><p className="eyebrow">YOUR AI WORKSPACE</p><h1>{mode === "signin" ? "Welcome back." : "Create your account."}</h1><p className="auth-copy">Sign in to access your private model workspace and usage history.</p><form onSubmit={submit}><label htmlFor="email">EMAIL</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><label htmlFor="password">PASSWORD</label><input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/><button disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in →" : "Create account →"}</button></form>{message&&<p className="auth-message" role="status">{message}</p>}{params.get("error")&&<p className="auth-message" role="alert">Your sign-in link could not be verified. Please try again.</p>}<p className="auth-switch">{mode === "signin" ? "New to OpRouter?" : "Already have an account?"} <button type="button" onClick={()=>{setMode(mode === "signin" ? "signup" : "signin");setMessage("");}}>{mode === "signin" ? "Create account" : "Sign in"}</button></p></section></main>;
}
