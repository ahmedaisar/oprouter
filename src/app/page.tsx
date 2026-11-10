import Link from "next/link";
const cards = [
 {label:"Models",value:"Discover and compare AI models",href:"/models",icon:"◈"},
 {label:"Playground",value:"Run prompts across providers",href:"/playground",icon:"✳"},
 {label:"Activity",value:"Review requests and spend",href:"/activity",icon:"↗"},
 {label:"Settings",value:"Configure your API connection",href:"/settings",icon:"⌘"}
];
export default function Home(){return <main className="dashboard"><p className="eyebrow">YOUR AI WORKSPACE</p><h1>One interface.<br/><span>Every model.</span></h1><p className="intro">Explore models, compare responses, and manage your AI workflow in one place.</p><div className="status"><i/> Workspace ready <span>·</span> Connect an OpenRouter key to start making requests</div><section className="tiles">{cards.map(c=><Link className="tile" href={c.href} key={c.href}><b>{c.icon}</b><small>{c.label}</small><strong>{c.value}</strong><span>Explore →</span></Link>)}</section><section className="callout"><div><p className="eyebrow">START HERE</p><h2>Find the right model for the job.</h2><p>Filter by capability, context length, and pricing before testing it in the playground.</p></div><Link href="/models">Explore models ↗</Link></section></main>}
