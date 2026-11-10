"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import "./playground.css";

type Model = { id:string; name:string; promptPrice:number; completionPrice:number; contextLength:number };
type Result = { modelId:string; text:string; status:"idle"|"running"|"done"|"error"; error?:string };

async function streamModel(modelId:string,prompt:string,onText:(text:string)=>void):Promise<void>{
 const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:modelId,messages:[{role:"user",content:prompt}],temperature:0.7,max_tokens:1200})});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error??"Request failed.");}
 if(!response.body)throw new Error("Streaming is not supported by this response.");
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
 while(true){
  const {done,value}=await reader.read();if(done)break;
  buffer+=decoder.decode(value,{stream:true});
  const chunks=buffer.split("\n");buffer=chunks.pop()??"";
  for(const line of chunks){if(!line.startsWith("data:"))continue;const data=line.slice(5).trim();if(!data||data==="[DONE]")continue;
   try{const event=JSON.parse(data) as {choices?:{delta?:{content?:string}}[];error?:{message?:string}};
    const token=event.choices?.[0]?.delta?.content;if(token)onText(token);
    if(event.error?.message)throw new Error(event.error.message);
   }catch(error){if(error instanceof SyntaxError)continue;throw error;}
  }
 }
}

export default function PlaygroundPage(){
 const [models,setModels]=useState<Model[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [prompt,setPrompt]=useState("");
 const [results,setResults]=useState<Result[]>([]);
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [catalogueError,setCatalogueError]=useState("");
 useEffect(()=>{
  let active=true;
  fetch("/api/models").then(async r=>{if(!r.ok)throw new Error("Could not load model directory.");return r.json();})
   .then(d=>{if(!active)return;const list=(d.models??[]) as Model[];setModels(list);const requested=(new URLSearchParams(window.location.search).get("models")??"").split(",").filter(Boolean);const valid=requested.filter(id=>list.some(m=>m.id===id)).slice(0,3);setSelected(valid.length?valid:[list[0]?.id].filter(Boolean) as string[]);})
   .catch(e=>{if(active)setCatalogueError(e instanceof Error?e.message:"Unable to load models.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const toggle=(id:string)=>setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length<3?[...current,id]:current);
 async function submit(event:FormEvent){
  event.preventDefault();const value=prompt.trim();if(!value||!selected.length||sending)return;
  setSending(true);setResults(selected.map(modelId=>({modelId,text:"",status:"running"})));
  await Promise.all(selected.map(async modelId=>{
   try{await streamModel(modelId,value,token=>setResults(current=>current.map(r=>r.modelId===modelId?{...r,text:r.text+token}:r)));
    setResults(current=>current.map(r=>r.modelId===modelId?{...r,status:"done"}:r));
   }catch(error){setResults(current=>current.map(r=>r.modelId===modelId?{...r,status:"error",error:error instanceof Error?error.message:"Request failed"}:r));}
  }));
  setSending(false);
 }
 return <main className="playground-wrap">
  <nav className="topbar"><Link href="/" className="brand">◈ OP<span>ROUTER</span></Link><div><Link href="/">Overview</Link><Link href="/models">Models</Link><Link className="active" href="/playground">Playground</Link><Link href="/activity">Activity</Link><Link href="/settings">Settings</Link></div></nav>
  <header className="play-heading"><p className="eyebrow">MODEL PLAYGROUND</p><h1>One prompt.<br/><span>Multiple perspectives.</span></h1><p>Run the same prompt against up to three models and compare their streamed responses side by side.</p></header>
  <section className="play-config"><div className="config-head"><div><strong>Choose models</strong><small>Select up to three for a side-by-side run</small></div><span>{selected.length}/3 selected</span></div>
   {loading?<p className="play-hint">Loading model directory…</p>:catalogueError?<p className="play-error">{catalogueError}</p>:<div className="model-picker">{models.filter(m=>selected.includes(m.id)).map(m=><button key={m.id} className="picked-model" onClick={()=>toggle(m.id)} title="Remove model">{m.name}<span>×</span></button>)}<select aria-label="Add a model" value="" onChange={e=>e.target.value&&toggle(e.target.value)} disabled={selected.length>=3}><option value="">+ Add model</option>{models.filter(m=>!selected.includes(m.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
  </section>
  <form className="prompt-box" onSubmit={submit}><label htmlFor="prompt">YOUR PROMPT</label><textarea id="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask a question, give an instruction, or paste a task to compare model responses…" rows={5} maxLength={12000}/><div className="prompt-actions"><span>{prompt.length.toLocaleString()} / 12,000</span><button type="submit" disabled={sending||!prompt.trim()||!selected.length||loading}>{sending?"Running models…":"Run comparison ↗"}</button></div></form>
  {results.length>0&&<section className="response-section"><div className="response-title"><div><p className="eyebrow">LIVE OUTPUT</p><h2>Model responses</h2></div><span>{sending?"Streaming…":"Run complete"}</span></div><div className="response-grid">{results.map(result=>{const model=models.find(m=>m.id===result.modelId);return <article className="response-card" key={result.modelId}><header><strong>{model?.name??result.modelId}</strong><span className={`response-status ${result.status}`}>{result.status}</span></header>{result.error?<p className="response-error">{result.error}</p>:<pre>{result.text|| (result.status==="running"?"Waiting for first token…":"No response content.")}</pre>}</article>})}</div></section>}
  <footer className="play-footer">Responses stream through the server. Your OpenRouter key is never sent to the browser.</footer>
 </main>;
}
