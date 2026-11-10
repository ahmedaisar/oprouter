import { NextResponse } from "next/server";
type ProviderModel={id:string;name:string;description?:string;context_length?:number;pricing?:{prompt?:string;completion?:string};architecture?:{modality?:string;input_modalities?:string[];output_modalities?:string[]}};
export async function GET(){
 try{
  const response=await fetch("https://openrouter.ai/api/v1/models",{headers:{"HTTP-Referer":process.env.NEXT_PUBLIC_APP_URL??"http://localhost:3000","X-Title":"OpRouter"},next:{revalidate:900}});
  if(!response.ok)return NextResponse.json({error:"Model provider is temporarily unavailable."},{status:502});
  const payload=await response.json() as {data?:ProviderModel[]};
  const models=(payload.data??[]).map(m=>({id:m.id,name:m.name,description:m.description??"",contextLength:m.context_length??0,promptPrice:Number(m.pricing?.prompt??0),completionPrice:Number(m.pricing?.completion??0),modality:m.architecture?.modality??"text",inputModalities:m.architecture?.input_modalities??["text"],outputModalities:m.architecture?.output_modalities??["text"]}));
  return NextResponse.json({models,count:models.length},{headers:{"Cache-Control":"public, s-maxage=900, stale-while-revalidate=3600"}});
 }catch{return NextResponse.json({error:"Unable to load models right now."},{status:502})}
}