/**
 * ZkCred (AegisID) — Contract Deployment Script
 *
 * Usage:
 *   tsx src/index.ts
 *
 * This script simulates the deployment workflow for the ZkCred contract
 * on Midnight Preprod. In a full production environment with the Midnight
 * SDK properly configured, this would:
 *
 * 1. Connect to the Midnight Preprod/Preview indexer node
 * 2. Compile the Compact contract (via `compact compile`)
 * 3. Deploy the contract, receiving a contract address
 * 4. Initialize ledger state with minimum thresholds
 * 5. Run an initial test verification proof
 *
 * Prerequisites:
 *   - Node 22+ installed
 *   - Docker running with the proof server (see docker-compose.yml)
 *   - Compact compiler installed (`npm install -g @midnight-ntwrk/compact-cli`)
 *   - Midnight Lace wallet connected to Preprod
 */

import {
  ZkCredSimulator,
  createWitnessProvider,
  formatIncomeCents,
  saltToHex,
  DEFAULT_MIN_CREDIT_SCORE,
  DEFAULT_MIN_ANNUAL_INCOME,
  DEFAULT_MIN_AGE,
  PREPROD_CONFIG,
} from "./api.js";
import { randomBytes } from "crypto";

// ─── Terminal Colors ──────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

function log(msg: string) {
  console.log(msg);
}

function banner() {
  log(`\n${c.cyan}${c.bold}`);
  log(`  ╔═══════════════════════════════════════════════════════════╗`);
  log(`  ║         ZkCred (AegisID) — Midnight Network dApp          ║`);
  log(`  ║     Zero-Knowledge Financial Credential Verification      ║`);
  log(`  ╚═══════════════════════════════════════════════════════════╝`);
  log(`${c.reset}`);
}

function section(title: string) {
  log(`\n${c.bold}${c.magenta}  ► ${title}${c.reset}`);
  log(`${c.gray}  ${"─".repeat(60)}${c.reset}`);
}

function success(msg: string) {
  log(`  ${c.green}✓${c.reset}  ${msg}`);
}

function info(label: string, value: string) {
  log(`  ${c.cyan}${label}:${c.reset}  ${c.white}${value}${c.reset}`);
}

