/**
 * Browser-side Midnight transaction client.
 *
 * Witness values are closed over by this module and only consumed while the
 * Compact circuit executes locally. They are never posted to the application
 * API, indexer, or proof server as JSON.
 */
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { Transaction, Binding, Proof, SignatureEnabled } from "@midnight-ntwrk/ledger-v8";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { deployContract, findDeployedContract, submitCallTx } from "@midnight-ntwrk/midnight-js-contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import * as CompiledOutput from "../src/managed/contract/index.js";

// The official Midnight SDK requires this global before constructing a
// compiled contract, transaction, or provider. This client is Preprod-only.
setNetworkId("preprod");

type WitnessInput = { creditScore: number; annualIncome: number; age: number; userSalt: string };
type ActiveConnection = { api: ConnectedAPI; address: string; providers: any; walletName: string };

let active: ActiveConnection | null = null;

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex: string) => {
  const clean = hex.replace(/^0x/, "");
  if (!/^(?:[0-9a-f]{2})*$/i.test(clean)) throw new Error("Wallet returned a malformed serialized transaction.");
  return new Uint8Array(clean.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? []);
};

function saltBytes(salt: string): Uint8Array {
  const clean = salt.replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/i.test(clean)) throw new Error("A 32-byte random local salt is required.");
  return hexToBytes(clean);
}

function storagePassword(): string {
  const key = "zkcred_private_storage_secret";
  let secret = sessionStorage.getItem(key);
  if (!secret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    secret = `ZkCred-${bytesToHex(bytes)}!`;
    sessionStorage.setItem(key, secret);
  }
  return secret;
}

function selectConnector(): InitialAPI {
  const injected = window as any;
  // Lace has shipped a few connector injection shapes across extension
  // versions. These are all real DApp Connector objects; we only select an
  // object exposing the official `connect` method and never fabricate one.
  const candidates = [
    ...Object.values(injected.midnight ?? {}),
    injected.midnight,
    injected.midnight?.mnLace,
    injected.midnight?.lace,
    injected.cardano?.laceMidnight,
    injected.cardano?.lace,
  ] as InitialAPI[];
  const connector = candidates.find((candidate) => typeof candidate?.connect === "function");
  if (!connector) {
    throw new Error("No Midnight DApp Connector was found. Unlock/update Midnight Lace, then retry.");
  }
  return connector;
}

async function waitForConnector(timeoutMs = 7_500): Promise<InitialAPI> {
  const started = Date.now();
  do {
    try { return selectConnector(); } catch { await new Promise((resolve) => setTimeout(resolve, 150)); }
  } while (Date.now() - started < timeoutMs);
  return selectConnector();
}

function compiledContract(input: WitnessInput) {
  const witnesses = {
    getPrivateCreditScore: () => [undefined, BigInt(input.creditScore)],
    getPrivateAnnualIncome: () => [undefined, BigInt(input.annualIncome)],
    getPrivateAge: () => [undefined, BigInt(input.age)],
    getPrivateSalt: () => [undefined, saltBytes(input.userSalt)],
    getPrivateAdminKey: () => [undefined, new Uint8Array(32)],
  };
  return CompiledContract.make<any>("ZkCred", CompiledOutput.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets("./contract/compiled"),
  );
}

