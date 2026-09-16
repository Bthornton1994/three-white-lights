import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const root = dirname(fileURLToPath(import.meta.url));

const FABLE_FILES: Record<string, string> = {
  "AI-REF-01-MODEL-SHEET.png": "b484a534dfa54764245a006bb8e9ef8ce2a78077dd25773041bd6f8f8eb59ff9",
  "AI-REF-02-BENCH-THREE-QUARTER.png": "0e4410b6dc472bd423bdb551cce7497978c062fb55e9148896c7bf8fabe923b7",
  "AI-REF-03-DEADLIFT-SETUP-LOCKOUT-MAX.png": "b56e379f6c18b52f5a6e8da4f3bc0cd9781645477b446741ca1444ad505c16ba",
  "AI-REF-04-SQUAT-HOLE-LIGHT-VS-MAX.png": "bc6e03a8a83e5bfc77f2b4961c4f93f00342fc32e1b8dea1dcfa0be465ebc64a",
  "AI-REF-05-TITLE-SCREEN.png": "1bc09ab2231eb7a91fe7289cacfea23a5ac1a1dfc94402570806b614ff299d2f",
};

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function syncFableStills(): void {
  const srcDir = resolve(root, "art-direction/concept-fable-20260916/reference-ai");
  const destDir = resolve(root, "public/illustrated/fable-20260916");
  mkdirSync(destDir, { recursive: true });
  for (const [name, expected] of Object.entries(FABLE_FILES)) {
    const src = resolve(srcDir, name);
    const got = sha256(src);
    if (got !== expected) {
      throw new Error(`refusing mutated Fable still ${name}: ${got}`);
    }
    const dest = resolve(destDir, name);
    cpSync(src, dest);
    if (sha256(dest) !== expected) {
      throw new Error(`copy mismatch ${name}`);
    }
  }
}

function fableIllustratedPlugin(): Plugin {
  return {
    name: "fable-illustrated-sync",
    buildStart() {
      syncFableStills();
    },
    configureServer() {
      syncFableStills();
    },
  };
}

export default defineConfig({
  plugins: [react(), fableIllustratedPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
