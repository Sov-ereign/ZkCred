import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.16.0');

const _descriptor_0 = __compactRuntime.CompactTypeBoolean;

const _descriptor_1 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_2 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

const _descriptor_3 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_4 = __compactRuntime.CompactTypeJubjubPoint;

const _descriptor_5 = __compactRuntime.CompactTypeField;

const _descriptor_6 = new __compactRuntime.CompactTypeVector(5, _descriptor_5);

class _SchnorrSignature_0 {
  alignment() {
    return _descriptor_4.alignment().concat(_descriptor_5.alignment());
  }
  fromValue(value_0) {
    return {
      announcement: _descriptor_4.fromValue(value_0),
      response: _descriptor_5.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0.announcement).concat(_descriptor_5.toValue(value_0.response));
  }
}

const _descriptor_7 = new _SchnorrSignature_0();

const _descriptor_8 = new __compactRuntime.CompactTypeUnsignedInteger(127n, 1);

const _descriptor_9 = new __compactRuntime.CompactTypeUnsignedInteger(452312848583266388373324160190187140051835877600158453279131187530910662655n, 31);

class _tuple_0 {
  alignment() {
    return _descriptor_8.alignment().concat(_descriptor_9.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_8.fromValue(value_0),
      _descriptor_9.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_8.toValue(value_0[0]).concat(_descriptor_9.toValue(value_0[1]));
  }
}

const _descriptor_10 = new _tuple_0();

const _descriptor_11 = new __compactRuntime.CompactTypeVector(1, _descriptor_3);

const _descriptor_12 = new __compactRuntime.CompactTypeVector(2, _descriptor_3);

const _descriptor_13 = new __compactRuntime.CompactTypeVector(4, _descriptor_3);

class _SchnorrHashInput_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_5.alignment().concat(_descriptor_6.alignment()))));
  }
  fromValue(value_0) {
    return {
      ann_x: _descriptor_5.fromValue(value_0),
      ann_y: _descriptor_5.fromValue(value_0),
      pk_x: _descriptor_5.fromValue(value_0),
      pk_y: _descriptor_5.fromValue(value_0),
      msg: _descriptor_6.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.ann_x).concat(_descriptor_5.toValue(value_0.ann_y).concat(_descriptor_5.toValue(value_0.pk_x).concat(_descriptor_5.toValue(value_0.pk_y).concat(_descriptor_6.toValue(value_0.msg)))));
  }
}

const _descriptor_14 = new _SchnorrHashInput_0();

class _Either_0 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_3.alignment().concat(_descriptor_3.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_0.fromValue(value_0),
      left: _descriptor_3.fromValue(value_0),
      right: _descriptor_3.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.is_left).concat(_descriptor_3.toValue(value_0.left).concat(_descriptor_3.toValue(value_0.right)));
  }
}

const _descriptor_15 = new _Either_0();

const _descriptor_16 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_3.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_3.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.bytes);
  }
}

const _descriptor_17 = new _ContractAddress_0();

