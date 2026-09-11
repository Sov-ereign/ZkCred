/**
 * ZkCred (AegisID) — Runtime Compact Test Suite
 * Level 3 — Option 2: Age / Eligibility Gate
 *
 * Executes tests against genuine Midnight contract integration layer and Compact runtime logic.
 * Tests PLONK ZK proof execution, Option 2 Age Gate, salt commitment, admin authorization, and indexer reads.
 *
 * Run with: npm test
 */

import {
  createMidnightProviders,
  createWitnessCallbacks,
  deployZkCredContract,
  executeVerifyEligibilityCircuit,
  executeUpdateThresholdsCircuit,
  fetchLedgerStateFromIndexer,
  deriveSaltCommitment,
  saltToHex,
  formatIncomeCents,
  DEFAULT_MIN_CREDIT_SCORE,
  DEFAULT_MIN_ANNUAL_INCOME,
  DEFAULT_MIN_AGE,
  type PrivateWitnessData,
} from "../src/api.js";

// ─── Test Setup Helpers ───────────────────────────────────────────────────────

function makeAdminKey(fillByte: number = 1): Uint8Array {
  const key = new Uint8Array(32);
  key.fill(fillByte);
  return key;
}

function makeWitness(
  creditScore: number,
  annualIncome: bigint,
  age: number = 24,
  saltByte: number = 42
): PrivateWitnessData {
  const salt = new Uint8Array(32);
  salt.fill(saltByte);
  return {
    creditScore,
    annualIncome,
    age,
    userSalt: salt,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ZkCred Runtime Contract — Initialization & Deployment", () => {
  test("1. deployZkCredContract initializes contract state with admin authorization and thresholds", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey(0xaa);

    const deployment = await deployZkCredContract(providers, {
      minCreditScore: DEFAULT_MIN_CREDIT_SCORE,
      minAnnualIncome: DEFAULT_MIN_ANNUAL_INCOME,
      minAge: DEFAULT_MIN_AGE,
      adminKey,
    });

    expect(deployment.contractAddress).toMatch(/^0x02[0-9a-f]{62}$/);
    expect(deployment.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);

    const ledger = deployment.ledgerState;
    expect(ledger.minCreditScore).toBe(700);
    expect(ledger.minAnnualIncome).toBe(5_000_000n);
    expect(ledger.minAge).toBe(21);
    expect(ledger.isEligible).toBe(false);
    expect(ledger.verificationCount).toBe(0n);
    expect(ledger.admin).toEqual(adminKey);
    expect(ledger.lastCommitment).toHaveLength(32);
  });
});

describe("ZkCred Runtime Contract — verifyEligibility Circuit Execution", () => {
  test("2. eligible user (score >= 700, income >= $50k, age >= 21) evaluates isEligible = true and updates salt commitment", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const witness = makeWitness(750, 7_500_000n, 24); // 750 >= 700, $75k >= $50k, 24 >= 21
    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      witness,
      deployment.ledgerState
    );

    expect(result.eligible).toBe(true);
    expect(result.newVerificationCount).toBe(1n);
    expect(result.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.proofServerStatus).toContain("PLONK proof server");

    const expectedCommitment = deriveSaltCommitment(witness.userSalt);
    expect(result.lastCommitment).toEqual(expectedCommitment);
  });

  test("3. Option 2 Age Gate failure: under-age user (age < 21) fails even with high credit score & income", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const witness = makeWitness(850, 15_000_000n, 19); // Under-age: 19 < 21 ✗
    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      witness,
      deployment.ledgerState
    );

    expect(result.eligible).toBe(false);
  });

  test("4. ineligible: credit score BELOW threshold → isEligible = false", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const witness = makeWitness(620, 7_500_000n, 25); // 620 < 700 ✗
    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      witness,
      deployment.ledgerState
    );

    expect(result.eligible).toBe(false);
  });

  test("5. ineligible: annual income BELOW threshold → isEligible = false", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const witness = makeWitness(800, 3_000_000n, 25); // $30k < $50k ✗
    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      witness,
      deployment.ledgerState
    );

    expect(result.eligible).toBe(false);
  });

  test("6. Option 2 boundary: exactly AT threshold values (score=700, income=$50k, age=21) → passes", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const witness = makeWitness(700, 5_000_000n, 21); // Exact boundary match
    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      witness,
      deployment.ledgerState
    );

    expect(result.eligible).toBe(true);
  });

  test("7. verification counter increments monotonically on sequential proof executions", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    let currentState = deployment.ledgerState;

    const res1 = await executeVerifyEligibilityCircuit(providers, deployment.contractAddress, makeWitness(750, 7_500_000n, 25, 10), currentState);
    expect(res1.newVerificationCount).toBe(1n);

    currentState = { ...currentState, verificationCount: res1.newVerificationCount };

    const res2 = await executeVerifyEligibilityCircuit(providers, deployment.contractAddress, makeWitness(620, 3_000_000n, 19, 20), currentState);
    expect(res2.newVerificationCount).toBe(2n);
  });
});

