import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { viteStaticCopy } from "vite-plugin-static-copy";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: "ui",
  define: { global: "globalThis" },
  resolve: {
    alias: {
      process: "process/browser",
      buffer: "buffer",
      assert: "assert",
      util: "util",
      crypto: path.join(root, "ui/crypto-shim.ts"),
      stream: "stream-browserify",
      events: "events",
    },
  },
  plugins: [
    wasm(),
    viteStaticCopy({
      targets: [
        { src: "../src/managed/keys/*", dest: "contract/compiled/keys" },
        { src: "../src/managed/zkir/*", dest: "contract/compiled/zkir" },
      ],
    }),
  ],
  optimizeDeps: {
    include: ["level", "browser-level", "abstract-level", "level-supports", "level-transcoder"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    rollupOptions: { input: path.join(root, "ui/index.html") },
  },
  server: {
    fs: { allow: [root] },
    proxy: {
      "/api": {
        target: "https://zkcred-api.onrender.com",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
