# AegisID — ZkCred

[![ZkCred CI/CD Pipeline](https://github.com/Sov-ereign/ZkCred/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Sov-ereign/ZkCred/actions/workflows/ci.yml)

**Live demo:** [zk-cred.vercel.app](https://zk-cred.vercel.app) · **Product X:** [@ZK_CRED](https://x.com/ZK_CRED) · **Demo video:** [watch on YouTube](https://youtu.be/InI_dsrYqFY)

ZkCred is a Midnight Compact dApp for proving an age, credit-score, and income threshold without putting those values on-chain. A user signs through Midnight Lace; the browser constructs the Compact transaction, retrieves proving material, and submits it through the wallet.

## Privacy model

The Compact contract has private witnesses for `age`, `creditScore`, `annualIncome`, and a 32-byte `salt`. The frontend closes over these values locally while the circuit is executed. They are not sent to the application API, indexer, or prover as JSON. Each successful proof stores a domain-separated, one-way salt nullifier in contract state; this prevents replay of the same credential secret without revealing the salt or making it reusable across protocols.

An observer can learn the contract thresholds, the final `isEligible` Boolean, the public verification counter, salt nullifiers, and transaction identifiers. An observer cannot learn the raw age, credit score, annual income, salt, or the circuit's private transcript.

The contract source is [zkcred.compact](contract/src/zkcred.compact). Its generated ZKIR and proving keys are under `src/managed/` and are copied into the production web build.

## Status

The application is fail-closed. It does not create a fake proof, fake transaction ID, in-memory user, or default contract state.

The deployed Preprod verifier is configured in the browser and API defaults:

```text
Contract: 56e2bee56953f107b0a20496f64d7a08be62a58626e8fec8a0102c798217f16a
Deployment transaction: 0000f3f761e53f045ae12de5b6689fbf4df1ff2214a3c2edc427d75dc6368fa116
Successful eligibility transaction: 00504ed93fec3cdbfd5dda625986a95f1d5d7e7b5d7f521bedbeec375c0ac43e42
```

The app verifies the contract and every submitted transaction through Midnight Preprod's GraphQL indexer before showing a success state. A visitor can override the address only by deploying another compatible contract through Lace; no unverified address is trusted.

> Upgrade note: the replay-nullifier ledger field changes the Compact verifier keys. The address above is the verified V1 deployment; the V2 source in this branch must be deployed as a new Preprod contract before this change is released. Do not point production at V2 until its new address and initialization transaction have been verified.

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
CONTRACT_ADDRESS=56e2bee56953f107b0a20496f64d7a08be62a58626e8fec8a0102c798217f16a
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

Deployment requires an interactive browser connection to Lace because the user must approve and fund it. The shipped app defaults to the verified Preprod contract above; after a new deployment, verify its address through the Preprod indexer before choosing it in a browser or configuring `CONTRACT_ADDRESS` for the API.

For the initial deployment, connect Lace in the local dApp, then run this from the browser developer console:

```js
await window.ZkCredMidnight.deploy({
  minCreditScore: 700,
  minAnnualIncome: 5_000_000,
  minAge: 21,
});
```

Lace will display the real transaction for approval. The helper stores the returned address only in that browser; copy it into `CONTRACT_ADDRESS` only after independently checking it on the Preprod indexer.

## Administrator threshold updates

The deployment helper creates a random 32-byte administrator witness and stores it only in the deploying browser's local storage. That browser exposes an **Update public eligibility thresholds** panel after it connects Lace. `updateThresholds` is a real wallet-backed Compact call and requires this private witness; other users cannot authorize the circuit. Keep that browser profile backed up and do not clear its site storage before handing off contract administration.

## Tests and CI

```bash
npm test
npx tsc --noEmit
npm run ui:build
```

The suite has 11 passing tests for the private-witness boundary, salt-nullifier replay protection, generated proving assets, actual generated Compact-runtime circuit execution, strict indexer failures, administrator authorization, and utility encoding. GitHub Actions validates the committed Compact proof assets, runs the test suite, TypeScript checks, and the Vite production build on push and pull requests; see [ci.yml](.github/workflows/ci.yml). The Compact CLI is required locally when contract source changes (`npm run compile`).

## Hosted deployment

Vercel builds `ui/dist` via `npm run ui:build`, including the Midnight browser bundle, WASM modules, and compiled proof assets. The `/api/*` rewrite targets `api/index.js`. Vercel does **not** host the prover: Lace provides the configured remote Preprod prover URI to the browser. The public contract address is compiled into the client and API defaults; `CONTRACT_ADDRESS` is an optional server-side override.

## Submission evidence

The repository contains the Compact source, CI workflow, reproducible tests, and a test-output screenshot.

![Test output: current repository test run](assets/npm_test.png)

For final submission, record/upload the current one-minute walkthrough showing Lace connection and a finalized proof transaction, then replace the demo-video URL above if needed. Idea approval is maintained in the external submission process.
