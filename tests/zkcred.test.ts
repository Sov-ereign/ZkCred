/** Tests for V2's threshold-only proof semantics; no issuer-authentication claim. */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createWitnessCallbacks, fetchLedgerStateFromIndexer, formatIncomeCents, saltToHex } from "../src/api.js";
import { Contract } from "../src/managed/contract/index.js";
import { createCircuitContext, dummyContractAddress } from "@midnight-ntwrk/compact-runtime";

const root = process.cwd();
const contractPath = join(root, "contract/src/zkcred.compact");
const adminKey = new Uint8Array(32).fill(0x11);
const salt = new Uint8Array(32).fill(0x22);

function makeContract(input: { score?: bigint; income?: bigint; age?: bigint; salt?: Uint8Array; admin?: Uint8Array } = {}) {
  return new Contract({
    getPrivateCreditScore: (ctx: any) => [ctx.privateState, input.score ?? 760n],
    getPrivateAnnualIncome: (ctx: any) => [ctx.privateState, input.income ?? 9_000_000n],
    getPrivateAge: (ctx: any) => [ctx.privateState, input.age ?? 26n],
    getPrivateSalt: (ctx: any) => [ctx.privateState, input.salt ?? salt],
    getPrivateAdminKey: (ctx: any) => [ctx.privateState, input.admin ?? adminKey],
  });
}

function initialContext(contract: Contract) {
  const initial = contract.initialState({
    initialPrivateState: {},
    initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
  });
  return createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
}

function initialize(contract: Contract, context = initialContext(contract)) {
  return contract.circuits.initialize(
    context, 700n, 5_000_000n, 21n, (contract as any)._persistentHash_1([adminKey]),
  ).context;
}

function nullifier(contract: Contract, value: Uint8Array) {
  const tag = new Uint8Array(32);
  tag.set(new TextEncoder().encode("zkcred:eligibility:nullifier:v1"));
  return (contract as any)._persistentHash_0([tag, value]) as Uint8Array;
}

describe("ZkCred V2 threshold-only contract", () => {
  test("declares only threshold, salt, and admin witnesses; issuer code is disabled", async () => {
    const source = await readFile(contractPath, "utf8");
    for (const name of ["getPrivateCreditScore", "getPrivateAnnualIncome", "getPrivateAge", "getPrivateSalt", "getPrivateAdminKey"]) {
      expect(source).toContain(`witness ${name}`);
    }
    expect(source).not.toMatch(/^\s*witness getPrivateIssuerKey/m);
    expect(source).not.toMatch(/^\s*export ledger issuerKeyHash/m);
    expect(source).toContain("Intentionally disabled from the V2 build");
    expect(source).toContain("does NOT authenticate age, score, or income");
  });

  test("keeps the raw salt private and uses domain-separated replay nullifiers", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).not.toMatch(/disclose\s*\(\s*salt\s*\)/);
    expect(source).toContain("usedSaltNullifiers");
    expect(source).toContain("persistentHash");
  });

  test("threshold proof discloses no raw attributes and records recipient-checkable outcome", async () => {
    const source = await readFile(contractPath, "utf8");
    const circuit = source.match(/export circuit verifyEligibility\(\): \[\] \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(circuit).toContain("eligibleNullifiers.insert");
    expect(circuit).not.toContain("disclose(creditScore)");
    expect(circuit).not.toContain("disclose(annualIncome)");
    expect(circuit).not.toContain("disclose(age)");
  });

  test("one-time initialization is atomic in the contract circuit", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).toContain("assert(!initialized");
    expect(source).toContain("initialized = disclose(true)");
  });

  test("executes threshold checks, records per-nullifier eligibility, and rejects salt replay", () => {
    const contract = makeContract();
    let context = initialize(contract);
    context = contract.circuits.verifyEligibility(context).context;
    expect(contract.circuits.getEligibilityStatus(context).result).toBe(true);
    expect(contract.circuits.checkNullifierEligible(context, nullifier(contract, salt)).result).toBe(true);
    expect(() => contract.circuits.verifyEligibility(context)).toThrow("Credential salt already used");
  });

  test("records an ineligible result without attributing it to another nullifier", () => {
    const contract = makeContract({ score: 500n });
    const context = contract.circuits.verifyEligibility(initialize(contract)).context;
    expect(contract.circuits.getEligibilityStatus(context).result).toBe(false);
    expect(contract.circuits.checkNullifierEligible(context, nullifier(contract, salt)).result).toBe(false);
  });

  test("rejects re-initialization", () => {
    const contract = makeContract();
    const context = initialize(contract);
    expect(() => initialize(contract, context)).toThrow("ZkCred: Contract already initialized");
  });
});

describe("Generated proof assets", () => {
  test.each(["verifyEligibility", "initialize", "updateThresholds"])("contains prover and ZKIR assets for %s", async (circuit) => {
    await expect(stat(join(root, `src/managed/keys/${circuit}.prover`))).resolves.toBeDefined();
    await expect(stat(join(root, `src/managed/zkir/${circuit}.bzkir`))).resolves.toBeDefined();
  });
});

describe("Private input boundary", () => {
  test("witness callbacks keep private values in closures", () => {
    const input = { creditScore: 760, annualIncome: 9_000_000n, age: 26, userSalt: salt, adminKey };
    const callbacks = createWitnessCallbacks(input);
    expect(callbacks.getPrivateCreditScore()).toBe(760);
    expect(callbacks.getPrivateAnnualIncome()).toBe(9_000_000n);
    expect(callbacks.getPrivateAge()).toBe(26);
    expect(callbacks.getPrivateSalt()).toEqual(salt);
    expect(JSON.stringify(Object.keys(callbacks))).not.toContain("760");
  });

  test("indexer helper rejects unreachable endpoints instead of fabricating state", async () => {
    await expect(fetchLedgerStateFromIndexer("0x02" + "a".repeat(62), "http://127.0.0.1:1/graphql")).rejects.toThrow();
  });
});

test("formats cents and encodes exact 32-byte salts", () => {
  expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  expect(saltToHex(new Uint8Array(32).fill(0xab))).toBe("ab".repeat(32));
});