async function buildProviders(api: ConnectedAPI, accountId: string) {
  const config = await api.getConfiguration();
  if (!config.proverServerUri) throw new Error("The connected wallet has no prover server configured.");
  const zkConfigProvider = new FetchZkConfigProvider<any>(`${window.location.origin}/contract/compiled`, fetch.bind(window));
  // Pass the browser WebSocket explicitly. This avoids relying on Node's
  // isomorphic-ws export in the web bundle.
  const rawPublicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri, WebSocket as any);
  const publicDataProvider = {
    ...rawPublicDataProvider,
    async queryZSwapAndContractState(contractAddress: any, queryConfig?: any) {
      const result = await rawPublicDataProvider.queryZSwapAndContractState(contractAddress, queryConfig);
      if (!result) return result;
      const [zswapChainState, contractState, ledgerParameters] = result;
      return [zswapChainState.postBlockUpdate(new Date()), contractState, ledgerParameters] as typeof result;
    },
  };
  const proofProvider = httpClientProofProvider(config.proverServerUri, zkConfigProvider);
  const shielded = await api.getShieldedAddresses();
  const walletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey as any,
    getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey as any,
    async balanceTx(tx: any) {
      const result = await api.balanceUnsealedTransaction(bytesToHex(tx.serialize()));
      return Transaction.deserialize("signature", "proof", "binding", hexToBytes(result.tx)) as Transaction<SignatureEnabled, Proof, Binding>;
    },
  };
  const midnightProvider = {
    async submitTx(tx: any) {
      await api.submitTransaction(bytesToHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };
  return {
    privateStateProvider: levelPrivateStateProvider({ privateStoragePasswordProvider: storagePassword, accountId }),
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}

async function connect(networkId = "preprod") {
  const connector = await waitForConnector();
  const api = await connector.connect(networkId);
  await api.hintUsage?.(["getShieldedAddresses", "balanceUnsealedTransaction", "submitTransaction"]);
  const shielded = await api.getShieldedAddresses();
  // Lace versions have returned the address object with slightly different
  // wrapping while the connector API was stabilising. Accept only genuine
  // values returned by the wallet; never invent an address.
  const shieldedAddress = typeof shielded === "string"
    ? shielded
    : (shielded as any)?.shieldedAddress ?? (shielded as any)?.address;
  const unshielded = !shieldedAddress ? await api.getUnshieldedAddress?.() : undefined;
  const address = shieldedAddress ?? (unshielded as any)?.unshieldedAddress;
  if (!address) throw new Error("Lace connected, but returned no Midnight address. Select a Midnight Preprod account in Lace and retry.");
  active = { api, address, providers: await buildProviders(api, address), walletName: connector.name };
  return { address: active.address, walletName: active.walletName };
}

async function submitEligibility(contractAddress: string, input: WitnessInput) {
  if (!active) throw new Error("Connect Midnight Lace before generating a proof.");
  if (!contractAddress || !/^0x[0-9a-f]+$/i.test(contractAddress)) throw new Error("A deployed Midnight contract address is required.");
  if (!Number.isSafeInteger(input.creditScore) || !Number.isSafeInteger(input.age) || !Number.isSafeInteger(input.annualIncome)) {
    throw new Error("Witness inputs must be safe integers.");
  }
  const contract = compiledContract(input);
  // This verifies that the deployed verifier keys match the locally compiled
  // contract before any witness is used for proving.
  const deployed = await findDeployedContract(active.providers, { compiledContract: contract, contractAddress: contractAddress as any });
  const tx = await submitCallTx(active.providers, {
    compiledContract: contract,
    contractAddress: deployed.deployTxData.public.contractAddress,
    circuitId: "verifyEligibility" as any,
  } as any);
  return { transactionId: String((tx as any).txId ?? (tx as any).public?.txId ?? "") };
}

/** Reads and decodes the public ledger with the generated Compact binding. */
async function getLedgerState(contractAddress: string) {
  if (!active) throw new Error("Connect Midnight Lace before reading contract state.");
  if (!contractAddress || !/^0x[0-9a-f]+$/i.test(contractAddress)) throw new Error("A deployed Midnight contract address is required.");
  const contract = compiledContract({ creditScore: 0, annualIncome: 0, age: 0, userSalt: bytesToHex(new Uint8Array(32)) });
  // Match verifier keys before trusting or displaying state from this address.
  await findDeployedContract(active.providers, { compiledContract: contract, contractAddress: contractAddress as any });
  const queried = await active.providers.publicDataProvider.queryZSwapAndContractState(contractAddress as any);
  if (!queried) throw new Error("The configured contract was not found on the wallet's Midnight indexer.");
  const [, publicState] = queried;
  const ledger = CompiledOutput.ledger(publicState);
  return {
    contractAddress,
    minCreditScore: Number(ledger.minCreditScore),
    minAnnualIncome: Number(ledger.minAnnualIncome),
    minAge: Number(ledger.minAge),
    isEligible: ledger.isEligible,
    verificationCount: Number(ledger.verificationCount),
  };
}

/**
 * Deploys the locally compiled contract through the connected wallet. This is
 * deliberately interactive: Lace selects funds, signs, and submits the
 * transaction. The returned address is saved only in this browser until the
 * operator verifies it and configures CONTRACT_ADDRESS for the hosted API.
 */
async function deploy(
  thresholds: { minCreditScore: number; minAnnualIncome: number; minAge: number },
) {
  if (!active) throw new Error("Connect Midnight Lace before deployment.");
  if (![thresholds.minCreditScore, thresholds.minAnnualIncome, thresholds.minAge].every(Number.isSafeInteger)) {
    throw new Error("Deployment thresholds must be safe integers.");
  }
  const adminKey = new Uint8Array(32);
  crypto.getRandomValues(adminKey);
  const contract = compiledContract({
    creditScore: 0,
    annualIncome: 0,
    age: 0,
    userSalt: bytesToHex(new Uint8Array(32)),
  });
  const deployed = await deployContract(active.providers, {
    compiledContract: contract,
    args: [BigInt(thresholds.minCreditScore), BigInt(thresholds.minAnnualIncome), BigInt(thresholds.minAge), adminKey],
  } as any);
  const address = String(deployed.deployTxData.public.contractAddress);
  localStorage.setItem("zkcred_contract_address", address);
  return { contractAddress: address, transactionId: String(deployed.deployTxData.public.txId ?? "") };
}

(window as any).ZkCredMidnight = { connect, deploy, getLedgerState, submitEligibility, isConnected: () => Boolean(active) };
