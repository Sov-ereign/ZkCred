#!/usr/bin/env node
/**
 * ZkCred — Artifact integrity verifier
 *
 * Reads .artifact-checksums, computes SHA-256 of each listed file, and
 * exits non-zero with a clear diagnostic if any digest mismatches.
 *
 * Run automatically via the "pretest" and "prebuild" npm hooks so tampered
 * or stale proving keys / ZKIR files cause the build or test run to fail
 * immediately rather than silently producing wrong proofs.
 *
 * Usage:
 *   node scripts/verify-artifacts.js          # normal (errors are fatal)
 *   node scripts/verify-artifacts.js --warn   # only warn, don't exit 1
 */

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const checksumFile = resolve(root, "src/managed/.artifact-checksums");
const warnOnly = process.argv.includes("--warn");

// ---------------------------------------------------------------------------
// Parse the checksum file (sha256sum format: "<hex>  <path>")
// ---------------------------------------------------------------------------
if (!existsSync(checksumFile)) {
  console.error(`[verify-artifacts] MISSING: ${checksumFile}`);
  console.error("  Run 'npm run artifacts:update' to generate the checksum file.");
  process.exit(warnOnly ? 0 : 1);
}

const lines = readFileSync(checksumFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

if (lines.length === 0) {
  console.error("[verify-artifacts] Checksum file is empty — nothing to verify.");
  process.exit(warnOnly ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Verify each artifact
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

for (const line of lines) {
  // Accept both one-space and two-space separators (sha256sum emits two)
  const spaceIdx = line.indexOf(" ");
  if (spaceIdx === -1) continue;
  const expectedHex = line.slice(0, spaceIdx).trim().toLowerCase();
  const relPath = line.slice(spaceIdx).trim().replace(/^\*/, ""); // strip leading '*' (binary flag)
  const absPath = resolve(root, relPath);

  if (!existsSync(absPath)) {
    console.error(`[verify-artifacts] MISSING artifact: ${relPath}`);
    console.error("  Re-run the Compact compiler: npm run compile");
    failed++;
    continue;
  }

  const data = readFileSync(absPath);
  const actualHex = createHash("sha256").update(data).digest("hex").toLowerCase();

  if (actualHex === expectedHex) {
    console.log(`[verify-artifacts] OK  ${relPath}`);
    passed++;
  } else {
    console.error(`[verify-artifacts] MISMATCH: ${relPath}`);
    console.error(`  expected: ${expectedHex}`);
    console.error(`  actual:   ${actualHex}`);
    console.error("  The artifact does not match the recorded digest.");
    console.error("  If you recompiled the contract, run: npm run artifacts:update");
    console.error("  If you did NOT recompile, DO NOT proceed — a file may have been tampered with.");
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n[verify-artifacts] ${passed}/${total} artifacts verified.`);

if (failed > 0) {
  if (warnOnly) {
    console.warn(`[verify-artifacts] WARNING: ${failed} artifact(s) failed verification (--warn mode, continuing).`);
  } else {
    console.error(`[verify-artifacts] FATAL: ${failed} artifact(s) failed verification.`);
    process.exit(1);
  }
}
