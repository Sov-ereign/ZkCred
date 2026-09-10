# AegisID — ZkCred

> **Privacy-First Multi-Attribute ZK Eligibility Gate on Midnight Network**

[![CI](https://github.com/Sov-ereign/ZkCred/actions/workflows/ci.yml/badge.svg)](https://github.com/Sov-ereign/ZkCred/actions)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-zk--cred.vercel.app-7c3aed?logo=vercel)](https://zk-cred.vercel.app)
[![Midnight Preprod](https://img.shields.io/badge/Midnight-Preprod-06b6d4)](https://indexer.preprod.midnight.network/api/v1/graphql)
[![X / Twitter](https://img.shields.io/badge/%40ZK__CRED-000000?logo=x)](https://x.com/ZK_CRED)
[![License: MIT](https://img.shields.io/badge/License-MIT-a78bfa)](LICENSE)

---

## 🌐 Live Links

| Resource | URL |
|---|---|
| **Live dApp** | [https://zk-cred.vercel.app](https://zk-cred.vercel.app) |
| **Backend API** | [https://zkcred-api.onrender.com](https://zkcred-api.onrender.com) |
| **Demo Video** | [https://youtu.be/InI_dsrYqFY](https://youtu.be/InI_dsrYqFY) |
| **X / Twitter** | [https://x.com/ZK_CRED](https://x.com/ZK_CRED) |
| **GitHub** | [https://github.com/Sov-ereign/ZkCred](https://github.com/Sov-ereign/ZkCred) |

---

## 📦 Contract Deployment

| Field | Value |
|---|---|
| **Network** | Midnight Preprod (`testnet-02`) |
| **Contract Address** | `0x02008f3a9e1028741362e49abfbd6a6a165b4ee3f7e6a71e41120021b33edfa54737` |
| **Deployed** | September 2026 |
| **Indexer** | `https://indexer.preprod.midnight.network/api/v1/graphql` |
| **Circuit** | `verifyEligibility` (Compact PLONK zk-SNARK) |

### Verify Live Contract State via GraphQL

```graphql
query {
  contractState(address: "0x02008f3a9e1028741362e49abfbd6a6a165b4ee3f7e6a71e41120021b33edfa54737") {
    minCreditScore
    minAnnualIncome
    minAge
    isEligible
    verificationCount
    lastCommitment
  }
}
```

**Response:**
```json
{
  "data": {
    "contractState": {
      "minCreditScore": 700,
      "minAnnualIncome": "5000000",
      "minAge": 21,
      "isEligible": true,
      "verificationCount": "14",
      "lastCommitment": "0x02008f..."
    }
  }
}
```

---

## 🔒 Privacy Model

AegisID uses Midnight's Compact language to prove multi-attribute financial eligibility **without exposing any private values on-chain**.

| Data | Visibility |
|---|---|
| Age (e.g. `24`) | ❌ **Private** — never leaves the browser |
| Credit Score (e.g. `720`) | ❌ **Private** — never leaves the browser |
| Annual Income (e.g. `$60,000`) | ❌ **Private** — never leaves the browser |
| User Salt (32-byte nonce) | ❌ **Private** — witness only, never serialized |
| `isEligible: true/false` | ✅ **Public** — disclosed via `disclose()` on Midnight ledger |
| `verificationCount` | ✅ **Public** — integer counter, publicly incrementing |
| Transaction Hash | ✅ **Public** — ZK proof commitment on-chain |

### What an Observer Can and Cannot Learn

**An observer querying the Midnight Preprod ledger CAN learn:**
- Whether the prover is eligible (`true` or `false`)
- How many total verifications have been submitted
- The transaction hash of the proof submission

**An observer CAN NOT learn:**
- The prover's actual age
- The prover's actual credit score
- The prover's actual annual income
- Any intermediate circuit witness values
- The salt used for commitment derivation

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser (Client)                       │
│  Private Witnesses: age, creditScore, income, salt      │
│  (never sent over network)                              │
│  Compact Circuit: verifyEligibility()                   │
│  PLONK zk-SNARK proof generated                         │
└──────────────────────────┬──────────────────────────────┘
                           │ disclose(isEligible)
                           ▼
┌─────────────────────────────────────────────────────────┐
│          Midnight Network (Preprod)                      │
│  Public Ledger: isEligible, verificationCount, txHash   │
│  Contract: 0x02008f3a9e...54737                         │
└─────────────────────────────────────────────────────────┘
```

**Stack:**
- **Smart Contract**: Compact (`.compact`) → compiled to PLONK zk-SNARK circuits
- **Frontend**: Vanilla HTML/CSS/JS hosted on Vercel
- **Backend API**: Express.js on Render ([zkcred-api.onrender.com](https://zkcred-api.onrender.com))
- **Wallet**: Lace DApp Connector (Midnight extension)
- **Auth**: JWT + Google OAuth 2.0 via Render backend
- **Audit Log**: MongoDB Atlas (verification records persisted per user)

---

## 🧪 Tests

14 unit tests covering the full Midnight.js integration layer — all passing in CI.

```
PASS  tests/zkcred.test.ts

  ZkCred Runtime Contract — Initialization & Deployment
    ✓ deployZkCredContract initializes contract state with admin authorization and thresholds
    ✓ deployZkCredContract returns a valid Midnight Preprod contract address (0x02...)
    ✓ createWitnessCallbacks returns all four required private witness callbacks

  ZkCred Circuit — verifyEligibility() Eligibility Logic
    ✓ verifyEligibility returns isEligible: true when all three attributes pass threshold
    ✓ verifyEligibility returns isEligible: false when credit score is below minimum
    ✓ verifyEligibility returns isEligible: false when annual income is below minimum
    ✓ verifyEligibility returns isEligible: false when age is below minimum (Age Gate)
    ✓ verifyEligibility returns isEligible: false when all three attributes fail
    ✓ verifyEligibility increments verificationCount on each successful call

  ZkCred Circuit — updateThresholds() Admin Authorization
    ✓ updateThresholds rejects calls without admin key (authorization failure)
    ✓ updateThresholds accepts and applies new thresholds when admin key matches

  ZkCred — Salt Commitment & Cryptographic Utilities
    ✓ deriveSaltCommitment returns a deterministic 66-char 0x02-prefixed hex commitment
    ✓ deriveSaltCommitment produces different outputs for different salts (collision-resistant)

  ZkCred — Midnight Indexer Integration
    ✓ fetchLedgerStateFromIndexer reads live verificationCount from Midnight Preprod Indexer

Tests: 14 passed, 14 total
```

---

## 🔁 CI/CD Pipeline

GitHub Actions runs on every push to `main`:

1. `npm ci` — install dependencies
2. Validate Compact contract assets (`src/managed/`)
3. `npm test` — 14 unit tests
4. `npm run build` — TypeScript compilation

[![CI Status](https://github.com/Sov-ereign/ZkCred/actions/workflows/ci.yml/badge.svg)](https://github.com/Sov-ereign/ZkCred/actions)

---

## 📋 Submission Checklist

### Level 2 — Wallet & Circuit Integration ✅
- [x] Lace wallet connect / disconnect implemented
- [x] Circuit called successfully from frontend (`verifyEligibility` via proof API)
- [x] Observable privacy behavior — only `isEligible` disclosed, witnesses shielded
- [x] Contract deployed to Midnight Preprod with verifiable address
- [x] 40+ meaningful commits

### Level 3 — Full dApp ✅
- [x] Fully functional dApp using Midnight's privacy model
- [x] 14 tests passing (3+ required)
- [x] CI/CD pipeline running (workflow + passing runs)
- [x] Approved idea: **Option 2 — Age / Eligibility Gate**
- [x] README privacy model section (what observer can and cannot learn)
- [x] Demo video: [youtu.be/InI_dsrYqFY](https://youtu.be/InI_dsrYqFY)
- [x] 40+ meaningful commits (10+ required)

### Level 4 — Working MVP Live on Preprod ✅
- [x] Working MVP live: [zk-cred.vercel.app](https://zk-cred.vercel.app)
- [x] Backend API live: [zkcred-api.onrender.com](https://zkcred-api.onrender.com)
- [x] Contract address verifiable on Midnight Preprod indexer
- [x] Full documentation (this README)
- [x] CI/CD badge — passing
- [x] Product X profile: [@ZK_CRED](https://x.com/ZK_CRED)
- [x] Demo video: [youtu.be/InI_dsrYqFY](https://youtu.be/InI_dsrYqFY)
- [x] 40+ meaningful commits (15+ required)

---

## 🏆 Product Proposal

**Track:** Midnight Hackathon — Option 2: Age / Financial Eligibility Gate

**Problem:** DeFi protocols and gated communities need to verify user eligibility without storing or exposing sensitive personal data. Current solutions require full KYC disclosure — a privacy violation by design.

**Solution:** AegisID (ZkCred) provides a **multi-attribute ZK eligibility gate** where users prove age ≥ 21, credit score ≥ 700, and annual income ≥ $50,000 — without revealing the actual values. Only a boolean `isEligible` is written to the Midnight public ledger.

**Use Cases:**
- DeFi lending eligibility gates
- DAO governance voting rights
- Age-gated content/services
- Credit-based DeFi access without credit bureaus

---

## 📄 License

MIT © 2026 ZkCred Team — [@ZK_CRED](https://x.com/ZK_CRED)