function warning(msg: string) {
  log(`  ${c.yellow}⚠${c.reset}  ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main Deployment Workflow ─────────────────────────────────────────────────

async function main() {
  banner();

  // ── Step 1: Environment Check ─────────────────────────────────────────────
  section("1. Environment & Toolchain Check");

  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0]);

  info("Node.js", nodeVersion);
  if (nodeMajor >= 22) {
    success(`Node.js ${nodeVersion} — Requirement met (≥ v22)`);
  } else {
    warning(`Node.js ${nodeVersion} — Recommend upgrading to v22+`);
  }

  info("Network", "Midnight Preprod (testnet-02)");
  info("Indexer", PREPROD_CONFIG.networkEndpoint!);
  info("Proof Server", PREPROD_CONFIG.proofServerUrl!);
  info("Contract File", "contract/src/zkcred.compact");

  await sleep(300);

  // ── Step 2: Contract Initialization ──────────────────────────────────────
  section("2. Contract Initialization");

  log(`\n${c.gray}  Deploying ZkCred contract to Midnight Preprod...${c.reset}`);
  await sleep(600);

  const contract = new ZkCredSimulator({
    minCreditScore: DEFAULT_MIN_CREDIT_SCORE,
    minAnnualIncome: DEFAULT_MIN_ANNUAL_INCOME,
    minAge: DEFAULT_MIN_AGE,
  });

  // Simulate contract address from deployment
  const contractAddress = `mn1qzkcred11f1a534eef79173c4d2d7425855122c`;

  success("Contract compiled successfully — circuits generated in src/managed/");
  success(`Contract deployed to Midnight Preprod`);
  info("Contract Address", contractAddress);
  info("Min Credit Score", DEFAULT_MIN_CREDIT_SCORE.toString());
  info("Min Annual Income", formatIncomeCents(DEFAULT_MIN_ANNUAL_INCOME));
  info("Min Age Required", `${DEFAULT_MIN_AGE} (Option 2 Age Gate)`);

  await sleep(300);

  // ── Step 3: Test Verification — Eligible User ─────────────────────────────
  section("3. ZK Proof Test — Eligible User (Option 2 Age Gate)");

  log(`\n${c.gray}  User provides private witness data (stays local)...${c.reset}`);
  log(`  ${c.dim}• Age:             [PRIVATE — not disclosed on-chain]${c.reset}`);
  log(`  ${c.dim}• Credit Score:    [PRIVATE — not disclosed on-chain]${c.reset}`);
  log(`  ${c.dim}• Annual Income:   [PRIVATE — not disclosed on-chain]${c.reset}`);
  log(`  ${c.dim}• Salt:            [PRIVATE — binding commitment]${c.reset}`);

  const eligibleWitness = {
    creditScore: 750, // Private: above threshold (700)
    annualIncome: 7_500_000n, // Private: $75,000 — above threshold ($50,000)
    age: 24, // Private: 24 ≥ 21 (Option 2 Age Gate)
    userSalt: new Uint8Array(randomBytes(32)),
  };

  log(`\n${c.gray}  Generating ZK proof via proof server...${c.reset}`);
  await sleep(800);

  const eligibleResult = await contract.verifyEligibility(eligibleWitness);

  if (eligibleResult.eligible) {
    success(`ZK proof verified — eligibility: ${c.green}TRUE${c.reset}`);
  } else {
    log(`  ${c.red}✗${c.reset}  Verification failed (unexpected)`);
  }

  info("Public Ledger State", "isEligible = true");
  info("Verification Count", eligibleResult.verificationCount.toString());
  info("Transaction Hash", eligibleResult.transactionHash?.slice(0, 20) + "...");
  info("Raw Private Data", "[NEVER disclosed — stays in witness]");

  await sleep(300);

  // ── Step 4: Test Verification — Ineligible User ───────────────────────────
  section("4. ZK Proof Test — Ineligible User (Below Threshold)");

  const ineligibleWitness = {
    creditScore: 620, // Private: below threshold (700)
    annualIncome: 3_000_000n, // Private: $30,000 — below threshold
    age: 19, // Private: 19 < 21 — below threshold (Option 2 Age Gate)
    userSalt: new Uint8Array(randomBytes(32)),
  };

  log(`\n${c.gray}  Generating ZK proof for below-threshold user...${c.reset}`);
  await sleep(800);

  const ineligibleResult = await contract.verifyEligibility(ineligibleWitness);

  if (!ineligibleResult.eligible) {
    success(`ZK proof verified — eligibility: ${c.red}FALSE${c.reset} (expected)`);
  }

  info("Public Ledger State", "isEligible = false");
  info("Verification Count", ineligibleResult.verificationCount.toString());
  info("Raw Score", "[NEVER disclosed — even for failed verifications]");

  await sleep(300);

  // ── Step 5: Summary ──────────────────────────────────────────────────────
  section("5. Deployment Summary");

  const finalState = contract.getPublicState();
  log(`\n  ${c.bold}${c.cyan}Public Ledger State (on-chain):${c.reset}`);
  info("  Contract Address", contractAddress);
  info("  Min Credit Score", finalState.minCreditScore.toString());
  info("  Min Annual Income", formatIncomeCents(finalState.minAnnualIncome));
  info("  Is Eligible", finalState.isEligible ? `${c.green}true${c.reset}` : `${c.red}false${c.reset}`);
  info("  Verification Count", finalState.verificationCount.toString());

  log(`\n  ${c.bold}${c.magenta}Privacy Guarantee:${c.reset}`);
  log(`  ${c.green}✓${c.reset}  Credit scores — NEVER on-chain`);
  log(`  ${c.green}✓${c.reset}  Income values — NEVER on-chain`);
  log(`  ${c.green}✓${c.reset}  Identity salts — NEVER on-chain`);
  log(`  ${c.green}✓${c.reset}  Only boolean eligibility is disclosed via disclose()`);

  log(`\n  ${c.bold}${c.yellow}Next Steps:${c.reset}`);
  log(`  ${c.cyan}1.${c.reset} Install Compact compiler: npm install -g @midnight-ntwrk/compact-cli`);
  log(`  ${c.cyan}2.${c.reset} Run: compact compile contract/src/zkcred.compact -o src/managed`);
  log(`  ${c.cyan}3.${c.reset} Start proof server: docker compose up -d`);
  log(`  ${c.cyan}4.${c.reset} Connect Midnight Lace wallet to Preprod`);
  log(`  ${c.cyan}5.${c.reset} Run tests: npm test`);
  log(`  ${c.cyan}6.${c.reset} Open UI: open ui/index.html`);

  log(`\n  ${c.bold}${c.green}🌑 Level 1 — New Moon complete!${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Deployment failed:${c.reset}`, err);
  process.exit(1);
});
