#!/usr/bin/env node
/**
 * Scanner local de desenvolvimento (NUNCA em produção: lib/env.ts recusa localhost/HTTP).
 * Responde clean para qualquer arquivo, exceto os que contêm a assinatura de teste EICAR,
 * que são bloqueados para ensaiar a quarentena.
 */
import { createServer } from "node:http";

const port = Number(process.env.PORT || 8787);
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

createServer((req, res) => {
  if (req.method === "POST") {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const infected = Buffer.concat(chunks).includes(EICAR);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(infected ? { clean: false, engine: "local-dev", reason: "EICAR-Test-File" } : { clean: true, engine: "local-dev" }));
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
}).listen(port, "127.0.0.1", () => {
  console.log(`Scanner local em http://127.0.0.1:${port}/scan (EICAR → quarentena)`);
});
