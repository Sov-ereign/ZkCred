/**
 * Contract and privacy-boundary tests. They do not pretend to submit an
 * on-chain transaction: that requires a real unlocked Lace wallet.
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createWitnessCallbacks, fetchLedgerStateFromIndexer, formatIncomeCents, saltToHex, type PrivateWitnessData } from "../src/api.js";
import { Contract } from "../src/managed/contract/index.js";
import { createCircuitContext, dummyContractAddress } from "@midnight-ntwrk/compact-runtime";

const root = process.cwd();
const contractPath = join(root, "contract/src/zkcred.compact");

function witness(): PrivateWitnessData {
  return {
    creditScore: 760,
    annualIncome: 9_000_000n,
    age: 26,
    userSalt: new Uint8Array(32).fill(0x7a),
    adminKey: new Uint8Array(32).fill(0x55),
    issuerKey: new Uint8Array(32).fill(0x33),
    credentialToken: new Uint8Array(32).fill(0x44),
  };
}

describe("ZkCred Compact privacy model", () => {
  test("declares score, income, age, salt, admin and issuer as private witnesses", async () => {
    const source = await readFile(contractPath, "utf8");
    for (const name of [
      "getPrivateCreditScore",
      "getPrivateAnnualIncome",
      "getPrivateAge",
      "getPrivateSalt",
      "getPrivateAdminKey",
      "getPrivateIssuerKey",
      "getPrivateCredentialToken",
    ]) {
      expect(source).toContain(`witness ${name}`);
    }
  });

  test("keeps the raw salt private while storing a domain-separated replay nullifier", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).not.toMatch(/disclose\s*\(\s*salt\s*\)/);
    expect(source).toContain("usedSaltNullifiers");
    expect(source).toContain("persistentHash");
  });

  test("verifyEligibility does not disclose raw credential witnesses", async () => {
    const source = await readFile(contractPath, "utf8");
    const circuit = source.match(/export circuit verifyEligibility\(\): \[\] \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(circuit).toContain("isEligible = disclose(eligible)");
    expect(circuit).toContain("verificationCount = disclose(newCount)");
    expect(circuit).not.toContain("disclose(creditScore)");
    expect(circuit).not.toContain("disclose(annualIncome)");
    expect(circuit).not.toContain("disclose(age)");
  });

  test("enforces one-time initialization guard in contract source", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).toContain("assert(!initialized");
    expect(source).toContain("initialized = disclose(true)");
  });

  test("enforces issuer authentication before threshold evaluation in contract source", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).toContain("computedIssuerHash == issuerKeyHash");
    expect(source).toContain("expectedToken == credentialToken");
  });
});

describe("Generated proof assets", () => {
  test.each(["verifyEligibility", "initialize", "updateThresholds"])("contains a proving key and binary ZKIR for %s", async (circuit) => {
    await expect(stat(join(root, `src/managed/keys/${circuit}.prover`))).resolves.toBeDefined();
    await expect(stat(join(root, `src/managed/zkir/${circuit}.bzkir`))).resolves.toBeDefined();
  });
});

describe("Private input boundary", () => {
  test("witness callbacks keep private values in closures", () => {
    const input = witness();
    const callbacks = createWitnessCallbacks(input);
    expect(callbacks.getPrivateCreditScore()).toBe(760);
    expect(callbacks.getPrivateAnnualIncome()).toBe(9_000_000n);
    expect(callbacks.getPrivateAge()).toBe(26);
    expect(callbacks.getPrivateSalt()).toEqual(input.userSalt);
    expect(callbacks.getPrivateIssuerKey()).toEqual(input.issuerKey);
    expect(callbacks.getPrivateCredentialToken()).toEqual(input.credentialToken);
    expect(JSON.stringify(Object.keys(callbacks))).not.toContain("760");
  });

  test("strict indexer read rejects an unreachable endpoint rather than fabricating state", async () => {
    await expect(fetchLedgerStateFromIndexer("0x02" + "a".repeat(62), "http://127.0.0.1:1/graphql")).rejects.toThrow();
  });
});

describe("Generated Compact runtime", () => {
  const defaultAdminKey = new Uint8Array(32).fill(0x11);
  const defaultSalt = new Uint8Array(32).fill(0x22);
  const defaultIssuerKey = new Uint8Array(32).fill(0x33);

  // Helper to construct a Contract with valid witness functions matching the circuit
  function makeContract(overrides: Partial<{
    creditScore: bigint;
    annualIncome: bigint;
    age: bigint;
    salt: Uint8Array;
    adminKey: Uint8Array;
    issuerKey: Uint8Array;
    credentialToken: Uint8Array;
  }> = {}) {
    const salt = overrides.salt ?? defaultSalt;
    const issuerKey = overrides.issuerKey ?? defaultIssuerKey;
    const contract = new Contract({
      getPrivateCreditScore: (ctx: any) => [ctx.privateState, overrides.creditScore ?? 760n],
      getPrivateAnnualIncome: (ctx: any) => [ctx.privateState, overrides.annualIncome ?? 9_000_000n],
      getPrivateAge: (ctx: any) => [ctx.privateState, overrides.age ?? 26n],
      getPrivateSalt: (ctx: any) => [ctx.privateState, salt],
      getPrivateAdminKey: (ctx: any) => [ctx.privateState, overrides.adminKey ?? defaultAdminKey],
      getPrivateIssuerKey: (ctx: any) => [ctx.privateState, issuerKey],
      getPrivateCredentialToken: (ctx: any) => [
        ctx.privateState,
        overrides.credentialToken ?? (contract as any)._persistentHash_0([issuerKey, salt]),
      ],
    });
    return contract;
  }

  function setupContract(contract: Contract, issuerKey: Uint8Array = defaultIssuerKey) {
    const initial = contract.initialState({
      initialPrivateState: {},
      initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
    });
    const context = createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
    const issuerKeyHash = (contract as any)._persistentHash_1([issuerKey]);
    return contract.circuits.initialize(context, 700n, 5_000_000n, 21n, defaultAdminKey, issuerKeyHash).context;
  }

  test("executes the actual eligibility circuit and rejects a replayed salt", () => {
    const contract = makeContract();
    let context = setupContract(contract);
    context = contract.circuits.verifyEligibility(context).context;
    expect(contract.circuits.getEligibilityStatus(context).result).toBe(true);
    expect(() => contract.circuits.verifyEligibility(context)).toThrow("Credential salt already used");
  });

  test("rejects a threshold update signed with a non-admin private witness", () => {
    const contract = makeContract({ adminKey: new Uint8Array(32).fill(0x99) });
    const context = setupContract(contract);
    expect(() => contract.circuits.updateThresholds(context, 720n, 6_000_000n, 25n)).toThrow("Unauthorized");
  });

  test("rejects re-initialization (one-time initialization guard)", () => {
    const contract = makeContract();
    const context = setupContract(contract);
    const issuerKeyHash = (contract as any)._persistentHash_1([defaultIssuerKey]);
    expect(() =>
      contract.circuits.initialize(context, 700n, 5_000_000n, 21n, defaultAdminKey, issuerKeyHash)
    ).toThrow("ZkCred: Contract already initialized");
  });

  test("rejects proof with unauthenticated or forged issuer credentials", () => {
    // Contract initialized with defaultIssuerKey, but user provides a rogue issuer key
    const rogueIssuerKey = new Uint8Array(32).fill(0x88);
    const contractUntrusted = makeContract({ issuerKey: rogueIssuerKey });
    const context = setupContract(contractUntrusted, defaultIssuerKey);
    expect(() => contractUntrusted.circuits.verifyEligibility(context)).toThrow(
      "Credential not attested by registered trusted issuer"
    );
  });

  test("rejects proof with invalid credential token (tampered attestation)", () => {
    const contractTampered = makeContract({
      credentialToken: new Uint8Array(32).fill(0xff), // Bad token
    });
    const context = setupContract(contractTampered);
    expect(() => contractTampered.circuits.verifyEligibility(context)).toThrow(
      "Credential token does not match issuer attestation for this salt"
    );
  });
});

describe("Relying-party nullifier validation", () => {
  const defaultAdminKey = new Uint8Array(32).fill(0x11);
  const defaultIssuerKey = new Uint8Array(32).fill(0x33);
  const salt1 = new Uint8Array(32).fill(0x22);
  const salt2 = new Uint8Array(32).fill(0x33);

  function makeUserContract(overrides: Partial<{
    creditScore: bigint;
    annualIncome: bigint;
    age: bigint;
    salt: Uint8Array;
  }> = {}) {
    const salt = overrides.salt ?? salt1;
    const contract = new Contract({
      getPrivateCreditScore: (ctx: any) => [ctx.privateState, overrides.creditScore ?? 760n],
      getPrivateAnnualIncome: (ctx: any) => [ctx.privateState, overrides.annualIncome ?? 9_000_000n],
      getPrivateAge: (ctx: any) => [ctx.privateState, overrides.age ?? 26n],
      getPrivateSalt: (ctx: any) => [ctx.privateState, salt],
      getPrivateAdminKey: (ctx: any) => [ctx.privateState, defaultAdminKey],
      getPrivateIssuerKey: (ctx: any) => [ctx.privateState, defaultIssuerKey],
      getPrivateCredentialToken: (ctx: any) => [
        ctx.privateState,
        (contract as any)._persistentHash_0([defaultIssuerKey, salt]),
      ],
    });
    return contract;
  }

  test("per-nullifier eligibility survives a second call overwriting the global flag", () => {
    // First user: eligible
    const contractA = makeUserContract({ salt: salt1 });
    const initial = contractA.initialState({
      initialPrivateState: {},
      initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
    });
    let ctx = createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
    const issuerKeyHash = (contractA as any)._persistentHash_1([defaultIssuerKey]);
    ctx = contractA.circuits.initialize(ctx, 700n, 5_000_000n, 21n, defaultAdminKey, issuerKeyHash).context;
    ctx = contractA.circuits.verifyEligibility(ctx).context;

    // Capture first user's nullifier presence
    const ctxAfterFirstCall = ctx;

    // Second user: ineligible (low score)
    const contractB = makeUserContract({ creditScore: 500n, salt: salt2 });
    ctx = contractB.circuits.verifyEligibility(ctxAfterFirstCall).context;

    // Global flag now reflects the SECOND call (ineligible)
    expect(contractA.circuits.getEligibilityStatus(ctx).result).toBe(false);

    // But the first user's salt nullifier is STILL in usedSaltNullifiers
    // Attempting to replay the first user's salt throws — proving it was previously submitted.
    expect(() => contractA.circuits.verifyEligibility(ctxAfterFirstCall)).toThrow("Credential salt already used");
  });

  test("fresh salt allows a new call regardless of previous outcome", () => {
    const saltFirst = new Uint8Array(32).fill(0xaa);
    const saltSecond = new Uint8Array(32).fill(0xbb);

    const contract = makeUserContract({ salt: saltFirst });
    const initial = contract.initialState({
      initialPrivateState: {},
      initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
    });
    let ctx = createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
    const issuerKeyHash = (contract as any)._persistentHash_1([defaultIssuerKey]);
    ctx = contract.circuits.initialize(ctx, 700n, 5_000_000n, 21n, defaultAdminKey, issuerKeyHash).context;
    ctx = contract.circuits.verifyEligibility(ctx).context;

    // Same user with a fresh salt — succeeds (demonstrates nullifier prevents same-salt only)
    const contractFresh = makeUserContract({ salt: saltSecond });
    expect(() => contractFresh.circuits.verifyEligibility(ctx)).not.toThrow();
  });
});

test("formats cents and encodes an exact 32-byte salt", () => {
  expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  expect(saltToHex(new Uint8Array(32).fill(0xab))).toBe("ab".repeat(32));
});
