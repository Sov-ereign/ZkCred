/**
 * ZkCred (AegisID) — Test Suite
 * Level 3 — Option 2: Age / Eligibility Gate
 *
 * Tests the contract circuit logic defined in zkcred.compact.
 * Verifies that Age, Credit Score, and Income thresholds are evaluated inside ZK circuits.
 *
 * Run with: npm test
 */

import { ZkCredSimulator } from "../src/mock/simulator.js";
import {
  createWitnessProvider,
  saltToHex,
  formatIncomeCents,
  DEFAULT_MIN_CREDIT_SCORE,
  DEFAULT_MIN_ANNUAL_INCOME,
  DEFAULT_MIN_AGE,
  type ZkCredPrivateWitness,
} from "../src/api.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWitness(
  creditScore: number,
  annualIncome: bigint,
  age: number = 24
): ZkCredPrivateWitness {
  return {
    creditScore,
    annualIncome,
    age,
    userSalt: new Uint8Array(32).fill(42),
  };
}

function makeContract() {
  return new ZkCredSimulator({
    minCreditScore: DEFAULT_MIN_CREDIT_SCORE, // 700
    minAnnualIncome: DEFAULT_MIN_ANNUAL_INCOME, // $50,000
    minAge: DEFAULT_MIN_AGE, // 21 (Option 2 Age Gate)
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ZkCred Contract — Option 2 Age & Eligibility Gate State", () => {
  test("initial state has correct thresholds including minAge=21", () => {
    const contract = makeContract();
    const state = contract.getPublicState();

    expect(state.minCreditScore).toBe(700);
    expect(state.minAnnualIncome).toBe(5_000_000n);
    expect(state.minAge).toBe(21);
    expect(state.isEligible).toBe(false);
    expect(state.verificationCount).toBe(0n);
  });
});

describe("ZkCred Contract — Option 2 verifyEligibility Circuit", () => {
  test("1. eligible: score, income, AND age all above thresholds → isEligible=true", async () => {
    const contract = makeContract();
    const witness = makeWitness(750, 7_500_000n, 24); // 750 >= 700, $75k >= $50k, 24 >= 21

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(true);
    expect(contract.getPublicState().isEligible).toBe(true);
  });

  test("2. Option 2 Age Gate failure: under-age user (age < 21) fails even with high credit score & income", async () => {
    const contract = makeContract();
    const witness = makeWitness(800, 10_000_000n, 19); // Under-age: 19 < 21 ✗

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
    expect(contract.getPublicState().isEligible).toBe(false);
  });

  test("3. ineligible: credit score BELOW threshold → isEligible=false", async () => {
    const contract = makeContract();
    const witness = makeWitness(620, 7_500_000n, 25); // 620 < 700 ✗

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
  });

  test("4. ineligible: annual income BELOW threshold → isEligible=false", async () => {
    const contract = makeContract();
    const witness = makeWitness(800, 3_000_000n, 25); // $30k < $50k ✗

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(false);
  });

  test("5. Option 2 boundary: exactly AT threshold values (score=700, income=$50k, age=21) → passes", async () => {
    const contract = makeContract();
    const witness = makeWitness(700, 5_000_000n, 21); // Exactly at boundaries

    const result = await contract.verifyEligibility(witness);

    expect(result.eligible).toBe(true);
  });

  test("6. verification counter increments on each circuit call", async () => {
    const contract = makeContract();

    expect(contract.getPublicState().verificationCount).toBe(0n);

    await contract.verifyEligibility(makeWitness(750, 7_500_000n, 25));
    expect(contract.getPublicState().verificationCount).toBe(1n);

    await contract.verifyEligibility(makeWitness(620, 3_000_000n, 19));
    expect(contract.getPublicState().verificationCount).toBe(2n);
  });

  test("7. state transitions from ineligible to eligible on re-verification", async () => {
    const contract = makeContract();

    // Under-age initially
    await contract.verifyEligibility(makeWitness(750, 7_500_000n, 19));
    expect(contract.getPublicState().isEligible).toBe(false);

    // Re-verify after reaching age threshold
    await contract.verifyEligibility(makeWitness(750, 7_500_000n, 21));
    expect(contract.getPublicState().isEligible).toBe(true);
  });
});

describe("ZkCred Contract — updateThresholds Circuit", () => {
  test("8. admin can update minimum thresholds including minAge", () => {
    const contract = makeContract();

    contract.updateThresholds(750, 10_000_000n, 25);

    const state = contract.getPublicState();
    expect(state.minCreditScore).toBe(750);
    expect(state.minAnnualIncome).toBe(10_000_000n);
    expect(state.minAge).toBe(25);
  });

  test("9. updating thresholds resets isEligible to false", async () => {
    const contract = makeContract();

    await contract.verifyEligibility(makeWitness(750, 7_500_000n, 22));
    expect(contract.getPublicState().isEligible).toBe(true);

    contract.updateThresholds(850, 15_000_000n, 25);
    expect(contract.getPublicState().isEligible).toBe(false);
  });
});

describe("ZkCred Contract — Privacy Guarantees", () => {
  test("10. private witness values (score, income, age) NEVER appear in public ledger state", async () => {
    const contract = makeContract();
    const privateScore = 742;
    const privateIncome = 8_765_432n;
    const privateAge = 27;

    await contract.verifyEligibility(makeWitness(privateScore, privateIncome, privateAge));

    const publicState = contract.getPublicState();
    const publicStateString = JSON.stringify(publicState, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    );

    expect(publicStateString).not.toContain(privateScore.toString());
    expect(publicStateString).not.toContain(privateIncome.toString());
    expect(publicStateString).not.toContain(privateAge.toString());
  });

  test("11. witness provider wraps private age alongside score and income", () => {
    const privateData = {
      creditScore: 760,
      annualIncome: 9_000_000n,
      age: 26,
      userSalt: new Uint8Array(32).fill(99),
    };

    const provider = createWitnessProvider(privateData);

    expect(provider.getPrivateCreditScore()).toBe(760);
    expect(provider.getPrivateAnnualIncome()).toBe(9_000_000n);
    expect(provider.getPrivateAge()).toBe(26);
    expect(provider.getPrivateSalt()).toBe(privateData.userSalt);
  });
});

describe("ZkCred Utilities", () => {
  test("formatIncomeCents correctly formats USD amounts", () => {
    expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  });

  test("saltToHex produces 64-character hex string", () => {
    const salt = new Uint8Array(32).fill(0xab);
    expect(saltToHex(salt)).toHaveLength(64);
  });
});
