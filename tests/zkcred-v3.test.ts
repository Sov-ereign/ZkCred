import {
  createCircuitContext,
  dummyContractAddress,
  ecMulGenerator,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, pureCircuits } from "../src/managed-v3/contract/index.js";

import {
  deriveIssuerPublicKey,
  schnorrReductionWitness,
  signV3Credential,
} from "../src/v3-issuer.js";

const adminSecret = new Uint8Array(32).fill(0x19);
const holderSecret = new Uint8Array(32).fill(0x42);
const salt = new Uint8Array(32).fill(0x53);
const appId = new Uint8Array(32).fill(0x64);
const issuerSecret = 123456789n;
const issuerPublicKey = deriveIssuerPublicKey(issuerSecret);

function signClaims(
  creditScore: bigint,
  annualIncome: bigint,
  age: bigint,
  secret = holderSecret,
  applicationId = appId,
) {
  const holderBinding = pureCircuits.holderBinding(secret);
  return signV3Credential({
    issuerSecret,
    creditScore,
    annualIncome,
    age,
    holderBinding,
    applicationId,
  });
}

function makeV3Contract(overrides: {
  creditScore?: bigint;
  annualIncome?: bigint;
  age?: bigint;
  holder?: Uint8Array;
  applicationId?: Uint8Array;
  signature?: ReturnType<typeof signClaims>;
} = {}) {
  const score = overrides.creditScore ?? 760n;
  const income = overrides.annualIncome ?? 9_000_000n;
  const age = overrides.age ?? 26n;
  const holder = overrides.holder ?? holderSecret;
  const app = overrides.applicationId ?? appId;
  const signed = overrides.signature ?? signClaims(score, income, age, holder, app);

  return new Contract({
    getSchnorrReduction: (ctx: any, hash: bigint) => [ctx.privateState, schnorrReductionWitness(hash)],
    getPrivateCreditScore: (ctx: any) => [ctx.privateState, score],
    getPrivateAnnualIncome: (ctx: any) => [ctx.privateState, income],
    getPrivateAge: (ctx: any) => [ctx.privateState, age],
    getPrivateSalt: (ctx: any) => [ctx.privateState, salt],
    getPrivateHolderSecret: (ctx: any) => [ctx.privateState, holder],
    getPrivateCredentialSignature: (ctx: any) => [ctx.privateState, {
      announcement: signed.announcement,
      response: signed.response,
    }],
    getPrivateAdminKey: (ctx: any) => [ctx.privateState, adminSecret],
  });
}

function initializedContext(contract: Contract, registeredIssuer = issuerPublicKey) {
  const initial = contract.initialState({
    initialPrivateState: {},
    initialZswapLocalState: {
      coinPublicKey: { bytes: new Uint8Array(32) },
      currentIndex: 0n,
      inputs: [],
      outputs: [],
    },
  });
  const context = createCircuitContext(
    dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState,
    initial.currentPrivateState,
  );
  const adminKeyHash = (contract as any)._persistentHash_2([adminSecret]);
  return contract.circuits.initialize(
    context, 700n, 5_000_000n, 21n, adminKeyHash, registeredIssuer,
  ).context;
}

describe("ZkCred V3 issuer attestations", () => {
  test("accepts signed threshold claims and records a holder/application-bound result", () => {
    const contract = makeV3Contract();
    const context = initializedContext(contract);
    const verified = contract.circuits.verifyEligibility(context, appId);
    const nullifier = pureCircuits.eligibilityNullifier(salt, holderSecret, appId);
    const wrongHolderNullifier = pureCircuits.eligibilityNullifier(
      salt, new Uint8Array(32).fill(0x77), appId,
    );
    const wrongAppNullifier = pureCircuits.eligibilityNullifier(
      salt, holderSecret, new Uint8Array(32).fill(0x75),
    );

    expect(contract.circuits.checkNullifierEligible(verified.context, nullifier).result).toBe(true);
    expect(contract.circuits.checkNullifierEligible(verified.context, wrongHolderNullifier).result).toBe(false);
    expect(contract.circuits.checkNullifierEligible(verified.context, wrongAppNullifier).result).toBe(false);
    expect(contract.circuits.getEligibilityStatus(verified.context).result).toBe(true);
    expect(() => contract.circuits.verifyEligibility(verified.context, appId))
      .toThrow("Credential salt already used for this holder and application");
  });

  test("rejects attributes changed after the issuer signature was made", () => {
    const signed = signClaims(760n, 9_000_000n, 26n);
    const contract = makeV3Contract({ creditScore: 761n, signature: signed });
    expect(() => contract.circuits.verifyEligibility(initializedContext(contract), appId))
      .toThrow("Invalid issuer signature");
  });

  test("rejects using a credential with a different holder secret", () => {
    const signed = signClaims(760n, 9_000_000n, 26n, holderSecret);
    const otherHolder = new Uint8Array(32).fill(0x77);
    const contract = makeV3Contract({ holder: otherHolder, signature: signed });
    expect(() => contract.circuits.verifyEligibility(initializedContext(contract), appId))
      .toThrow("Invalid issuer signature");
  });

  test("rejects using a credential for a different application id", () => {
    const signed = signClaims(760n, 9_000_000n, 26n, holderSecret, appId);
    const otherApp = new Uint8Array(32).fill(0x75);
    const contract = makeV3Contract({ applicationId: otherApp, signature: signed });
    expect(() => contract.circuits.verifyEligibility(initializedContext(contract), otherApp))
      .toThrow("Invalid issuer signature");
  });

  test("allows a separately signed credential for another application without reusing its result", () => {
    const contractA = makeV3Contract();
    const context = initializedContext(contractA);
    const afterA = contractA.circuits.verifyEligibility(context, appId).context;

    const appB = new Uint8Array(32).fill(0x75);
    const contractB = makeV3Contract({ applicationId: appB });
    const afterB = contractB.circuits.verifyEligibility(afterA, appB).context;
    const nullifierA = pureCircuits.eligibilityNullifier(salt, holderSecret, appId);
    const nullifierB = pureCircuits.eligibilityNullifier(salt, holderSecret, appB);

    expect(contractB.circuits.checkNullifierEligible(afterB, nullifierA).result).toBe(true);
    expect(contractB.circuits.checkNullifierEligible(afterB, nullifierB).result).toBe(true);
    expect(Buffer.from(nullifierA)).not.toEqual(Buffer.from(nullifierB));
  });

  test("rejects a signature made by a key other than the registered issuer", () => {
    const contract = makeV3Contract();
    const rogueIssuerKey = ecMulGenerator(987654321n);
    const context = initializedContext(contract, rogueIssuerKey);
    expect(() => contract.circuits.verifyEligibility(context, appId))
      .toThrow("Invalid issuer signature");
  });

  test("refuses an identity-point issuer public key at initialization", () => {
    const contract = makeV3Contract();
    expect(() => initializedContext(contract, ecMulGenerator(0n)))
      .toThrow("Issuer key cannot be the identity point");
  });

  test("does not add an ineligible signed claim to the relying-party eligibility set", () => {
    const contract = makeV3Contract({ creditScore: 500n });
    const context = initializedContext(contract);
    const result = contract.circuits.verifyEligibility(context, appId);
    const nullifier = pureCircuits.eligibilityNullifier(salt, holderSecret, appId);
    expect(contract.circuits.checkNullifierEligible(result.context, nullifier).result).toBe(false);
    expect(contract.circuits.getEligibilityStatus(result.context).result).toBe(false);
  });
});
