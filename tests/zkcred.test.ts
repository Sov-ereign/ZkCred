/**
 * ZkCred (AegisID) — Test Suite
 *
 * Tests the contract logic as defined in zkcred.compact.
 * These tests verify the ZK circuit logic mirrors what the Compact compiler
 * would produce, ensuring correct behavior before on-chain deployment.
 *
 * Run with: npm test
 *
 * Test Coverage:
 *   1. Eligible verification (score AND income above threshold)
 *   2. Ineligible: credit score below threshold
 *   3. Ineligible: annual income below threshold
 *   4. Boundary conditions: exactly AT threshold (should pass)
 *   5. Admin: threshold update flow
 *   6. Threshold change resets eligibility
 *   7. Multiple verifications increment counter correctly
 *   8. Privacy: private data never appears in public state
 */

import {
  ZkCredSimulator,
  createWitnessProvider,
  generateSalt,
  saltToHex,
  formatIncomeCents,
  DEFAULT_MIN_CREDIT_SCORE,
  DEFAULT_MIN_ANNUAL_INCOME,
  type ZkCredPrivateWitness,
} from "../src/api.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWitness(creditScore: number, annualIncome: bigint): ZkCredPrivateWitness {
  return {
    creditScore,
    annualIncome,
    userSalt: new Uint8Array(32).fill(42), // deterministic salt for tests
  };
}

