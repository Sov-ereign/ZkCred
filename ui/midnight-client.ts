/**
 * Browser-side Midnight transaction client.
 *
 * Witness values are closed over by this module and only consumed while the
 * Compact circuit executes locally. They are never posted to the application
 * API, indexer, or proof server as JSON.
 */
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { ContractState as CompactContractState } from "@midnight-ntwrk/compact-runtime";
import { Transaction, Binding, Proof, SignatureEnabled } from "@midnight-ntwrk/ledger-v8";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { deployContract, findDeployedContract, submitCallTx } from "@midnight-ntwrk/midnight-js-contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { Buffer as NodeBuffer } from "buffer";
import * as CompiledOutput from "../src/managed/contract/index.js";
import { persistentHashVec1, persistentHashVec2 } from "../src/managed/index.js";

// The official Midnight SDK requires this global before constructing a
// compiled contract, transaction, or provider. This client is Preprod-only.
setNetworkId("preprod");
(globalThis as any).Buffer = (globalThis as any).Buffer ?? NodeBuffer;

type WitnessInput = { creditScore: number; annualIncome: number; age: number; userSalt: string; adminKey?: Uint8Array };
type WalletChoice = { id: string; name: string; apiVersion: string; rdns: string; connector: InitialAPI };

function normalizeContractAddress(address: string): string {
  const hex = address.replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(hex)) throw new Error("Invalid Midnight contract address.");
  // Midnight's indexer and ledger APIs expect the 64-character hex form
  // without an Ethereum-style 0x prefix.
  return hex;
}

function isContractAddress(address: string): boolean {
  return /^[0-9a-f]{64}$/i.test(String(address).replace(/^0x/i, ""));
}
type ActiveConnection = { api: ConnectedAPI; address: string; providers: any; walletName: string; walletId: string };

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

function adminKeyStorageKey(contractAddress: string): string {
  return `zkcred_admin_key_${normalizeContractAddress(contractAddress)}`;
}

/**
 * Derives a 256-bit AES-GCM key from the session storage password using
 * PBKDF2. The password is itself random (32 bytes from CSPRNG) and lives
 * only in sessionStorage, so this is defense-in-depth for the admin key.
 */
async function deriveAdminStorageKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("zkcred-admin-key-v1"), iterations: 100_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function saveAdminKey(contractAddress: string, adminKey: Uint8Array): Promise<void> {
  const password = storagePassword();
  const aesKey = await deriveAdminStorageKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, adminKey);
  // Store as: <12-byte iv hex><ciphertext hex>
  const payload = bytesToHex(iv) + bytesToHex(new Uint8Array(ciphertext));
  localStorage.setItem(adminKeyStorageKey(contractAddress), payload);
}

async function loadAdminKey(contractAddress: string): Promise<Uint8Array | null> {
  const encoded = localStorage.getItem(adminKeyStorageKey(contractAddress));
  // Minimum: 24 hex (12-byte IV) + 64 hex (32-byte key) + 32 hex (GCM tag) = 120 chars
  if (!encoded || !/^[0-9a-f]{120,}$/i.test(encoded)) return null;
  try {
    const password = storagePassword();
    const aesKey = await deriveAdminStorageKey(password);
    const iv = hexToBytes(encoded.slice(0, 24));
    const ciphertext = hexToBytes(encoded.slice(24));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext);
    return new Uint8Array(plaintext);
  } catch {
    // Wrong session (page reloaded) — key is unrecoverable this session.
    return null;
  }
}


function listWalletChoices(): WalletChoice[] {
  const midnightObj = (window as any).midnight;
  if (!midnightObj || typeof midnightObj !== "object") return [];
  return Object.entries(midnightObj)
    .filter(([, connector]: [string, any]) => connector && typeof connector.connect === "function")
    .map(([id, connector]: [string, any]) => ({
      id,
      name: typeof connector.name === "string" && connector.name.trim() ? connector.name.trim() : "Unnamed Midnight wallet",
      apiVersion: typeof connector.apiVersion === "string" ? connector.apiVersion : "",
      rdns: typeof connector.rdns === "string" ? connector.rdns : "",
      connector: connector as InitialAPI,
    }));
}

