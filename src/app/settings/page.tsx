import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="dashboard">
      <p className="eyebrow">WORKSPACE</p>
      <h1>Workspace <span>settings.</span></h1>
      <p className="intro">Configure the OpenRouter connection through your server environment. Keep provider credentials out of client-side variables.</p>
      <section className="callout">
        <div>
          <p className="eyebrow">SERVER CONFIGURATION</p>
          <h2>OPENROUTER_API_KEY</h2>
          <p>Set this variable in your local .env.local file or deployment environment. Never expose it with a NEXT_PUBLIC_ prefix.</p>
        </div>
        <Link href="/models">Browse models ↗</Link>
      </section>
    </main>
  );
}