function makeContract() {
  return new ZkCredSimulator({
    minCreditScore: DEFAULT_MIN_CREDIT_SCORE, // 700
    minAnnualIncome: DEFAULT_MIN_ANNUAL_INCOME, // $50,000 (5_000_000n cents)
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ZkCred Contract — Public Ledger State", () => {
  test("initial state has correct thresholds and isEligible=false", () => {
    const contract = makeContract();
    const state = contract.getPublicState();

    expect(state.minCreditScore).toBe(700);
    expect(state.minAnnualIncome).toBe(5_000_000n);
    expect(state.isEligible).toBe(false);
    expect(state.verificationCount).toBe(0n);
  });
});

describe("ZkCred Contract — verifyEligibility Circuit", () => {
  // ── Test 1: Eligible User ─────────────────────────────────────────────────
  test("1. eligible: score AND income both above thresholds → isEligible=true", async () => {
    const contract = makeContract();
    const witness = makeWitness(
      750, // credit score: 750 ≥ 700 ✓
      7_500_000n // income: $75,000 ≥ $50,000 ✓
    );

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(true);
    expect(result.proofGenerated).toBe(true);
    expect(contract.getPublicState().isEligible).toBe(true);
  });

  // ── Test 2: Ineligible — Credit Score Too Low ─────────────────────────────
  test("2. ineligible: credit score BELOW threshold → isEligible=false", async () => {
    const contract = makeContract();
    const witness = makeWitness(
      620, // credit score: 620 < 700 ✗
      7_500_000n // income: $75,000 — meets threshold ✓
    );

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
    expect(contract.getPublicState().isEligible).toBe(false);
  });

  // ── Test 3: Ineligible — Income Too Low ──────────────────────────────────
  test("3. ineligible: annual income BELOW threshold → isEligible=false", async () => {
    const contract = makeContract();
    const witness = makeWitness(
      800, // credit score: 800 — meets threshold ✓
      3_000_000n // income: $30,000 < $50,000 ✗
    );

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
    expect(contract.getPublicState().isEligible).toBe(false);
  });

  // ── Test 4: Boundary — Exactly AT Threshold ───────────────────────────────
  test("4. boundary: exactly at threshold values → isEligible=true", async () => {
    const contract = makeContract();
    const witness = makeWitness(
      700, // credit score: exactly 700 = 700 ✓ (>= is inclusive)
      5_000_000n // income: exactly $50,000 = $50,000 ✓ (>= is inclusive)
    );

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(true);
    expect(contract.getPublicState().isEligible).toBe(true);
  });

  // ── Test 5: Both Below Threshold ─────────────────────────────────────────
  test("5. ineligible: both score AND income below thresholds → isEligible=false", async () => {
    const contract = makeContract();
    const witness = makeWitness(
      500, // credit score: 500 < 700 ✗
      1_000_000n // income: $10,000 < $50,000 ✗
    );

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
  });

  // ── Test 6: Verification Count Increments ────────────────────────────────
  test("6. verification counter increments on each call", async () => {
    const contract = makeContract();

    expect(contract.getPublicState().verificationCount).toBe(0n);

    await contract.verifyEligibility(makeWitness(750, 7_500_000n));
    expect(contract.getPublicState().verificationCount).toBe(1n);

    await contract.verifyEligibility(makeWitness(620, 3_000_000n));
    expect(contract.getPublicState().verificationCount).toBe(2n);

    await contract.verifyEligibility(makeWitness(700, 5_000_000n));
    expect(contract.getPublicState().verificationCount).toBe(3n);
  });

  // ── Test 7: State Changes Are Reflected Correctly ─────────────────────────
  test("7. state transitions from ineligible to eligible on re-verification", async () => {
    const contract = makeContract();

    // First verify as ineligible
    await contract.verifyEligibility(makeWitness(620, 3_000_000n));
    expect(contract.getPublicState().isEligible).toBe(false);

    // Re-verify with better credentials
    await contract.verifyEligibility(makeWitness(780, 8_000_000n));
    expect(contract.getPublicState().isEligible).toBe(true);
  });
});

describe("ZkCred Contract — updateThresholds Circuit", () => {
  // ── Test 8: Admin Updates Thresholds ─────────────────────────────────────
  test("8. admin can update minimum thresholds", () => {
    const contract = makeContract();

    contract.updateThresholds(750, 10_000_000n);

    const state = contract.getPublicState();
    expect(state.minCreditScore).toBe(750);
    expect(state.minAnnualIncome).toBe(10_000_000n);
  });

  // ── Test 9: Threshold Update Resets Eligibility ───────────────────────────
  test("9. updating thresholds resets isEligible to false", async () => {
    const contract = makeContract();

    // Mark eligible first
    await contract.verifyEligibility(makeWitness(750, 7_500_000n));
    expect(contract.getPublicState().isEligible).toBe(true);

    // Raise thresholds — should reset eligibility
    contract.updateThresholds(850, 15_000_000n);
    expect(contract.getPublicState().isEligible).toBe(false);
  });

  // ── Test 10: After Threshold Update, Old "Eligible" May Become Ineligible ─
  test("10. user who was eligible fails verification with raised thresholds", async () => {
    const contract = makeContract();

    // User passes initial thresholds (700 score, $50k income)
    const result1 = await contract.verifyEligibility(makeWitness(720, 6_000_000n));
    expect(result1.eligible).toBe(true);

    // Admin raises bar significantly
    contract.updateThresholds(800, 12_000_000n);

    // Same user now fails (score 720 < new threshold 800)
    const result2 = await contract.verifyEligibility(makeWitness(720, 6_000_000n));
    expect(result2.eligible).toBe(false);
  });
});

describe("ZkCred Contract — Privacy Guarantees", () => {
  // ── Test 11: Private Data Never Appears in Public State ───────────────────
  test("11. private witness values never appear in public ledger state", async () => {
    const contract = makeContract();
    const privateScore = 742;
    const privateIncome = 8_765_432n;

    await contract.verifyEligibility(makeWitness(privateScore, privateIncome));

    const publicState = contract.getPublicState();
    const publicStateString = JSON.stringify(publicState, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    );

    // The raw private values must NOT appear in the public state
    expect(publicStateString).not.toContain(privateScore.toString());
    expect(publicStateString).not.toContain(privateIncome.toString());
  });

  // ── Test 12: Witness Provider Returns Correct Values ─────────────────────
  test("12. witness provider correctly wraps private data for circuit consumption", () => {
    const privateData = {
      creditScore: 760,
      annualIncome: 9_000_000n,
      userSalt: new Uint8Array(32).fill(99),
    };

    const provider = createWitnessProvider(privateData);

    expect(provider.getPrivateCreditScore()).toBe(760);
    expect(provider.getPrivateAnnualIncome()).toBe(9_000_000n);
    expect(provider.getPrivateSalt()).toBe(privateData.userSalt);
  });
});

describe("ZkCred Utilities", () => {
  test("formatIncomeCents correctly formats USD amounts", () => {
    expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
    expect(formatIncomeCents(10_000_000n)).toBe("$100,000");
    expect(formatIncomeCents(1_000_000n)).toBe("$10,000");
  });

  test("saltToHex produces 64-character hex string from 32-byte array", () => {
    const salt = new Uint8Array(32).fill(0xab);
    const hex = saltToHex(salt);
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.startsWith("ab")).toBe(true);
  });
});
