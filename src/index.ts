/**
 * The signing flow is intentionally browser-only: it requires an unlocked
 * Midnight Lace extension. This CLI validates the local prover configuration
 * but never fabricates a transaction when a wallet is unavailable.
 */
import { createMidnightProviders, MIDNIGHT_PREPROD_CONFIG } from "./api.js";

async function main() {
  const providers = await createMidnightProviders(MIDNIGHT_PREPROD_CONFIG);
  console.log(`Proof server is reachable at ${providers.proofProviderUrl}.`);
  console.log("Open the Vite dApp (npm run ui), connect Midnight Lace, and approve the Preprod transaction there.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
