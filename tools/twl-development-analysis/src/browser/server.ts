import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import type { ServedProvenance } from "../types.ts";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};

/** Preview proxy port. Analysis never reuses it. */
export const FORBIDDEN_PORTS = new Set([8080, 8081]);

export interface StaticServer {
  url: string;
  port: number;
  listenToken: string;
  provenance: ServedProvenance;
  close: () => Promise<void>;
}

export interface ServeOptions {
  targetSha: string;
  runId: string;
  capturedAt?: string;
  distScriptPath?: string | null;
  distScriptSha256?: string | null;
  indexSha256?: string;
}

/**
 * Serves a built `dist/` directory read-only on 127.0.0.1 with a fresh
 * ephemeral port. Never binds 8080/8081. `/__provenance.json` is injected
 * by this server (not by the game) so the analyzer can reject a stale
 * preview without touching runtime files.
 */
export async function serveStatic(dir: string, opts: ServeOptions): Promise<StaticServer> {
  const root = path.resolve(dir);
  const listenToken = randomBytes(16).toString("hex");
  const capturedAt = opts.capturedAt ?? new Date().toISOString();
  const provenanceDraft: Omit<ServedProvenance, "port"> = {
    schemaVersion: 1,
    targetSha: opts.targetSha,
    capturedAt,
    runId: opts.runId,
    listenToken,
    distScriptPath: opts.distScriptPath ?? null,
    distScriptSha256: opts.distScriptSha256 ?? null,
    indexSha256: opts.indexSha256 ?? "",
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/__provenance.json") {
      const addr = server.address() as AddressInfo | null;
      const body = JSON.stringify({ ...provenanceDraft, port: addr?.port ?? 0 }, null, 2);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(body);
      return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, `.${rel}`);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    const target = existsSync(file) && statSync(file).isFile() ? file : path.join(root, "index.html");
    if (!existsSync(target)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(target).pipe(res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  if (FORBIDDEN_PORTS.has(port)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error(`refused to serve analysis on forbidden preview port ${port}`);
  }
  const provenance: ServedProvenance = { ...provenanceDraft, port };
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    listenToken,
    provenance,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