const _descriptor_18 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.getSchnorrReduction) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getSchnorrReduction');
    }
    if (typeof(witnesses_0.getPrivateCreditScore) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateCreditScore');
    }
    if (typeof(witnesses_0.getPrivateAnnualIncome) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateAnnualIncome');
    }
    if (typeof(witnesses_0.getPrivateAge) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateAge');
    }
    if (typeof(witnesses_0.getPrivateSalt) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateSalt');
    }
    if (typeof(witnesses_0.getPrivateHolderSecret) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateHolderSecret');
    }
    if (typeof(witnesses_0.getPrivateCredentialSignature) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateCredentialSignature');
    }
    if (typeof(witnesses_0.getPrivateAdminKey) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named getPrivateAdminKey');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      holderBinding(context, ...args_1) {
        return { result: pureCircuits.holderBinding(...args_1), context };
      },
      eligibilityNullifier(context, ...args_1) {
        return { result: pureCircuits.eligibilityNullifier(...args_1), context };
      },
      attestationMessage(context, ...args_1) {
        return { result: pureCircuits.attestationMessage(...args_1), context };
      },
      schnorrChallenge(context, ...args_1) {
        return { result: pureCircuits.schnorrChallenge(...args_1), context };
      },
      initialize: (...args_1) => {
        if (args_1.length !== 6) {
          throw new __compactRuntime.CompactError(`initialize: expected 6 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const creditScoreThreshold_0 = args_1[1];
        const annualIncomeThreshold_0 = args_1[2];
        const ageThreshold_0 = args_1[3];
        const adminKeyHash_0 = args_1[4];
        const issuerPublicKey_0 = args_1[5];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('initialize',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkcred-v3.compact line 83 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(creditScoreThreshold_0) === 'bigint' && creditScoreThreshold_0 >= 0n && creditScoreThreshold_0 <= 4294967295n)) {
          __compactRuntime.typeError('initialize',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkcred-v3.compact line 83 char 1',
                                     'Uint<0..4294967296>',
                                     creditScoreThreshold_0)
        }
        if (!(typeof(annualIncomeThreshold_0) === 'bigint' && annualIncomeThreshold_0 >= 0n && annualIncomeThreshold_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('initialize',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'zkcred-v3.compact line 83 char 1',
                                     'Uint<0..18446744073709551616>',
                                     annualIncomeThreshold_0)
        }
        if (!(typeof(ageThreshold_0) === 'bigint' && ageThreshold_0 >= 0n && ageThreshold_0 <= 4294967295n)) {
          __compactRuntime.typeError('initialize',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'zkcred-v3.compact line 83 char 1',
                                     'Uint<0..4294967296>',
                                     ageThreshold_0)
        }
        if (!(adminKeyHash_0.buffer instanceof ArrayBuffer && adminKeyHash_0.BYTES_PER_ELEMENT === 1 && adminKeyHash_0.length === 32)) {
          __compactRuntime.typeError('initialize',
                                     'argument 4 (argument 5 as invoked from Typescript)',
                                     'zkcred-v3.compact line 83 char 1',
                                     'Bytes<32>',
                                     adminKeyHash_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(creditScoreThreshold_0).concat(_descriptor_1.toValue(annualIncomeThreshold_0).concat(_descriptor_2.toValue(ageThreshold_0).concat(_descriptor_3.toValue(adminKeyHash_0).concat(_descriptor_4.toValue(issuerPublicKey_0))))),
            alignment: _descriptor_2.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment().concat(_descriptor_3.alignment().concat(_descriptor_4.alignment()))))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._initialize_0(context,
                                            partialProofData,
                                            creditScoreThreshold_0,
                                            annualIncomeThreshold_0,
                                            ageThreshold_0,
                                            adminKeyHash_0,
                                            issuerPublicKey_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      verifyEligibility: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`verifyEligibility: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const applicationId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('verifyEligibility',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkcred-v3.compact line 105 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(applicationId_0.buffer instanceof ArrayBuffer && applicationId_0.BYTES_PER_ELEMENT === 1 && applicationId_0.length === 32)) {
          __compactRuntime.typeError('verifyEligibility',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkcred-v3.compact line 105 char 1',
                                     'Bytes<32>',
                                     applicationId_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_3.toValue(applicationId_0),
            alignment: _descriptor_3.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._verifyEligibility_0(context,
                                                   partialProofData,
                                                   applicationId_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      updateThresholds: (...args_1) => {
        if (args_1.length !== 4) {
          throw new __compactRuntime.CompactError(`updateThresholds: expected 4 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const newMinCreditScore_0 = args_1[1];
        const newMinAnnualIncome_0 = args_1[2];
        const newMinAge_0 = args_1[3];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('updateThresholds',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkcred-v3.compact line 142 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(typeof(newMinCreditScore_0) === 'bigint' && newMinCreditScore_0 >= 0n && newMinCreditScore_0 <= 4294967295n)) {
          __compactRuntime.typeError('updateThresholds',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkcred-v3.compact line 142 char 1',
                                     'Uint<0..4294967296>',
                                     newMinCreditScore_0)
        }
        if (!(typeof(newMinAnnualIncome_0) === 'bigint' && newMinAnnualIncome_0 >= 0n && newMinAnnualIncome_0 <= 18446744073709551615n)) {
          __compactRuntime.typeError('updateThresholds',
                                     'argument 2 (argument 3 as invoked from Typescript)',
                                     'zkcred-v3.compact line 142 char 1',
                                     'Uint<0..18446744073709551616>',
                                     newMinAnnualIncome_0)
        }
        if (!(typeof(newMinAge_0) === 'bigint' && newMinAge_0 >= 0n && newMinAge_0 <= 4294967295n)) {
          __compactRuntime.typeError('updateThresholds',
                                     'argument 3 (argument 4 as invoked from Typescript)',
                                     'zkcred-v3.compact line 142 char 1',
                                     'Uint<0..4294967296>',
                                     newMinAge_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_2.toValue(newMinCreditScore_0).concat(_descriptor_1.toValue(newMinAnnualIncome_0).concat(_descriptor_2.toValue(newMinAge_0))),
            alignment: _descriptor_2.alignment().concat(_descriptor_1.alignment().concat(_descriptor_2.alignment()))
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._updateThresholds_0(context,
                                                  partialProofData,
                                                  newMinCreditScore_0,
                                                  newMinAnnualIncome_0,
                                                  newMinAge_0);
        partialProofData.output = { value: [], alignment: [] };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      checkNullifierEligible: (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`checkNullifierEligible: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const nullifier_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('checkNullifierEligible',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkcred-v3.compact line 158 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(nullifier_0.buffer instanceof ArrayBuffer && nullifier_0.BYTES_PER_ELEMENT === 1 && nullifier_0.length === 32)) {
          __compactRuntime.typeError('checkNullifierEligible',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'zkcred-v3.compact line 158 char 1',
                                     'Bytes<32>',
                                     nullifier_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: {
            value: _descriptor_3.toValue(nullifier_0),
            alignment: _descriptor_3.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._checkNullifierEligible_0(context,
                                                        partialProofData,
                                                        nullifier_0);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      },
      getEligibilityStatus: (...args_1) => {
        if (args_1.length !== 1) {
          throw new __compactRuntime.CompactError(`getEligibilityStatus: expected 1 argument (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.currentQueryContext != undefined)) {
          __compactRuntime.typeError('getEligibilityStatus',
                                     'argument 1 (as invoked from Typescript)',
                                     'zkcred-v3.compact line 164 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        const context = { ...contextOrig_0, gasCost: __compactRuntime.emptyRunningCost() };
        const partialProofData = {
          input: { value: [], alignment: [] },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = this._getEligibilityStatus_0(context, partialProofData);
        partialProofData.output = { value: _descriptor_0.toValue(result_0), alignment: _descriptor_0.alignment() };
        return { result: result_0, context: context, proofData: partialProofData, gasCost: context.gasCost };
      }
    };
    this.impureCircuits = {
      initialize: this.circuits.initialize,
      verifyEligibility: this.circuits.verifyEligibility,
      updateThresholds: this.circuits.updateThresholds,
      checkNullifierEligible: this.circuits.checkNullifierEligible,
      getEligibilityStatus: this.circuits.getEligibilityStatus
    };
    this.provableCircuits = {
      initialize: this.circuits.initialize,
      verifyEligibility: this.circuits.verifyEligibility,
      updateThresholds: this.circuits.updateThresholds,
      checkNullifierEligible: this.circuits.checkNullifierEligible,
      getEligibilityStatus: this.circuits.getEligibilityStatus
    };
  }
  initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('initialize', new __compactRuntime.ContractOperation());
    state_0.setOperation('verifyEligibility', new __compactRuntime.ContractOperation());
    state_0.setOperation('updateThresholds', new __compactRuntime.ContractOperation());
    state_0.setOperation('checkNullifierEligible', new __compactRuntime.ContractOperation());
    state_0.setOperation('getEligibilityStatus', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext(__compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(0n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(1n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(2n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(0n),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(3n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(4n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(5n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(6n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(7n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(8n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(({x: 0n, y: 1n})),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(9n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.currentPrivateState,
      currentZswapLocalState: context.currentZswapLocalState
    }
  }
  _transientHash_0(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_3, value_0);
    return result_0;
  }
  _transientHash_1(value_0) {
    const result_0 = __compactRuntime.transientHash(_descriptor_14, value_0);
    return result_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_12, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_13, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_11, value_0);
    return result_0;
  }
  _jubjubPointX_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointX(np_0);
    return result_0;
  }
  _jubjubPointY_0(np_0) {
    const result_0 = __compactRuntime.jubjubPointY(np_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecAdd(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.ecMul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.ecMulGenerator(b_0);
    return result_0;
  }
  _getSchnorrReduction_0(context, partialProofData, challengeHash_0) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getSchnorrReduction(witnessContext_0,
                                                                              challengeHash_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(Array.isArray(result_0) && result_0.length === 2  && typeof(result_0[0]) === 'bigint' && result_0[0] >= 0n && result_0[0] <= 127n && typeof(result_0[1]) === 'bigint' && result_0[1] >= 0n && result_0[1] <= 452312848583266388373324160190187140051835877600158453279131187530910662655n)) {
      __compactRuntime.typeError('getSchnorrReduction',
                                 'return value',
                                 'schnorr.compact line 27 char 3',
                                 '[Uint<0..128>, Uint<0..452312848583266388373324160190187140051835877600158453279131187530910662656>]',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_10.toValue(result_0),
      alignment: _descriptor_10.alignment()
    });
    return result_0;
  }
  _schnorrVerify_0(context, partialProofData, msg_0, signature_0, pk_0) {
    const __compact_pattern_tmp2_0 = signature_0;
    const announcement_0 = __compact_pattern_tmp2_0.announcement;
    const response_0 = __compact_pattern_tmp2_0.response;
    __compactRuntime.assert(!this._equal_0(announcement_0, ({x: 0n, y: 1n})),
                            'Invalid issuer signature announcement');
    __compactRuntime.assert(!this._equal_1(pk_0, ({x: 0n, y: 1n})),
                            'Invalid issuer public key');
    const cFull_0 = this._transientHash_1({ ann_x:
                                              this._jubjubPointX_0(announcement_0),
                                            ann_y:
                                              this._jubjubPointY_0(announcement_0),
                                            pk_x: this._jubjubPointX_0(pk_0),
                                            pk_y: this._jubjubPointY_0(pk_0),
                                            msg: msg_0 });
    const TWO_248_0 = 452312848583266388373324160190187140051835877600158453279131187530910662656n;
    const __compact_pattern_tmp1_0 = this._getSchnorrReduction_0(context,
                                                                 partialProofData,
                                                                 cFull_0);
    const q_0 = __compact_pattern_tmp1_0[0];
    const cTruncated_0 = __compact_pattern_tmp1_0[1];
    let t_0;
    __compactRuntime.assert((t_0 = q_0, t_0 < 116n),
                            'Schnorr quotient out of range');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.mulField(q_0,
                                                                                TWO_248_0),
                                                      cTruncated_0)
                            ===
                            cFull_0,
                            'Invalid challenge reduction');
    const c_0 = cTruncated_0;
    const lhs_0 = this._ecMulGenerator_0(response_0);
    const rhs_0 = this._ecAdd_0(announcement_0, this._ecMul_0(pk_0, c_0));
    __compactRuntime.assert(this._jubjubPointX_0(lhs_0)
                            ===
                            this._jubjubPointX_0(rhs_0)
                            &&
                            this._jubjubPointY_0(lhs_0)
                            ===
                            this._jubjubPointY_0(rhs_0),
                            'Invalid issuer signature');
    return [];
  }
  _schnorrChallenge_0(ann_x_0, ann_y_0, pk_x_0, pk_y_0, msg_0) {
    return this._transientHash_1({ ann_x: ann_x_0,
                                   ann_y: ann_y_0,
                                   pk_x: pk_x_0,
                                   pk_y: pk_y_0,
                                   msg: msg_0 });
  }
  _getPrivateCreditScore_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateCreditScore(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 4294967295n)) {
      __compactRuntime.typeError('getPrivateCreditScore',
                                 'return value',
                                 'zkcred-v3.compact line 21 char 1',
                                 'Uint<0..4294967296>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _getPrivateAnnualIncome_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateAnnualIncome(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('getPrivateAnnualIncome',
                                 'return value',
                                 'zkcred-v3.compact line 22 char 1',
                                 'Uint<0..18446744073709551616>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_1.toValue(result_0),
      alignment: _descriptor_1.alignment()
    });
    return result_0;
  }
  _getPrivateAge_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateAge(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'bigint' && result_0 >= 0n && result_0 <= 4294967295n)) {
      __compactRuntime.typeError('getPrivateAge',
                                 'return value',
                                 'zkcred-v3.compact line 23 char 1',
                                 'Uint<0..4294967296>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_2.toValue(result_0),
      alignment: _descriptor_2.alignment()
    });
    return result_0;
  }
  _getPrivateSalt_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateSalt(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('getPrivateSalt',
                                 'return value',
                                 'zkcred-v3.compact line 24 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_3.toValue(result_0),
      alignment: _descriptor_3.alignment()
    });
    return result_0;
  }
  _getPrivateHolderSecret_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateHolderSecret(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('getPrivateHolderSecret',
                                 'return value',
                                 'zkcred-v3.compact line 25 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_3.toValue(result_0),
      alignment: _descriptor_3.alignment()
    });
    return result_0;
  }
  _getPrivateCredentialSignature_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateCredentialSignature(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && true && typeof(result_0.response) === 'bigint' && result_0.response >= 0 && result_0.response <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('getPrivateCredentialSignature',
                                 'return value',
                                 'zkcred-v3.compact line 26 char 1',
                                 'struct SchnorrSignature<announcement: Opaque<"JubjubPoint">, response: Field>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_7.toValue(result_0),
      alignment: _descriptor_7.alignment()
    });
    return result_0;
  }
  _getPrivateAdminKey_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.currentQueryContext.state), context.currentPrivateState, context.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.getPrivateAdminKey(witnessContext_0);
    context.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('getPrivateAdminKey',
                                 'return value',
                                 'zkcred-v3.compact line 27 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_3.toValue(result_0),
      alignment: _descriptor_3.alignment()
    });
    return result_0;
  }
  _holderBinding_0(holderSecret_0) {
    const commitment_0 = this._persistentHash_0([new Uint8Array([122, 107, 99, 114, 101, 100, 58, 118, 51, 58, 104, 111, 108, 100, 101, 114, 45, 98, 105, 110, 100, 105, 110, 103, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                 holderSecret_0]);
    return this._transientHash_0(commitment_0);
  }
  _eligibilityNullifier_0(salt_0, holderSecret_0, applicationId_0) {
    const holderCommitment_0 = this._persistentHash_0([new Uint8Array([122, 107, 99, 114, 101, 100, 58, 118, 51, 58, 104, 111, 108, 100, 101, 114, 45, 98, 105, 110, 100, 105, 110, 103, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                       holderSecret_0]);
    return this._persistentHash_1([new Uint8Array([122, 107, 99, 114, 101, 100, 58, 118, 51, 58, 101, 108, 105, 103, 105, 98, 105, 108, 105, 116, 121, 45, 110, 117, 108, 108, 105, 102, 105, 101, 114, 0]),
                                   salt_0,
                                   holderCommitment_0,
                                   applicationId_0]);
  }
  _attestationMessage_0(creditScore_0,
                        annualIncome_0,
                        age_0,
                        boundHolder_0,
                        applicationId_0)
  {
    return [creditScore_0,
            annualIncome_0,
            age_0,
            boundHolder_0,
            this._transientHash_0(applicationId_0)];
  }
  _schnorrChallenge_1(annX_0, annY_0, issuerKeyX_0, issuerKeyY_0, message_0) {
    return this._schnorrChallenge_0(annX_0,
                                    annY_0,
                                    issuerKeyX_0,
                                    issuerKeyY_0,
                                    message_0);
  }
  _initialize_0(context,
                partialProofData,
                creditScoreThreshold_0,
                annualIncomeThreshold_0,
                ageThreshold_0,
                adminKeyHash_0,
                issuerPublicKey_0)
  {
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_18.toValue(9n),
                                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                                        { popeq: { cached: false,
                                                                                                   result: undefined } }]).value),
                            'ZkCred V3: Contract already initialized');
    __compactRuntime.assert(!this._equal_2(issuerPublicKey_0, ({x: 0n, y: 1n})),
                            'ZkCred V3: Issuer key cannot be the identity point');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(9n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(true),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(0n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(creditScoreThreshold_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(1n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(annualIncomeThreshold_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(2n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(ageThreshold_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(5n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(adminKeyHash_0),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(8n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_4.toValue(issuerPublicKey_0),
                                                                                              alignment: _descriptor_4.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(3n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = 0n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(4n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _verifyEligibility_0(context, partialProofData, applicationId_0) {
    const creditScore_0 = this._getPrivateCreditScore_0(context,
                                                        partialProofData);
    const annualIncome_0 = this._getPrivateAnnualIncome_0(context,
                                                          partialProofData);
    const age_0 = this._getPrivateAge_0(context, partialProofData);
    const salt_0 = this._getPrivateSalt_0(context, partialProofData);
    const holderSecret_0 = this._getPrivateHolderSecret_0(context,
                                                          partialProofData);
    const signature_0 = this._getPrivateCredentialSignature_0(context,
                                                              partialProofData);
    const boundHolder_0 = this._holderBinding_0(holderSecret_0);
    const signedClaims_0 = this._attestationMessage_0(creditScore_0,
                                                      annualIncome_0,
                                                      age_0,
                                                      boundHolder_0,
                                                      applicationId_0);
    this._schnorrVerify_0(context,
                          partialProofData,
                          signedClaims_0,
                          signature_0,
                          _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                    partialProofData,
                                                                                    [
                                                                                     { dup: { n: 0 } },
                                                                                     { idx: { cached: false,
                                                                                              pushPath: false,
                                                                                              path: [
                                                                                                     { tag: 'value',
                                                                                                       value: { value: _descriptor_18.toValue(8n),
                                                                                                                alignment: _descriptor_18.alignment() } }] } },
                                                                                     { popeq: { cached: false,
                                                                                                result: undefined } }]).value));
    const nullifier_0 = this._eligibilityNullifier_0(salt_0,
                                                     holderSecret_0,
                                                     applicationId_0);
    __compactRuntime.assert(!_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_18.toValue(6n),
                                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(nullifier_0),
                                                                                                                                               alignment: _descriptor_3.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Credential salt already used for this holder and application');
    const meetsScore_0 = creditScore_0
                         >=
                         _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                   partialProofData,
                                                                                   [
                                                                                    { dup: { n: 0 } },
                                                                                    { idx: { cached: false,
                                                                                             pushPath: false,
                                                                                             path: [
                                                                                                    { tag: 'value',
                                                                                                      value: { value: _descriptor_18.toValue(0n),
                                                                                                               alignment: _descriptor_18.alignment() } }] } },
                                                                                    { popeq: { cached: false,
                                                                                               result: undefined } }]).value);
    const meetsIncome_0 = annualIncome_0
                          >=
                          _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                    partialProofData,
                                                                                    [
                                                                                     { dup: { n: 0 } },
                                                                                     { idx: { cached: false,
                                                                                              pushPath: false,
                                                                                              path: [
                                                                                                     { tag: 'value',
                                                                                                       value: { value: _descriptor_18.toValue(1n),
                                                                                                                alignment: _descriptor_18.alignment() } }] } },
                                                                                     { popeq: { cached: false,
                                                                                                result: undefined } }]).value);
    const meetsAge_0 = age_0
                       >=
                       _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                 partialProofData,
                                                                                 [
                                                                                  { dup: { n: 0 } },
                                                                                  { idx: { cached: false,
                                                                                           pushPath: false,
                                                                                           path: [
                                                                                                  { tag: 'value',
                                                                                                    value: { value: _descriptor_18.toValue(2n),
                                                                                                             alignment: _descriptor_18.alignment() } }] } },
                                                                                  { popeq: { cached: false,
                                                                                             result: undefined } }]).value);
    const eligible_0 = meetsScore_0 && meetsIncome_0 && meetsAge_0;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_18.toValue(6n),
                                                                  alignment: _descriptor_18.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(nullifier_0),
                                                                                              alignment: _descriptor_3.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    if (eligible_0) {
      __compactRuntime.queryLedgerState(context,
                                        partialProofData,
                                        [
                                         { idx: { cached: false,
                                                  pushPath: true,
                                                  path: [
                                                         { tag: 'value',
                                                           value: { value: _descriptor_18.toValue(7n),
                                                                    alignment: _descriptor_18.alignment() } }] } },
                                         { push: { storage: false,
                                                   value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(nullifier_0),
                                                                                                alignment: _descriptor_3.alignment() }).encode() } },
                                         { push: { storage: true,
                                                   value: __compactRuntime.StateValue.newNull().encode() } },
                                         { ins: { cached: false, n: 1 } },
                                         { ins: { cached: true, n: 1 } }]);
    }
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(3n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(eligible_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    const tmp_0 = ((t1) => {
                    if (t1 > 18446744073709551615n) {
                      throw new __compactRuntime.CompactError('zkcred-v3.compact line 139 char 32: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 18446744073709551615');
                    }
                    return t1;
                  })(_descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                               partialProofData,
                                                                               [
                                                                                { dup: { n: 0 } },
                                                                                { idx: { cached: false,
                                                                                         pushPath: false,
                                                                                         path: [
                                                                                                { tag: 'value',
                                                                                                  value: { value: _descriptor_18.toValue(4n),
                                                                                                           alignment: _descriptor_18.alignment() } }] } },
                                                                                { popeq: { cached: false,
                                                                                           result: undefined } }]).value)
                     +
                     1n);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(4n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(tmp_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _updateThresholds_0(context,
                      partialProofData,
                      newMinCreditScore_0,
                      newMinAnnualIncome_0,
                      newMinAge_0)
  {
    const callerKey_0 = this._getPrivateAdminKey_0(context, partialProofData);
    __compactRuntime.assert(this._equal_3(this._persistentHash_2([callerKey_0]),
                                          _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_18.toValue(5n),
                                                                                                                                alignment: _descriptor_18.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'Unauthorized: caller is not authorized admin');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(0n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(newMinCreditScore_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(1n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(newMinAnnualIncome_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(2n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_2.toValue(newMinAge_0),
                                                                                              alignment: _descriptor_2.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_18.toValue(3n),
                                                                                              alignment: _descriptor_18.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(false),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    return [];
  }
  _checkNullifierEligible_0(context, partialProofData, nullifier_0) {
    return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 0 } },
                                                                      { idx: { cached: false,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_18.toValue(7n),
                                                                                                 alignment: _descriptor_18.alignment() } }] } },
                                                                      { push: { storage: false,
                                                                                value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(nullifier_0),
                                                                                                                             alignment: _descriptor_3.alignment() }).encode() } },
                                                                      'member',
                                                                      { popeq: { cached: true,
                                                                                 result: undefined } }]).value);
  }
  _getEligibilityStatus_0(context, partialProofData) {
    return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                     partialProofData,
                                                                     [
                                                                      { dup: { n: 0 } },
                                                                      { idx: { cached: false,
                                                                               pushPath: false,
                                                                               path: [
                                                                                      { tag: 'value',
                                                                                        value: { value: _descriptor_18.toValue(3n),
                                                                                                 alignment: _descriptor_18.alignment() } }] } },
                                                                      { popeq: { cached: false,
                                                                                 result: undefined } }]).value);
  }
  _equal_0(x0, y0) {
    {
      let x1 = x0.x;
      let y1 = y0.x;
      if (x1 !== y1) { return false; }
    }
    {
      let x1 = x0.y;
      let y1 = y0.y;
      if (x1 !== y1) { return false; }
    }
    return true;
  }
  _equal_1(x0, y0) {
    {
      let x1 = x0.x;
      let y1 = y0.x;
      if (x1 !== y1) { return false; }
    }
    {
      let x1 = x0.y;
      let y1 = y0.y;
      if (x1 !== y1) { return false; }
    }
    return true;
  }
  _equal_2(x0, y0) {
    {
      let x1 = x0.x;
      let y1 = y0.x;
      if (x1 !== y1) { return false; }
    }
    {
      let x1 = x0.y;
      let y1 = y0.y;
      if (x1 !== y1) { return false; }
    }
    return true;
  }
  _equal_3(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()),
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get minCreditScore() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(0n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get minAnnualIncome() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(1n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get minAge() {
      return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(2n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get isEligible() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(3n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get verificationCount() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(4n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get admin() {
      return _descriptor_3.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(5n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    usedSaltNullifiers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(6n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(6n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkcred-v3.compact line 16 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(6n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[6];
        return self_0.asMap().keys().map((elem) => _descriptor_3.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    eligibleNullifiers: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(7n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(0n),
                                                                                                                                 alignment: _descriptor_1.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(7n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          'size',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'zkcred-v3.compact line 17 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_18.toValue(7n),
                                                                                                     alignment: _descriptor_18.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_3.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_3.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[7];
        return self_0.asMap().keys().map((elem) => _descriptor_3.fromValue(elem.value))[Symbol.iterator]();
      }
    },
    get trustedIssuerKey() {
      return _descriptor_4.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(8n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get initialized() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_18.toValue(9n),
                                                                                                   alignment: _descriptor_18.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    }
  };
}
const _emptyContext = {
  currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress())
};
const _dummyContract = new Contract({
  getSchnorrReduction: (...args) => undefined,
  getPrivateCreditScore: (...args) => undefined,
  getPrivateAnnualIncome: (...args) => undefined,
  getPrivateAge: (...args) => undefined,
  getPrivateSalt: (...args) => undefined,
  getPrivateHolderSecret: (...args) => undefined,
  getPrivateCredentialSignature: (...args) => undefined,
  getPrivateAdminKey: (...args) => undefined
});
export const pureCircuits = {
  holderBinding: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`holderBinding: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const holderSecret_0 = args_0[0];
    if (!(holderSecret_0.buffer instanceof ArrayBuffer && holderSecret_0.BYTES_PER_ELEMENT === 1 && holderSecret_0.length === 32)) {
      __compactRuntime.typeError('holderBinding',
                                 'argument 1',
                                 'zkcred-v3.compact line 32 char 1',
                                 'Bytes<32>',
                                 holderSecret_0)
    }
    return _dummyContract._holderBinding_0(holderSecret_0);
  },
  eligibilityNullifier: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`eligibilityNullifier: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const salt_0 = args_0[0];
    const holderSecret_0 = args_0[1];
    const applicationId_0 = args_0[2];
    if (!(salt_0.buffer instanceof ArrayBuffer && salt_0.BYTES_PER_ELEMENT === 1 && salt_0.length === 32)) {
      __compactRuntime.typeError('eligibilityNullifier',
                                 'argument 1',
                                 'zkcred-v3.compact line 40 char 1',
                                 'Bytes<32>',
                                 salt_0)
    }
    if (!(holderSecret_0.buffer instanceof ArrayBuffer && holderSecret_0.BYTES_PER_ELEMENT === 1 && holderSecret_0.length === 32)) {
      __compactRuntime.typeError('eligibilityNullifier',
                                 'argument 2',
                                 'zkcred-v3.compact line 40 char 1',
                                 'Bytes<32>',
                                 holderSecret_0)
    }
    if (!(applicationId_0.buffer instanceof ArrayBuffer && applicationId_0.BYTES_PER_ELEMENT === 1 && applicationId_0.length === 32)) {
      __compactRuntime.typeError('eligibilityNullifier',
                                 'argument 3',
                                 'zkcred-v3.compact line 40 char 1',
                                 'Bytes<32>',
                                 applicationId_0)
    }
    return _dummyContract._eligibilityNullifier_0(salt_0,
                                                  holderSecret_0,
                                                  applicationId_0);
  },
  attestationMessage: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`attestationMessage: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const creditScore_0 = args_0[0];
    const annualIncome_0 = args_0[1];
    const age_0 = args_0[2];
    const boundHolder_0 = args_0[3];
    const applicationId_0 = args_0[4];
    if (!(typeof(creditScore_0) === 'bigint' && creditScore_0 >= 0n && creditScore_0 <= 4294967295n)) {
      __compactRuntime.typeError('attestationMessage',
                                 'argument 1',
                                 'zkcred-v3.compact line 57 char 1',
                                 'Uint<0..4294967296>',
                                 creditScore_0)
    }
    if (!(typeof(annualIncome_0) === 'bigint' && annualIncome_0 >= 0n && annualIncome_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('attestationMessage',
                                 'argument 2',
                                 'zkcred-v3.compact line 57 char 1',
                                 'Uint<0..18446744073709551616>',
                                 annualIncome_0)
    }
    if (!(typeof(age_0) === 'bigint' && age_0 >= 0n && age_0 <= 4294967295n)) {
      __compactRuntime.typeError('attestationMessage',
                                 'argument 3',
                                 'zkcred-v3.compact line 57 char 1',
                                 'Uint<0..4294967296>',
                                 age_0)
    }
    if (!(typeof(boundHolder_0) === 'bigint' && boundHolder_0 >= 0 && boundHolder_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('attestationMessage',
                                 'argument 4',
                                 'zkcred-v3.compact line 57 char 1',
                                 'Field',
                                 boundHolder_0)
    }
    if (!(applicationId_0.buffer instanceof ArrayBuffer && applicationId_0.BYTES_PER_ELEMENT === 1 && applicationId_0.length === 32)) {
      __compactRuntime.typeError('attestationMessage',
                                 'argument 5',
                                 'zkcred-v3.compact line 57 char 1',
                                 'Bytes<32>',
                                 applicationId_0)
    }
    return _dummyContract._attestationMessage_0(creditScore_0,
                                                annualIncome_0,
                                                age_0,
                                                boundHolder_0,
                                                applicationId_0);
  },
  schnorrChallenge: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`schnorrChallenge: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const annX_0 = args_0[0];
    const annY_0 = args_0[1];
    const issuerKeyX_0 = args_0[2];
    const issuerKeyY_0 = args_0[3];
    const message_0 = args_0[4];
    if (!(typeof(annX_0) === 'bigint' && annX_0 >= 0 && annX_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 1',
                                 'zkcred-v3.compact line 73 char 1',
                                 'Field',
                                 annX_0)
    }
    if (!(typeof(annY_0) === 'bigint' && annY_0 >= 0 && annY_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 2',
                                 'zkcred-v3.compact line 73 char 1',
                                 'Field',
                                 annY_0)
    }
    if (!(typeof(issuerKeyX_0) === 'bigint' && issuerKeyX_0 >= 0 && issuerKeyX_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 3',
                                 'zkcred-v3.compact line 73 char 1',
                                 'Field',
                                 issuerKeyX_0)
    }
    if (!(typeof(issuerKeyY_0) === 'bigint' && issuerKeyY_0 >= 0 && issuerKeyY_0 <= __compactRuntime.MAX_FIELD)) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 4',
                                 'zkcred-v3.compact line 73 char 1',
                                 'Field',
                                 issuerKeyY_0)
    }
    if (!(Array.isArray(message_0) && message_0.length === 5 && message_0.every((t) => typeof(t) === 'bigint' && t >= 0 && t <= __compactRuntime.MAX_FIELD))) {
      __compactRuntime.typeError('schnorrChallenge',
                                 'argument 5',
                                 'zkcred-v3.compact line 73 char 1',
                                 'Vector<5, Field>',
                                 message_0)
    }
    return _dummyContract._schnorrChallenge_1(annX_0,
                                              annY_0,
                                              issuerKeyX_0,
                                              issuerKeyY_0,
                                              message_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
//# sourceMappingURL=index.js.map
