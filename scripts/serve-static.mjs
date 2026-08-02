// serve-static.mjs — zero-dependency static file server for local smoke
// testing of apps/web (and, later, apps/desktop's renderer bundle) without
// pulling in a dev-server dependency. Usage: node serve-static.mjs <rootDir> [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.argv[2] || ".";
const port = Number(process.argv[3]) || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    // Normalize and reject any path that escapes the served root (defends
    // against path traversal via crafted request URLs, e.g. "..%2F..%2F").
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const safePath = normalize(urlPath).replace(/^([.][.][\\/])+/, "");
    let filePath = join(root, safePath);

    let stats = await stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      filePath = join(filePath, "index.html");
      stats = await stat(filePath).catch(() => null);
    }
    if (!stats) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(`Server error: ${err.message}`);
  }
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}/`);
});
