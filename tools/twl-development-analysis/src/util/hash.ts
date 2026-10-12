import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(file: string): string {
  return sha256Hex(readFileSync(file));
}

export function short(sha: string | null | undefined, n = 8): string {
  return sha ? sha.slice(0, n) : "-";
}
