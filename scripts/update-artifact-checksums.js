#!/usr/bin/env node
/**
 * ZkCred — Artifact checksum updater
 *
 * Re-computes SHA-256 for each of the ZkCred proving artifacts and writes
 * the results to src/managed/.artifact-checksums.
 *
 * Run this ONLY after a verified, intentional `compact compile` run:
 *   npm run compile
 *   npm run artifacts:update
 *
 * Never run this to "fix" a mismatch you did not introduce yourself — that
 * would silently bless a potentially tampered artifact.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const checksumFile = resolve(root, "src/managed/.artifact-checksums");

// Pin the source and every generated compiler output, including interface
// metadata, source maps, verifier keys, and both human/binary ZKIR files.
function filesUnder(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return filesUnder(rel);
    return entry.isFile() ? [rel] : [];
  });
}
const artifacts = [
  "contract/src/zkcred.compact",
  "contract/src/zkcred-v3.compact",
  "contract/src/schnorr.compact",
  ...filesUnder("src/managed").filter((rel) => rel !== "src/managed/.artifact-checksums"),
  ...filesUnder("src/managed-v3"),
].sort();

const lines = [];
for (const rel of artifacts) {
  const absPath = resolve(root, rel);
  if (!existsSync(absPath)) {
    console.error(`[artifacts:update] MISSING: ${rel} — run 'npm run compile' first.`);
    process.exit(1);
  }
  const data = readFileSync(absPath);
  const hex = createHash("sha256").update(data).digest("hex");
  lines.push(`${hex}  ${rel}`);
  console.log(`[artifacts:update] ${hex}  ${rel}`);
}

writeFileSync(checksumFile, lines.join("\n") + "\n", "utf8");
console.log(`\n[artifacts:update] Wrote ${lines.length} checksums to ${relative(root, checksumFile)}`);
