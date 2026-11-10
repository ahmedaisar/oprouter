import type { IncomingMessage, ServerResponse } from "node:http";
export async function proxyRequest(req: IncomingMessage, res: ServerResponse, upstream: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const response = await fetch(upstream + "/chat/completions", {
    method:"POST",headers:{"content-type":"application/json"},
    body:Buffer.concat(chunks)
  });
  res.writeHead(response.status,{"content-type":response.headers.get("content-type")??"application/json"});
  res.end(Buffer.from(await response.arrayBuffer()));
}
