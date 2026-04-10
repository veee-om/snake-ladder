import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    await serveStaticFile(relativePath, response);
  } catch (error) {
    respondNotFound(response);
  }
});

server.listen(PORT, () => {
  console.log(`Vyom ki Saanp Seedhi is running on http://localhost:${PORT}`);
});

async function serveStaticFile(relativePath, response) {
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(__dirname, safePath);

  if (!existsSync(filePath)) {
    respondNotFound(response);
    return;
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    respondNotFound(response);
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
    "Content-Length": fileStat.size
  });
  createReadStream(filePath).pipe(response);
}

function respondNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found.");
}
