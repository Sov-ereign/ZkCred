# AegisID — ZkCred

ZkCred is a Midnight Compact dApp for proving an age, credit-score, and income threshold without putting those values on-chain. A user signs through Midnight Lace; the browser constructs the Compact transaction, retrieves proving material, and submits it through the wallet.

## Privacy model

The Compact contract has private witnesses for `age`, `creditScore`, `annualIncome`, and a 32-byte `salt`. The frontend closes over these values locally while the circuit is executed. They are not sent to the application API, indexer, or prover as JSON.

An observer can learn the contract thresholds, the final `isEligible` Boolean, the public verification counter, and transaction identifiers. An observer cannot learn the raw age, credit score, annual income, salt, or the circuit's private transcript.

The contract source is [zkcred.compact](contract/src/zkcred.compact). Its generated ZKIR and proving keys are under `src/managed/` and are copied into the production web build.

## Status

The application is fail-closed. It does not create a fake proof, fake transaction ID, in-memory user, or default contract state.

There is currently **no verified Preprod contract address configured in this repository**. The old address was queried against the public Preprod indexer on 11 September 2026 and returned `contractAction: null`, so it was removed. A funded, unlocked Lace account must deploy the contract and set the emitted address as `CONTRACT_ADDRESS` before a proof can be submitted. This is intentional: claiming a deployment before it exists would be misleading.

## Run locally

Prerequisites: Node 22+, Docker, Midnight Lace configured for Preprod, a funded Preprod account, MongoDB, and a Google OAuth client only if Google login is needed.

```bash
npm install
docker-compose up -d
curl --fail http://127.0.0.1:6300/health
cp .env.example .env
npm run ui
```

Open the Vite URL (normally `http://localhost:5173`). Do not open `ui/index.html` directly: the Midnight client must be bundled by Vite.

Set the following environment values in `.env` for the API server, and as environment variables in Vercel for a deployment:

```dotenv
JWT_SECRET=a-long-random-secret
MONGODB_URI=mongodb+srv://...
MIDNIGHT_INDEXER_URL=https://indexer.preprod.midnight.network/api/v3/graphql
CONTRACT_ADDRESS=0x... # only after verifying deployment on Preprod
```

Start the API locally with `npm run server`. The browser calls `/api` when hosted with Vercel; for a separate local API, set `window.__RENDER_API__` before loading the page.

## Wallet and circuit flow

1. The user signs in. MongoDB is required; unauthenticated or database-unavailable operations are rejected.
2. The user connects Midnight Lace. The app polls the standard `window.midnight` connector map and invokes `InitialAPI.connect("preprod")`.
3. The browser gets the wallet's indexer/prover configuration, constructs official MidnightJS providers, and fetches the generated ZK assets.
4. `verifyEligibility` runs with local private witness callbacks. The wallet balances the serialized transaction and submits it.
5. The application records only the public transaction ID and disclosed result in MongoDB after submission; it never receives raw witness values.

The implemented adapter is [midnight-client.ts](ui/midnight-client.ts). It uses `CompiledContract`, `findDeployedContract`, and `submitCallTx` from MidnightJS. It verifies the deployed verifier keys before it uses witnesses.

## Deploy the Compact contract

Compile first:

```bash
npm run compile
```

Deployment requires an interactive browser connection to Lace because the user must approve and fund it. After deployment, verify its address through the Preprod indexer, then set `CONTRACT_ADDRESS` in local/Vercel/server environments. The client will refuse to generate a proof if the address is absent, unrecognized by the indexer, or has verifier keys different from the compiled contract.

For the initial deployment, connect Lace in the local dApp, then run this from the browser developer console:

```js
await window.ZkCredMidnight.deploy({
  minCreditScore: 700,
  minAnnualIncome: 5_000_000,
  minAge: 21,
});
```

Lace will display the real transaction for approval. The helper stores the returned address only in that browser; copy it into `CONTRACT_ADDRESS` only after independently checking it on the Preprod indexer.

## Tests and CI

```bash
npm test
npx tsc --noEmit
npm run ui:build
```

The suite has 9 passing tests for the private-witness boundary, no salt disclosure, generated proving assets, strict indexer failures, and utility encoding. GitHub Actions compiles Compact, runs the test suite, TypeScript checks, and the Vite production build on push and pull requests; see [ci.yml](.github/workflows/ci.yml).

## Hosted deployment

Vercel builds `ui/dist` via `npm run ui:build`, including the Midnight browser bundle, WASM modules, and compiled proof assets. The `/api/*` rewrite targets `api/index.js`. Configure all required secrets and `CONTRACT_ADDRESS` in the Vercel project before treating a hosted URL as a working Preprod dApp.

## Submission evidence

The repository contains the Compact source, CI workflow, and reproducible tests. A real submission still needs evidence that cannot be generated without the account owner: a public repository, a verified Preprod deployment address, a hosted deployment with configuration, a CI run, and a video showing Lace approval and finalized transaction.
