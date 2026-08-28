/**
 * ZkCred (AegisID) — Contract API Layer
 *
 * This module provides TypeScript wrappers for interacting with the
 * deployed ZkCred Compact contract on the Midnight Preprod network.
 *
 * Architecture:
 * - The contract holds PUBLIC ledger state (thresholds, eligibility flag, count)
 * - PRIVATE witness data (creditScore, annualIncome, salt) never leaves this layer
 * - ZK proofs are generated locally by the proof server (Docker) before submission
 */

export type ContractAddress = string;

// =============================================================================
// Type Definitions
// =============================================================================

/** Public state visible on the Midnight blockchain */
export interface ZkCredPublicState {
  minCreditScore: number;
  minAnnualIncome: bigint;
  isEligible: boolean;
  verificationCount: bigint;
  contractAddress?: string;
}

/** Private witness data — stays local, NEVER submitted on-chain */
export interface ZkCredPrivateWitness {
  creditScore: number; // e.g. 720 — kept private via ZK witness
  annualIncome: bigint; // USD cents — kept private via ZK witness
  userSalt: Uint8Array; // 32-byte random salt — prevents replay attacks
}

/** Result of a ZK eligibility verification */
export interface VerificationResult {
  eligible: boolean;
  proofGenerated: boolean;
  transactionHash?: string;
  verificationCount: bigint;
  timestamp: number;
}

/** Contract deployment configuration */
export interface DeployConfig {
  minCreditScore: number;
  minAnnualIncome: bigint;
  networkEndpoint: string;
  proofServerUrl: string;
}

// =============================================================================
// Witness Provider
// Creates the private witness callbacks that the Compact circuit calls
// to retrieve private data during proof generation.
// =============================================================================

export function createWitnessProvider(privateData: ZkCredPrivateWitness) {
  return {
    /**
     * Called by the circuit to retrieve the private credit score.
     * This value is ONLY used inside the ZK circuit — it never appears on-chain.
     */
    getPrivateCreditScore: (): number => {
      return privateData.creditScore;
    },

    /**
     * Called by the circuit to retrieve the private annual income.
     * This value is ONLY used inside the ZK circuit — it never appears on-chain.
     */
    getPrivateAnnualIncome: (): bigint => {
      return privateData.annualIncome;
    },

    /**
     * Called by the circuit to retrieve the binding salt.
     * Ensures each proof is unique and prevents replay attacks.
     */
    getPrivateSalt: (): Uint8Array => {
      return privateData.userSalt;
    },
  };
}

// =============================================================================
// Cryptographic Utilities
// =============================================================================

/** Generate a cryptographically secure random 32-byte salt */
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

/** Convert a salt Uint8Array to a hex string for logging/display */
export function saltToHex(salt: Uint8Array): string {
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// Contract State Simulator (for testing without live network)
// =============================================================================

/**
 * Simulates the ZkCred contract state for local testing and UI demos.
 * In production, this would use the actual Midnight SDK contract API.
 */
export class ZkCredSimulator {
  private state: ZkCredPublicState;

  constructor(initialState: Omit<ZkCredPublicState, "isEligible" | "verificationCount">) {
    this.state = {
      ...initialState,
      isEligible: false,
      verificationCount: 0n,
    };
  }

  /** Get current public ledger state */
  getPublicState(): ZkCredPublicState {
    return { ...this.state };
  }

  /**
   * Simulate the verifyEligibility circuit execution.
   *
   * In production this would:
   * 1. Generate a ZK proof locally using the private witness
   * 2. Submit the proof transaction to Midnight Preprod
   * 3. The contract circuit evaluates eligibility inside ZK
   * 4. Only `disclose(eligible)` is written to the ledger
   *
   * Here we simulate the ZK evaluation logic that mirrors zkcred.compact.
   */
  async verifyEligibility(witness: ZkCredPrivateWitness): Promise<VerificationResult> {
    // Simulate proof generation delay (in production: actual ZK proof via proof-server)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // This mirrors the Compact circuit logic:
    // const meetsScoreThreshold: Boolean = creditScore >= minCreditScore;
    // const meetsIncomeThreshold: Boolean = annualIncome >= minAnnualIncome;
    // const eligible: Boolean = meetsScoreThreshold && meetsIncomeThreshold;
    const meetsScoreThreshold = witness.creditScore >= this.state.minCreditScore;
    const meetsIncomeThreshold = witness.annualIncome >= this.state.minAnnualIncome;
    const eligible = meetsScoreThreshold && meetsIncomeThreshold;

    // Update public ledger state (mirrors: isEligible = disclose(eligible))
    this.state.isEligible = eligible;
    this.state.verificationCount += 1n;

    return {
      eligible,
      proofGenerated: true,
      transactionHash: `0x${saltToHex(witness.userSalt).slice(0, 64)}`,
      verificationCount: this.state.verificationCount,
      timestamp: Date.now(),
    };
  }

  /** Simulate the updateThresholds circuit */
  updateThresholds(newMinCreditScore: number, newMinAnnualIncome: bigint): void {
    this.state.minCreditScore = newMinCreditScore;
    this.state.minAnnualIncome = newMinAnnualIncome;
    this.state.isEligible = false; // Reset on threshold change
  }
}

// =============================================================================
// Contract Deployment Configuration
// =============================================================================

/** Default Midnight Preprod deployment configuration */
export const PREPROD_CONFIG: Partial<DeployConfig> = {
  networkEndpoint: "https://indexer.testnet-02.midnight.network/api/v1/graphql",
  proofServerUrl: "http://localhost:6300",
};

/** Default credit score threshold for ZkCred verification */
export const DEFAULT_MIN_CREDIT_SCORE = 700;

/** Default minimum annual income: $50,000 (in cents) */
export const DEFAULT_MIN_ANNUAL_INCOME = 5_000_000n; // $50,000 in cents

/**
 * Formats an income value in cents to a human-readable USD string.
 * The raw income in cents is the private witness — only this string is for display.
 */
export function formatIncomeCents(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}