async function waitForWalletChoices(timeoutMs = 7_500): Promise<WalletChoice[]> {
  const started = Date.now();
  let previousIds = "";
  let stableSince = 0;
  do {
    const choices = listWalletChoices();
    if (choices.length) {
      const ids = choices.map((choice) => choice.id).sort().join("|");
      if (ids !== previousIds) {
        previousIds = ids;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= 350) {
        return choices;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() - started < timeoutMs);
  return listWalletChoices();
}

function supportsConnectorApiVersion(version: string): boolean {
  return /^4\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}

/**
 * Builds a CompiledContract with witness callbacks closed over the provided
 * input. The optional `initWitnesses` object supplies the extra private witnesses
 * needed during the `initialize` circuit execution (adminKey, issuerKey,
 * credentialToken) so that they are available in the same atomic context as
 * the deploy + initialize transaction.
 */
function compiledContract(
  input?: WitnessInput,
  initWitnesses?: { adminKey: Uint8Array; issuerKey?: Uint8Array; credentialToken?: Uint8Array },
) {
  const witnessInput = input ?? {
    creditScore: 0,
    annualIncome: 0,
    age: 0,
    userSalt: bytesToHex(new Uint8Array(32)),
  };
  const witnesses = {
    // Preserve the opaque state managed by the Midnight runtime. Returning
    // `undefined` here corrupts the state threaded through the contract.
    getPrivateCreditScore: (context: any) => [context.privateState, BigInt(witnessInput.creditScore)],
    getPrivateAnnualIncome: (context: any) => [context.privateState, BigInt(witnessInput.annualIncome)],
    getPrivateAge: (context: any) => [context.privateState, BigInt(witnessInput.age)],
    getPrivateSalt: (context: any) => [context.privateState, saltBytes(witnessInput.userSalt)],
    getPrivateAdminKey: (context: any) => [context.privateState, initWitnesses?.adminKey ?? witnessInput.adminKey ?? new Uint8Array(32)],
    // Issuer witnesses: provided when needed (verifyEligibility or initialize).
    // Zeroed values will fail the on-chain issuerKeyHash assertion intentionally.
    getPrivateIssuerKey: (context: any) => [context.privateState, initWitnesses?.issuerKey ?? new Uint8Array(32)],
    getPrivateCredentialToken: (context: any) => [context.privateState, initWitnesses?.credentialToken ?? new Uint8Array(32)],
  };
  return CompiledContract.make<any>("ZkCred", CompiledOutput.Contract).pipe(
    CompiledContract.withWitnesses(witnesses as any),
    CompiledContract.withCompiledFileAssets("./contract/compiled"),
  );
}

async function buildProviders(api: ConnectedAPI, accountId: string) {
  let config: any = {};
  try {
    config = await api.getConfiguration();
  } catch (err) {
    console.warn("[Midnight] getConfiguration warning:", err);
  }
  const indexerUri = config.indexerUri || "https://indexer.preprod.midnight.network/api/v3/graphql";
  const indexerWsUri = config.indexerWsUri || "wss://indexer.preprod.midnight.network/api/v3/graphql/ws";
  const proverServerUri = config.proverServerUri || "http://localhost:6300";

  const zkConfigProvider = new FetchZkConfigProvider<any>(`${window.location.origin}/contract/compiled`, fetch.bind(window));
  // Pass the browser WebSocket explicitly. This avoids relying on Node's
  // isomorphic-ws export in the web bundle.
  const rawPublicDataProvider = indexerPublicDataProvider(indexerUri, indexerWsUri, WebSocket as any);
  const publicDataProvider = {
    ...rawPublicDataProvider,
    async queryZSwapAndContractState(contractAddress: any, queryConfig?: any) {
      const result = await rawPublicDataProvider.queryZSwapAndContractState(contractAddress, queryConfig);
      if (!result) return result;
      const [zswapChainState, contractState, ledgerParameters] = result;
      return [zswapChainState.postBlockUpdate(new Date()), contractState, ledgerParameters] as typeof result;
    },
  };
  const shieldedAddresses = await api.getShieldedAddresses();
  const coinPublicKey = typeof shieldedAddresses === "object" ? (shieldedAddresses as any)?.shieldedCoinPublicKey : undefined;
  const encryptionPublicKey = typeof shieldedAddresses === "object" ? (shieldedAddresses as any)?.shieldedEncryptionPublicKey : undefined;
  if (!coinPublicKey || typeof coinPublicKey !== "string") {
    throw new Error("Lace wallet did not return a valid shielded coin public key.");
  }
  if (!encryptionPublicKey || typeof encryptionPublicKey !== "string") {
    throw new Error("Lace wallet did not return a valid shielded encryption public key.");
  }

  const proofProvider = httpClientProofProvider(proverServerUri, zkConfigProvider);
  const walletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
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

let connectInFlight: Promise<{ address: string; walletName: string }> | null = null;

async function connect(networkId = "preprod", walletId?: string) {
  if (active) {
    if (walletId && active.walletId !== walletId) throw new Error("Disconnect the current wallet before switching wallets.");
    return { address: active.address, walletName: active.walletName, walletId: active.walletId };
  }
  if (connectInFlight) return connectInFlight;

  connectInFlight = (async () => {
    const choices = await waitForWalletChoices();
    if (!choices.length) throw new Error("No Midnight wallet DApp connector was found. Install or unlock Lace or 1AM, then retry.");
    if (!walletId && choices.length > 1) throw new Error("More than one Midnight wallet is available. Select one before connecting.");
    const selected = walletId ? choices.find((choice) => choice.id === walletId) : choices[0];
    if (!selected) throw new Error("The selected Midnight wallet is no longer available. Refresh the wallet list and retry.");
    if (!supportsConnectorApiVersion(selected.apiVersion)) {
      throw new Error(`${selected.name} reports unsupported Midnight DApp Connector API version "${selected.apiVersion || "unknown"}"; this app requires version 4.x.`);
    }
    const connector = selected.connector;
    const api = await connector.connect(networkId);
    const shielded = await api.getShieldedAddresses();
    const shieldedAddress = typeof shielded === "string"
      ? shielded
      : (shielded as any)?.shieldedAddress ?? (shielded as any)?.address;
    const unshielded = !shieldedAddress ? await api.getUnshieldedAddress?.() : undefined;
    const address = shieldedAddress ?? (unshielded as any)?.unshieldedAddress;
    if (!address) throw new Error(`${selected.name} connected, but returned no Midnight address. Select a Preprod account in that wallet and retry.`);
    const providers = await buildProviders(api, address);
    active = { api, address, providers, walletName: selected.name, walletId: selected.id } as ActiveConnection;
    return { address: active.address, walletName: active.walletName, walletId: selected.id };
  })();

  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

function disconnect() {
  active = null;
  connectInFlight = null;
}

async function submitEligibility(contractAddress: string, input: WitnessInput) {
  if (!active) throw new Error("Connect Midnight Lace before generating a proof.");
  if (!contractAddress || !isContractAddress(contractAddress)) throw new Error("A deployed Midnight contract address is required.");
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
  const salt = saltBytes(input.userSalt);
  const domainTag = new Uint8Array(32);
  domainTag.set(new TextEncoder().encode("zkcred:eligibility:nullifier:v1"));
  const nullifier = persistentHashVec2(domainTag, salt);
  return {
    transactionId: String((tx as any).txId ?? (tx as any).public?.txId ?? ""),
    nullifierHex: bytesToHex(nullifier),
  };
}async function updateThresholds(contractAddress: string, thresholds: { minCreditScore: number; minAnnualIncome: number; minAge: number }) {
  if (!active) throw new Error("Connect Midnight Lace before updating thresholds.");
  const adminKey = await loadAdminKey(contractAddress);
  if (!adminKey) throw new Error("This browser does not hold the administrator key for this contract (or the session has changed).");
  if (![thresholds.minCreditScore, thresholds.minAnnualIncome, thresholds.minAge].every(Number.isSafeInteger)) {
    throw new Error("Threshold values must be safe integers.");
  }
  const contract = compiledContract({ creditScore: 0, annualIncome: 0, age: 0, userSalt: bytesToHex(new Uint8Array(32)), adminKey });
  const deployed = await findDeployedContract(active.providers, { compiledContract: contract, contractAddress: contractAddress as any });
  const tx = await submitCallTx(active.providers, {
    compiledContract: contract,
    contractAddress: deployed.deployTxData.public.contractAddress,
    circuitId: "updateThresholds" as any,
    args: [BigInt(thresholds.minCreditScore), BigInt(thresholds.minAnnualIncome), BigInt(thresholds.minAge)],
  } as any);
  return { transactionId: String((tx as any).txId ?? (tx as any).public?.txId ?? "") };
}

/** Reads and decodes the public ledger with the generated Compact binding. */
async function getLedgerState(contractAddress: string) {
  if (!active) throw new Error("Connect Midnight Lace before reading contract state.");
  if (!contractAddress || !isContractAddress(contractAddress)) throw new Error("A deployed Midnight contract address is required.");
  const contract = compiledContract({ creditScore: 0, annualIncome: 0, age: 0, userSalt: bytesToHex(new Uint8Array(32)) });
  // Match verifier keys before trusting or displaying state from this address.
  await findDeployedContract(active.providers, { compiledContract: contract, contractAddress: contractAddress as any });
  const queried = await active.providers.publicDataProvider.queryZSwapAndContractState(contractAddress as any);
  if (!queried) throw new Error("The configured contract was not found on the wallet's Midnight indexer.");
  const [, publicState] = queried;
  // The indexer and generated binding can be bundled with distinct copies of
  // the WASM runtime. Re-serialize through this app's runtime copy so its
  // ChargedState identity check succeeds. The generated ledger binding accepts
  // the charged state itself (not the enclosing ContractState).
  const normalizedState = CompactContractState.deserialize((publicState as any).serialize());
  const ledger = CompiledOutput.ledger((normalizedState as any).data);
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
 * Checks whether a specific salt nullifier is in the on-chain eligibleNullifiers
 * set. This is the authoritative relying-party query — it is not affected by
 * any subsequent verifyEligibility call overwriting the global isEligible flag.
 *
 * Pass the hex nullifier returned by submitEligibility (or computed as
 * persistentHash("zkcred:eligibility:nullifier:v1" || salt)).
 */
async function checkNullifierEligible(contractAddress: string, nullifierHex: string): Promise<boolean> {
  if (!active) throw new Error("Connect Midnight Lace before querying nullifier eligibility.");
  if (!contractAddress || !isContractAddress(contractAddress)) throw new Error("A deployed Midnight contract address is required.");
  const contract = compiledContract({ creditScore: 0, annualIncome: 0, age: 0, userSalt: bytesToHex(new Uint8Array(32)) });
  await findDeployedContract(active.providers, { compiledContract: contract, contractAddress: contractAddress as any });
  const queried = await active.providers.publicDataProvider.queryZSwapAndContractState(contractAddress as any);
  if (!queried) throw new Error("The configured contract was not found on the wallet's Midnight indexer.");
  const [, publicState] = queried;
  const normalizedState = CompactContractState.deserialize((publicState as any).serialize());
  const ledger = CompiledOutput.ledger((normalizedState as any).data);
  // Check membership in eligibleNullifiers: only nullifiers from eligible calls
  // are present; ineligible calls only appear in usedSaltNullifiers.
  const nullifierBytes = hexToBytes(nullifierHex);
  return Boolean((ledger as any).eligibleNullifiers?.member?.(nullifierBytes));
}

/**
 * Deploys the locally compiled contract through the connected wallet. This is
 * deliberately interactive: Lace selects funds, signs, and submits the
 * transaction. The returned address is saved only in this browser until the
 * operator verifies it and configures CONTRACT_ADDRESS for the hosted API.
 *
 * ATOMICITY: deploy + initialize are composed into a SINGLE transaction by
 * passing `initialArgs` to `deployContract`. This eliminates the race window
 * where the contract existed on-chain with `initialized = false`, which an
 * attacker could exploit to front-run the initializer and register their own
 * admin key and thresholds.
 *
 * ADMIN KEY BACKUP: immediately after deployment this function triggers an
 * encrypted JSON backup download using a user-supplied password. If this step
 * is skipped and the browser session ends, the admin key is irrecoverable
 * (localStorage is cleared or the sessionStorage-derived PBKDF2 key rotates).
 */
async function deploy(
  thresholds: { minCreditScore: number; minAnnualIncome: number; minAge: number },
  issuerKeyHash?: Uint8Array,
  backupPassword?: string,
) {
  if (!active) throw new Error("Connect Midnight Lace before deployment.");
  if (![thresholds.minCreditScore, thresholds.minAnnualIncome, thresholds.minAge].every(Number.isSafeInteger)) {
    throw new Error("Deployment thresholds must be safe integers.");
  }

  // Generate a fresh 32-byte admin key (never touches the network).
  const adminKey = new Uint8Array(32);
  crypto.getRandomValues(adminKey);

  // If no issuer key hash is provided, use a zero hash as placeholder.
  // The admin must call updateThresholds (or redeploy) once the real issuer
  // key hash is known.
  const issuerHash = issuerKeyHash ?? new Uint8Array(32);

  // Build a compiled contract with all witnesses closed over, including the
  // admin key that the initialize circuit will use as a private witness.
  const contract = compiledContract(
    undefined,
    { adminKey, issuerKey: new Uint8Array(32), credentialToken: new Uint8Array(32) },
  );

  // ATOMIC DEPLOY + INITIALIZE:
  // Pass the constructor `args` supported by MidnightJS. Deploy executes the
  // Compact initializer in the deployment transaction, so no uninitialized
  // contract is exposed between deployment and initialization.
  // This replaces the previous two-transaction pattern (deployContract() then
  // callTx.initialize()) that created a front-runnable initialization window.
  const deployed = await deployContract(active.providers, {
    compiledContract: contract,
    privateStateId: "zkcred-private-state",
    initialPrivateState: {},
    args: [
        BigInt(thresholds.minCreditScore),
        BigInt(thresholds.minAnnualIncome),
        BigInt(thresholds.minAge),
        persistentHashVec1(adminKey),
        issuerHash,
    ],
  } as any);

  const address = normalizeContractAddress(String(deployed.deployTxData.public.contractAddress));
  localStorage.setItem("zkcred_contract_address", address);

  // Persist the admin key (encrypted with a PBKDF2+AES-GCM key derived from
  // the session secret) so it is available within this browser session.
  await saveAdminKey(address, adminKey);

  // ── Auto-backup admin key ────────────────────────────────────────────────
  // When a backupPassword is provided, immediately produce an encrypted JSON
  // backup and trigger a browser download. This is the ONLY cross-session
  // recovery path for the admin key. If the session ends without a backup,
  // updateThresholds becomes permanently unavailable for this deployment.
  if (backupPassword) {
    try {
      const backupJson = await exportAdminKey(address, backupPassword);
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zkcred-admin-backup-${address.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[deploy] Admin key backup failed — export manually before closing this tab:", err);
    }
  } else {
    // Emit a console warning so developers are not silently left without a backup.
    console.warn(
      "[ZkCred] IMPORTANT: No backupPassword supplied to deploy(). " +
      "Call exportAdminKey() now and save the result before closing this tab. " +
      "The admin key cannot be recovered after the browser session ends.",
    );
  }

  return {
    contractAddress: address,
    transactionId: String(
      (deployed as any).deployTxData?.public?.txId ??
      (deployed as any).txId ??
      "",
    ),
  };
}

/**
 * Exports the admin key for a contract as an encrypted JSON backup file.
 * The exported blob is encrypted with a user-supplied password (separate from
 * the session key), allowing cross-session and cross-browser recovery.
 *
 * Security: the exported file is AES-GCM encrypted with PBKDF2 (100k rounds).
 * Without the backup password, the blob cannot be decrypted.
 */
async function exportAdminKey(contractAddress: string, backupPassword: string): Promise<string> {
  const adminKey = await loadAdminKey(contractAddress);
  if (!adminKey) throw new Error("No admin key found for this contract in this browser session.");

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await crypto.subtle.importKey("raw", enc.encode(backupPassword), "PBKDF2", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, adminKey);

  const backup = {
    version: "zkcred-admin-backup-v1",
    contractAddress: normalizeContractAddress(contractAddress),
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertext)),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Imports an admin key backup created by exportAdminKey.
 * Decrypts using the backup password and stores the key in this browser session.
 */
async function importAdminKey(backupJson: string, backupPassword: string): Promise<string> {
  let backup: any;
  try {
    backup = JSON.parse(backupJson);
  } catch {
    throw new Error("Invalid backup file: not valid JSON.");
  }
  if (backup?.version !== "zkcred-admin-backup-v1") {
    throw new Error("Invalid backup file: unrecognized version.");
  }
  const { contractAddress, salt, iv, ciphertext } = backup;
  if (!contractAddress || !salt || !iv || !ciphertext) {
    throw new Error("Invalid backup file: missing required fields.");
  }

  const enc = new TextEncoder();
  const saltBytes = hexToBytes(salt);
  const ivBytes = hexToBytes(iv);
  const ciphertextBytes = hexToBytes(ciphertext);

  const baseKey = await crypto.subtle.importKey("raw", enc.encode(backupPassword), "PBKDF2", false, ["deriveKey"]);
  const aesKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, ciphertextBytes);
  } catch {
    throw new Error("Decryption failed: incorrect backup password or corrupted file.");
  }
  const adminKey = new Uint8Array(plaintext);
  const normalized = normalizeContractAddress(contractAddress);
  await saveAdminKey(normalized, adminKey);
  return normalized;
}

(window as any).ZkCredMidnight = {
  listWallets: async () => (await waitForWalletChoices())
    .filter((wallet) => supportsConnectorApiVersion(wallet.apiVersion))
    .map(({ connector: _connector, ...wallet }) => wallet),
  connect,
  disconnect,
  deploy,
  getLedgerState,
  submitEligibility,
  updateThresholds,
  checkNullifierEligible,
  hasAdminKey: async (address: string) => Boolean(await loadAdminKey(address)),
  isConnected: () => Boolean(active),
  /** Export admin key as an encrypted JSON backup (for cross-session recovery). */
  exportAdminKey,
  /** Import and restore an admin key from a backup created by exportAdminKey. */
  importAdminKey,
};
