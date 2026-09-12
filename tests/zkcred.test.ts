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
  return { creditScore: 760, annualIncome: 9_000_000n, age: 26, userSalt: new Uint8Array(32).fill(0x7a), adminKey: new Uint8Array(32).fill(0x55) };
}

describe("ZkCred Compact privacy model", () => {
  test("declares score, income, age, salt and admin as private witnesses", async () => {
    const source = await readFile(contractPath, "utf8");
    for (const name of ["getPrivateCreditScore", "getPrivateAnnualIncome", "getPrivateAge", "getPrivateSalt", "getPrivateAdminKey"]) expect(source).toContain(`witness ${name}`);
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
    expect(JSON.stringify(Object.keys(callbacks))).not.toContain("760");
  });

  test("strict indexer read rejects an unreachable endpoint rather than fabricating state", async () => {
    await expect(fetchLedgerStateFromIndexer("0x02" + "a".repeat(62), "http://127.0.0.1:1/graphql")).rejects.toThrow();
  });
});

describe("Generated Compact runtime", () => {
  test("executes the actual eligibility circuit and rejects a replayed salt", () => {
    const adminKey = new Uint8Array(32).fill(0x11);
    const salt = new Uint8Array(32).fill(0x22);
    const contract = new Contract({
      getPrivateCreditScore: (context: any) => [context.privateState, 760n],
      getPrivateAnnualIncome: (context: any) => [context.privateState, 9_000_000n],
      getPrivateAge: (context: any) => [context.privateState, 26n],
      getPrivateSalt: (context: any) => [context.privateState, salt],
      getPrivateAdminKey: (context: any) => [context.privateState, adminKey],
    });
    const initial = contract.initialState({
      initialPrivateState: {},
      initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
    });
    let context = createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
    context = contract.circuits.initialize(context, 700n, 5_000_000n, 21n, adminKey).context;
    context = contract.circuits.verifyEligibility(context).context;
    expect(contract.circuits.getEligibilityStatus(context).result).toBe(true);
    expect(() => contract.circuits.verifyEligibility(context)).toThrow("Credential salt already used");
  });

  test("rejects a threshold update signed with a non-admin private witness", () => {
    const adminKey = new Uint8Array(32).fill(0x11);
    const contract = new Contract({
      getPrivateCreditScore: (context: any) => [context.privateState, 760n],
      getPrivateAnnualIncome: (context: any) => [context.privateState, 9_000_000n],
      getPrivateAge: (context: any) => [context.privateState, 26n],
      getPrivateSalt: (context: any) => [context.privateState, new Uint8Array(32).fill(0x22)],
      getPrivateAdminKey: (context: any) => [context.privateState, new Uint8Array(32).fill(0x99)],
    });
    const initial = contract.initialState({
      initialPrivateState: {},
      initialZswapLocalState: { coinPublicKey: { bytes: new Uint8Array(32) }, currentIndex: 0n, inputs: [], outputs: [] },
    });
    let context = createCircuitContext(dummyContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
    context = contract.circuits.initialize(context, 700n, 5_000_000n, 21n, adminKey).context;
    expect(() => contract.circuits.updateThresholds(context, 720n, 6_000_000n, 25n)).toThrow("Unauthorized");
  });
});

test("formats cents and encodes an exact 32-byte salt", () => {
  expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  expect(saltToHex(new Uint8Array(32).fill(0xab))).toBe("ab".repeat(32));
});
