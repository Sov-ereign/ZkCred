import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  getSchnorrReduction(context: __compactRuntime.WitnessContext<Ledger, PS>,
                      challengeHash_0: bigint): [PS, [bigint, bigint]];
  getPrivateCreditScore(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateAnnualIncome(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateAge(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  getPrivateSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getPrivateHolderSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  getPrivateCredentialSignature(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { announcement: __compactRuntime.JubjubPoint,
                                                                                              response: bigint
                                                                                            }];
  getPrivateAdminKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminKeyHash_0: Uint8Array,
             issuerPublicKey_0: __compactRuntime.JubjubPoint): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    applicationId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkNullifierEligible(context: __compactRuntime.CircuitContext<PS>,
                         nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  getEligibilityStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminKeyHash_0: Uint8Array,
             issuerPublicKey_0: __compactRuntime.JubjubPoint): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    applicationId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkNullifierEligible(context: __compactRuntime.CircuitContext<PS>,
                         nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
  getEligibilityStatus(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  holderBinding(holderSecret_0: Uint8Array): bigint;
  eligibilityNullifier(salt_0: Uint8Array,
                       holderSecret_0: Uint8Array,
                       applicationId_0: Uint8Array): Uint8Array;
  attestationMessage(creditScore_0: bigint,
                     annualIncome_0: bigint,
                     age_0: bigint,
                     boundHolder_0: bigint,
                     applicationId_0: Uint8Array): bigint[];
  schnorrChallenge(annX_0: bigint,
                   annY_0: bigint,
                   issuerKeyX_0: bigint,
                   issuerKeyY_0: bigint,
                   message_0: bigint[]): bigint;
}

export type Circuits<PS> = {
  holderBinding(context: __compactRuntime.CircuitContext<PS>,
                holderSecret_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  eligibilityNullifier(context: __compactRuntime.CircuitContext<PS>,
                       salt_0: Uint8Array,
                       holderSecret_0: Uint8Array,
                       applicationId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  attestationMessage(context: __compactRuntime.CircuitContext<PS>,
                     creditScore_0: bigint,
                     annualIncome_0: bigint,
                     age_0: bigint,
                     boundHolder_0: bigint,
                     applicationId_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint[]>;
  schnorrChallenge(context: __compactRuntime.CircuitContext<PS>,
                   annX_0: bigint,
                   annY_0: bigint,
                   issuerKeyX_0: bigint,
                   issuerKeyY_0: bigint,
                   message_0: bigint[]): __compactRuntime.CircuitResults<PS, bigint>;
  initialize(context: __compactRuntime.CircuitContext<PS>,
             creditScoreThreshold_0: bigint,
             annualIncomeThreshold_0: bigint,
             ageThreshold_0: bigint,
             adminKeyHash_0: Uint8Array,
             issuerPublicKey_0: __compactRuntime.JubjubPoint): __compactRuntime.CircuitResults<PS, []>;
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    applicationId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  updateThresholds(context: __compactRuntime.CircuitContext<PS>,
                   newMinCreditScore_0: bigint,
                   newMinAnnualIncome_0: bigint,
                   newMinAge_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  checkNullifierEligible(context: __compactRuntime.CircuitContext<PS>,
                         nullifier_0: Uint8Array): __compactRuntime.CircuitResults<PS, boolean>;
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
  eligibleNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly trustedIssuerKey: __compactRuntime.JubjubPoint;
  readonly initialized: boolean;
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
