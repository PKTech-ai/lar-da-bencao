const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const host = "0.0.0.0";
const port = Number(process.env.LAR_MOBILE_PORT || 8767);
const indexPath = path.resolve(__dirname, "../dist/index.html");

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(indexPath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Teste móvel disponível na porta ${port}.`);
});
