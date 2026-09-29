/**
 * V3 issuer-side signing primitives. Keep this module in a trusted issuer
 * service only; never bundle it into the browser app or expose the issuer key.
 * The issuer must authenticate each claim before calling signV3Credential.
 */
import { randomBytes } from "node:crypto";
import { ecMulGenerator, type JubjubPoint } from "@midnight-ntwrk/compact-runtime";
import { pureCircuits } from "./managed-v3/contract/index.js";

export const JUBJUB_ORDER = 6554484396890773809930967563523245729705921265872317281365359162392183254199n;
export const SCHNORR_CHALLENGE_MODULUS = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

export interface V3IssuerSignature {
  announcement: JubjubPoint;
  response: bigint;
}

export function deriveIssuerPublicKey(issuerSecret: bigint): JubjubPoint {
  if (issuerSecret <= 0n || issuerSecret >= JUBJUB_ORDER) {
    throw new RangeError("Issuer secret must be a non-zero Jubjub scalar in the subgroup range.");
  }
  return ecMulGenerator(issuerSecret);
}

function secureRandomScalar(): bigint {
  for (;;) {
    const candidate = BigInt(`0x${randomBytes(32).toString("hex")}`);
    if (candidate > 0n && candidate < JUBJUB_ORDER) return candidate;
  }
}

/**
 * Sign claims already authenticated by the trusted issuer. `holderBinding` is
 * computed by the holder from their private secret; the issuer never receives
 * or learns that secret. applicationId must be the relying party's exact
 * 32-byte context, including the app/contract/purpose domain.
 */
export function signV3Credential(input: {
  issuerSecret: bigint;
  creditScore: bigint;
  annualIncome: bigint;
  age: bigint;
  holderBinding: bigint;
  applicationId: Uint8Array;
}): V3IssuerSignature {
  if (input.applicationId.length !== 32) throw new RangeError("applicationId must be 32 bytes.");
  if (input.creditScore < 0n || input.creditScore > 0xffff_ffffn) throw new RangeError("creditScore is outside Uint<32>.");
  if (input.annualIncome < 0n || input.annualIncome > 0xffff_ffff_ffff_ffffn) throw new RangeError("annualIncome is outside Uint<64>.");
  if (input.age < 0n || input.age > 0xffff_ffffn) throw new RangeError("age is outside Uint<32>.");
  const issuerPublicKey = deriveIssuerPublicKey(input.issuerSecret);
  const message = pureCircuits.attestationMessage(
    input.creditScore,
    input.annualIncome,
    input.age,
    input.holderBinding,
    input.applicationId,
  );
  const nonce = secureRandomScalar();
  const announcement = ecMulGenerator(nonce);
  const fullChallenge = pureCircuits.schnorrChallenge(
    announcement.x,
    announcement.y,
    issuerPublicKey.x,
    issuerPublicKey.y,
    message,
  );
  const challenge = fullChallenge % SCHNORR_CHALLENGE_MODULUS;
  const response = (nonce + challenge * input.issuerSecret) % JUBJUB_ORDER;
  return { announcement, response };
}

/** Witness helper required by the in-circuit Schnorr challenge reduction. */
export function schnorrReductionWitness(fullChallenge: bigint): [bigint, bigint] {
  const quotient = fullChallenge / SCHNORR_CHALLENGE_MODULUS;
  const remainder = fullChallenge % SCHNORR_CHALLENGE_MODULUS;
  if (quotient >= 116n) throw new RangeError("Schnorr challenge quotient is out of range.");
  return [quotient, remainder];
}
