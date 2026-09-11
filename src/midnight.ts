/**
 * Shared fail-closed helpers for the ZkCred browser client.
 *
 * Actual Midnight transactions are constructed in ui/midnight-client.ts with
 * the official DApp Connector and MidnightJS contract APIs. A Node process
 * cannot access a user's Lace signing wallet, so this module intentionally
 * contains no synthetic transaction, proof, or deployment fallback.
 */
import type { WitnessFunctions, LedgerState } from "./managed/index.js";

export interface MidnightConfig {
  proofServerUrl: string;
  indexerGraphqlUrl: string;
  contractAddress?: string;
}

export const DEFAULT_PREPROD_CONFIG: MidnightConfig = {
  indexerGraphqlUrl: "https://indexer.preprod.midnight.network/api/v3/graphql",
  proofServerUrl: "http://localhost:6300",
};

export interface PrivateWitnessData {
  creditScore: number;
  annualIncome: bigint;
  age: number;
  userSalt: Uint8Array;
  adminKey?: Uint8Array;
}

export interface MidnightProviders {
  proofProviderUrl: string;
  indexerGraphqlUrl: string;
}

/** Verifies a configured prover is reachable; no proof is generated here. */
export async function createMidnightProviders(config: Partial<MidnightConfig> = {}): Promise<MidnightProviders> {
  const merged = { ...DEFAULT_PREPROD_CONFIG, ...config };
  try {
    const response = await fetch(`${merged.proofServerUrl}/health`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`Proof server unreachable at ${merged.proofServerUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { proofProviderUrl: merged.proofServerUrl, indexerGraphqlUrl: merged.indexerGraphqlUrl };
}

/** Private callbacks used only by the local Compact runtime. */
export function createWitnessCallbacks(privateData: PrivateWitnessData): WitnessFunctions {
  return {
    getPrivateCreditScore: () => privateData.creditScore,
    getPrivateAnnualIncome: () => privateData.annualIncome,
    getPrivateAge: () => privateData.age,
    getPrivateSalt: () => privateData.userSalt,
    getPrivateAdminKey: () => privateData.adminKey ?? new Uint8Array(32),
  };
}

/**
 * Strict raw indexer query. It deliberately throws on network, GraphQL, absent
 * contract, or malformed-state responses instead of inventing threshold data.
 */
export async function fetchLedgerStateFromIndexer(
  contractAddress: string,
  indexerUrl: string = DEFAULT_PREPROD_CONFIG.indexerGraphqlUrl,
): Promise<LedgerState> {
  let response: Response;
  try {
    response = await fetch(indexerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query GetZkCredContractAction($address: HexEncoded!) {
          contractAction(address: $address) { address state zswapState transaction { hash } }
        }`,
        variables: { address: contractAddress },
      }),
    });
  } catch (error) {
    throw new Error(`Cannot reach Midnight Indexer at ${indexerUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`Midnight Indexer HTTP error: ${response.status} ${response.statusText}`);
  const json = await response.json() as { data?: { contractAction?: Record<string, unknown> | null }; errors?: unknown[] };
  if (json.errors?.length) throw new Error(`Midnight Indexer GraphQL error: ${JSON.stringify(json.errors)}`);
  const state = json.data?.contractAction;
  if (!state) throw new Error(`Contract ${contractAddress} was not found on the Midnight Preprod Indexer.`);
  const credit = Number(state.minCreditScore);
  const income = BigInt(String(state.minAnnualIncome));
  const age = Number(state.minAge);
  const count = BigInt(String(state.verificationCount));
  if (!Number.isSafeInteger(credit) || !Number.isSafeInteger(age)) throw new Error("Indexer returned malformed ZkCred contract state.");
  return {
    minCreditScore: credit,
    minAnnualIncome: income,
    minAge: age,
    isEligible: Boolean(state.isEligible),
    verificationCount: count,
    admin: typeof state.admin === "string" ? new TextEncoder().encode(state.admin) : new Uint8Array(32),
  };
}
