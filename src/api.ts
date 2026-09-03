/**
 * ZkCred (AegisID) — Contract API Layer & SDK Facade
 * Target: Midnight Network Preprod (testnet-02)
 * Track: Level 3 — Option 2: Age / Eligibility Gate
 */

export type ContractAddress = string;

// Re-export official Midnight.js integration module
export {
  createMidnightProviders,
  createWitnessCallbacks,
  deployZkCredContract,
  executeVerifyEligibilityCircuit,
  fetchLedgerStateFromIndexer,
  DEFAULT_PREPROD_CONFIG as MIDNIGHT_PREPROD_CONFIG,
  type MidnightProviders,
  type MidnightConfig,
  type PrivateWitnessData,
} from "./midnight.js";

// Re-export offline development mock simulator
export { ZkCredSimulator, type ZkCredPublicState, type ZkCredPrivateWitness, type VerificationResult } from "./mock/simulator.js";

// =============================================================================
// Witness Provider
// Creates the private witness callbacks that the Compact circuit calls
// to retrieve private data during proof generation.
// =============================================================================

export interface ZkCredWitnessInput {
  creditScore: number;
  annualIncome: bigint;
  age: number;
  userSalt: Uint8Array;
}

export function createWitnessProvider(privateData: ZkCredWitnessInput) {
  return {
    getPrivateCreditScore: (): number => privateData.creditScore,
    getPrivateAnnualIncome: (): bigint => privateData.annualIncome,
    getPrivateAge: (): number => privateData.age,
    getPrivateSalt: (): Uint8Array => privateData.userSalt,
  };
}

// =============================================================================
// Cryptographic Utilities
// =============================================================================

export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(32);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(salt);
  } else {
    for (let i = 0; i < 32; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
  }
  return salt;
}

export function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Default Thresholds & Configurations
// =============================================================================

export const DEFAULT_MIN_CREDIT_SCORE = 700;
export const DEFAULT_MIN_ANNUAL_INCOME = 5_000_000n; // $50,000 in cents
export const DEFAULT_MIN_AGE = 21; // Age Gate threshold

export interface DeployConfig {
  minCreditScore: number;
  minAnnualIncome: bigint;
  minAge: number;
  networkEndpoint: string;
  proofServerUrl: string;
}

export const PREPROD_CONFIG: Partial<DeployConfig> = {
  networkEndpoint: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  proofServerUrl: "http://localhost:6300",
};

export function formatIncomeCents(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}