describe("ZkCred Runtime Contract — updateThresholds & Authorization", () => {
  test("8. authorized admin key can update minimum thresholds", async () => {
    const providers = await createMidnightProviders();
    const adminKey = makeAdminKey(0x55);
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey,
    });

    const result = await executeUpdateThresholdsCircuit(
      providers,
      deployment.contractAddress,
      adminKey,
      deployment.ledgerState,
      { minCreditScore: 750, minAnnualIncome: 10_000_000n, minAge: 25 }
    );

    expect(result.transactionHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.newLedgerState.minCreditScore).toBe(750);
    expect(result.newLedgerState.minAnnualIncome).toBe(10_000_000n);
    expect(result.newLedgerState.minAge).toBe(25);
    expect(result.newLedgerState.isEligible).toBe(false);
  });

  test("9. unauthorized admin key fails authorization check and rejects execution", async () => {
    const providers = await createMidnightProviders();
    const validAdminKey = makeAdminKey(0x55);
    const wrongAdminKey = makeAdminKey(0x99);

    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey: validAdminKey,
    });

    await expect(
      executeUpdateThresholdsCircuit(
        providers,
        deployment.contractAddress,
        wrongAdminKey,
        deployment.ledgerState,
        { minCreditScore: 750, minAnnualIncome: 10_000_000n, minAge: 25 }
      )
    ).rejects.toThrow("Unauthorized");
  });
});

describe("ZkCred Runtime Contract — Privacy Guarantees & Indexer Strictness", () => {
  test("10. private witness data (score, income, age, salt) NEVER leak into public ledger state", async () => {
    const providers = await createMidnightProviders();
    const deployment = await deployZkCredContract(providers, {
      minCreditScore: 700,
      minAnnualIncome: 5_000_000n,
      minAge: 21,
      adminKey: makeAdminKey(),
    });

    const privateScore = 789;
    const privateIncome = 12_345_678n;
    const privateAge = 97;
    const privateWitness = makeWitness(privateScore, privateIncome, privateAge);

    const result = await executeVerifyEligibilityCircuit(
      providers,
      deployment.contractAddress,
      privateWitness,
      deployment.ledgerState
    );

    const ledgerString = JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v));
    expect(ledgerString).not.toContain(privateScore.toString());
    expect(ledgerString).not.toContain(privateIncome.toString());
    expect(ledgerString).not.toContain(privateAge.toString());
  });

  test("11. witness callbacks provider correctly isolates private witnesses in client memory", () => {
    const privateData: PrivateWitnessData = {
      creditScore: 760,
      annualIncome: 9_000_000n,
      age: 26,
      userSalt: new Uint8Array(32).fill(99),
      adminKey: makeAdminKey(77),
    };

    const callbacks = createWitnessCallbacks(privateData);

    expect(callbacks.getPrivateCreditScore()).toBe(760);
    expect(callbacks.getPrivateAnnualIncome()).toBe(9_000_000n);
    expect(callbacks.getPrivateAge()).toBe(26);
    expect(callbacks.getPrivateSalt()).toEqual(privateData.userSalt);
    expect(callbacks.getPrivateAdminKey()).toEqual(privateData.adminKey);
  });

  test("12. fetchLedgerStateFromIndexer throws clean error on unreachable indexer URL without state fabrication", async () => {
    const invalidUrl = "https://invalid-indexer.example.com/api/v1/graphql";
    const testAddr = "0x02" + "a".repeat(64);
    await expect(fetchLedgerStateFromIndexer(testAddr, invalidUrl)).rejects.toThrow();
  }, 15000);
});

describe("ZkCred Utilities", () => {
  test("13. formatIncomeCents correctly formats USD currency amounts", () => {
    expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  });

  test("14. saltToHex produces valid 64-character hex string", () => {
    const salt = new Uint8Array(32).fill(0xab);
    expect(saltToHex(salt)).toBe("ab".repeat(32));
    expect(saltToHex(salt)).toHaveLength(64);
  });
});
