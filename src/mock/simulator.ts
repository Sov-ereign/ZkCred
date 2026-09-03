/**
 * ZkCred (AegisID) — Contract State Development Simulator
 * 
 * ⚠️ DEVELOPMENT-ONLY MOCK
 * This simulator is used EXCLUSIVELY for offline unit tests (e.g. `npm test`)
 * when running without an active proof server or wallet connector.
 * 
 * Production code, Preprod deployment scripts, and dApp UI interactions
 * use the official Midnight.js integration layer (`src/midnight.ts`).
 */

export interface ZkCredPublicState {
  minCreditScore: number;
  minAnnualIncome: bigint;
  minAge: number;
  isEligible: boolean;
  verificationCount: bigint;
  contractAddress?: string;
}

export interface ZkCredPrivateWitness {
  creditScore: number;
  annualIncome: bigint;
  age: number;
  userSalt: Uint8Array;
}

export interface VerificationResult {
  eligible: boolean;
  proofGenerated: boolean;
  transactionHash?: string;
  verificationCount: bigint;
  timestamp: number;
}

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

  async verifyEligibility(witness: ZkCredPrivateWitness): Promise<VerificationResult> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const meetsScoreThreshold = witness.creditScore >= this.state.minCreditScore;
    const meetsIncomeThreshold = witness.annualIncome >= this.state.minAnnualIncome;
    const meetsAgeThreshold = witness.age >= this.state.minAge;

    const eligible = meetsScoreThreshold && meetsIncomeThreshold && meetsAgeThreshold;

    this.state.isEligible = eligible;
    this.state.verificationCount += 1n;

    // Convert salt to deterministic hex hash for test verification
    const saltHex = Array.from(witness.userSalt)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      eligible,
      proofGenerated: true,
      transactionHash: `0x${saltHex}`,
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
