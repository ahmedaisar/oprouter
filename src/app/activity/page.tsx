import Link from "next/link";

export default function ActivityPage() {
  return (
    <main className="dashboard">
      <p className="eyebrow">WORKSPACE</p>
      <h1>Request <span>activity.</span></h1>
      <p className="intro">Your recent model requests and usage will appear here once request history is connected.</p>
      <section className="callout">
        <div>
          <p className="eyebrow">NO ACTIVITY YET</p>
          <h2>Start with a model comparison.</h2>
          <p>Run a prompt in the playground to begin exploring model responses.</p>
        </div>
        <Link href="/playground">Open playground ↗</Link>
      </section>
    </main>
  );
}
