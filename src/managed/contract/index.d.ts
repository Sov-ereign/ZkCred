import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  getPrivateCreditScore(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateAnnualIncome(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateAge(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getPrivateAdminKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminAddress_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEligibilityStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminAddress_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEligibilityStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminAddress_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  getEligibilityStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  readonly minCreditScore: bigint;
  readonly minAnnualIncome: bigint;
  readonly minAge: bigint;
  readonly isEligible: boolean;
  readonly verificationCount: bigint;
  readonly admin: Uint8Array;
  usedSaltNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
