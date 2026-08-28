/**
 * ZkCred (AegisID) — Contract API Layer
 * Target: Midnight Network Preprod
 * Track: Level 3 — Option 2: Age / Eligibility Gate
 */

export type ContractAddress = string;

// =============================================================================
// Type Definitions
// =============================================================================

/** Public state visible on the Midnight blockchain */
export interface ZkCredPublicState {
  minCreditScore: number;
  minAnnualIncome: bigint;
  minAge: number;
  isEligible: boolean;
  verificationCount: bigint;
  contractAddress?: string;
}

/** Private witness data — stays local, NEVER submitted on-chain */
export interface ZkCredPrivateWitness {
  creditScore: number; // e.g. 720 — kept private via ZK witness
  annualIncome: bigint; // USD cents — kept private via ZK witness
  age: number; // e.g. 24 — kept private via ZK witness (Age Gate)
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
  minAge: number;
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
// Contract State Simulator (Local ZK Circuit Execution Engine)
// =============================================================================

export class ZkCredSimulator {
  private state: ZkCredPublicState;

  constructor(initialState: Omit<ZkCredPublicState, "isEligible" | "verificationCount">) {
    this.state = {
      ...initialState,
      isEligible: false,
      verificationCount: 0n,
    };
  }

  getPublicState(): ZkCredPublicState {
    return { ...this.state };
  }

  /**
   * Option 2 ZK Gate Simulation:
   * Evaluates Age, Credit Score, and Income inside ZK circuit limits.
   * Discloses ONLY binary eligibility boolean to public ledger.
   */
  async verifyEligibility(witness: ZkCredPrivateWitness): Promise<VerificationResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const meetsScoreThreshold = witness.creditScore >= this.state.minCreditScore;
    const meetsIncomeThreshold = witness.annualIncome >= this.state.minAnnualIncome;
    const meetsAgeThreshold = witness.age >= this.state.minAge;

    const eligible = meetsScoreThreshold && meetsIncomeThreshold && meetsAgeThreshold;

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

  updateThresholds(newMinCreditScore: number, newMinAnnualIncome: bigint, newMinAge: number): void {
    this.state.minCreditScore = newMinCreditScore;
    this.state.minAnnualIncome = newMinAnnualIncome;
    this.state.minAge = newMinAge;
    this.state.isEligible = false;
  }
}

// =============================================================================
// Default Thresholds
// =============================================================================

export const DEFAULT_MIN_CREDIT_SCORE = 700;
export const DEFAULT_MIN_ANNUAL_INCOME = 5_000_000n; // $50,000 in cents
export const DEFAULT_MIN_AGE = 21; // Age Gate threshold

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
