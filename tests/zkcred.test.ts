/**
 * Contract and privacy-boundary tests. They do not pretend to submit an
 * on-chain transaction: that requires a real unlocked Lace wallet.
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createWitnessCallbacks, fetchLedgerStateFromIndexer, formatIncomeCents, saltToHex, type PrivateWitnessData } from "../src/api.js";

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

  test("never discloses salt or stores a salt commitment in public state", async () => {
    const source = await readFile(contractPath, "utf8");
    expect(source).not.toMatch(/disclose\s*\(\s*_salt\s*\)/);
    expect(source).not.toContain("saltCommitment");
    expect(source).not.toContain("lastCommitment");
  });

  test("verifyEligibility discloses only the boolean and verification counter", async () => {
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

test("formats cents and encodes an exact 32-byte salt", () => {
  expect(formatIncomeCents(5_000_000n)).toBe("$50,000");
  expect(saltToHex(new Uint8Array(32).fill(0xab))).toBe("ab".repeat(32));
});
