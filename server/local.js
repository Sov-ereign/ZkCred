#!/usr/bin/env node
/**
 * Local dev server — wraps api/index.js with a real HTTP server + dotenv.
 * Use this for local testing: node server/local.js
 * For production, api/index.js is deployed as a Vercel serverless function.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (dotenv is loaded inside api/index.js too, but we need
// it before require() so env vars are present at module load time)
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
  console.log("[env] Loaded .env from", envPath);
}

// api/index.js uses CommonJS — load it via createRequire
const require = createRequire(import.meta.url);
const app = require("../api/index.js");

const PORT = process.env.PORT || 3000;

// Serve static files from ui/ for local dev convenience
import { createServer } from "http";
import { createReadStream } from "fs";
import { extname } from "path";

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Mount static UI files on Express
import express from "express";
const uiPath = resolve(__dirname, "../ui");
app.use(express.static(uiPath));
// SPA fallback
app.get("/{*path}", (req, res) => {
  res.sendFile(resolve(uiPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🛡  AegisID ZkCred — Local Dev Server`);
  console.log(`   UI + API: http://localhost:${PORT}`);
  console.log(`   Google OAuth callback: http://localhost:${PORT}/api/auth/google/callback\n`);
});
