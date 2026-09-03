/**
 * Generated TypeScript bindings by Compact Compiler v0.31.1
 * Target: Midnight Preprod Network
 * Contract: zkcred.compact
 * DO NOT EDIT MANUALLY.
 */

export interface LedgerState {
  minCreditScore: number;
  minAnnualIncome: bigint;
  minAge: number;
  isEligible: boolean;
  verificationCount: bigint;
}

export interface WitnessFunctions {
  getPrivateCreditScore: () => number;
  getPrivateAnnualIncome: () => bigint;
  getPrivateAge: () => number;
  getPrivateSalt: () => Uint8Array;
}

export const Circuits = {
  initialize: "initialize.circuit",
  verifyEligibility: "verifyEligibility.circuit",
  updateThresholds: "updateThresholds.circuit",
  getEligibilityStatus: "getEligibilityStatus.circuit",
} as const;

export const ContractInfo = {
  name: "ZkCred",
  compilerVersion: "0.31.1",
  languageVersion: "0.23",
  contractPath: "contract/src/zkcred.compact",
};
