"use client";
import { useEffect, useState } from "react";
type ApiKey = { id:string; name:string; key_prefix:string; model_allowlist:string[]|null; monthly_token_limit:number|null; created_at:string; last_used_at:string|null; revoked_at:string|null };
export function ApiKeyManager() {
  const [keys,setKeys]=useState<ApiKey[]>([]);
  const [name,setName]=useState("");
  const [limit,setLimit]=useState("");
  const [models,setModels]=useState("");
  const [secret,setSecret]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function refresh(){const r=await fetch("/api/keys");const d=await r.json();if(r.ok)setKeys(d.keys??[]);else setMessage(d.error??"Unable to load keys.");}
  useEffect(()=>{void refresh();},[]);
  async function create(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage("");setSecret("");try{const r=await fetch("/api/keys",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,monthly_token_limit:limit?Number(limit):null,model_allowlist:models.trim()?models.split(",").map(x=>x.trim()).filter(Boolean):null})});const d=await r.json();if(!r.ok)throw new Error(d.error);setSecret(d.secret);setName("");setLimit("");setModels("");await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to create key.");}finally{setBusy(false);}}
  async function revoke(id:string){if(!window.confirm("Revoke this API key? Existing integrations will stop working."))return;setBusy(true);try{const r=await fetch("/api/keys?id="+encodeURIComponent(id),{method:"DELETE"});const d=await r.json();if(!r.ok)throw new Error(d.error);await refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to revoke key.");}finally{setBusy(false);}}
  return <section className="callout" style={{marginTop:28,display:"block"}}>
    <p className="eyebrow">DEVELOPER ACCESS</p><h2>API keys</h2><p>Create credentials for the OpenAI-compatible gateway. Secrets are shown once and stored only as hashes.</p>
    <form onSubmit={create} style={{display:"grid",gap:12,maxWidth:620,marginTop:20}}>
      <label>Key name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Production service" style={field}/></label>
      <label>Monthly token cap (optional)<input type="number" min="1" step="1" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="Inherit workspace limit" style={field}/></label>
      <label>Allowed model IDs (optional, comma-separated)<input value={models} onChange={e=>setModels(e.target.value)} placeholder="openai/gpt-4o, anthropic/claude..." style={field}/></label>
      <button disabled={busy} type="submit" style={button}>Create API key</button>
    </form>
    {secret&&<div role="alert" style={{marginTop:20,padding:16,border:"1px solid #65d6a1",borderRadius:10}}><strong>Copy this key now. It cannot be shown again.</strong><p style={{overflowWrap:"anywhere"}}>{secret}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(secret)} style={button}>Copy secret</button></div>}
    {message&&<p role="status">{message}</p>}
    <div style={{overflowX:"auto",marginTop:24}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Name","Prefix","Monthly cap","Last used","Status",""].map(x=><th key={x} style={{padding:10,color:"#91a0b4"}}>{x}</th>)}</tr></thead><tbody>
      {keys.map(k=><tr key={k.id}><td style={cell}>{k.name}</td><td style={cell}><code>{k.key_prefix}…</code></td><td style={cell}>{k.monthly_token_limit?.toLocaleString()??"Workspace default"}</td><td style={cell}>{k.last_used_at?new Date(k.last_used_at).toLocaleString():"Never"}</td><td style={cell}>{k.revoked_at?"Revoked":"Active"}</td><td style={cell}>{!k.revoked_at&&<button disabled={busy} onClick={()=>void revoke(k.id)} style={revokeButton}>Revoke</button>}</td></tr>)}
      {!keys.length&&<tr><td style={cell} colSpan={6}>No API keys created yet.</td></tr>}
    </tbody></table></div>
  </section>;
}
const field:React.CSSProperties={display:"block",width:"100%",marginTop:6,padding:12,borderRadius:8,border:"1px solid #30445d",background:"#0b121c",color:"#edf3fb"};
const button:React.CSSProperties={border:0,borderRadius:8,padding:"12px 16px",background:"#dce8ff",color:"#102039",fontWeight:800,cursor:"pointer"};
const revokeButton:React.CSSProperties={border:"1px solid #805050",borderRadius:7,padding:"7px 10px",background:"transparent",color:"#ffb5b5",cursor:"pointer"};
const cell:React.CSSProperties={padding:10,borderTop:"1px solid #263344",verticalAlign:"top"};
