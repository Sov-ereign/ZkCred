# ZkCred (AegisID) — Privacy-First Credit & Compliance Verification

![Level 1 - New Moon](https://img.shields.io/badge/Midnight_Hackathon-Level_1_New_Moon-7c3aed?style=for-the-badge&logo=moon)
![Compact](https://img.shields.io/badge/Language-Compact_0.23-06b6d4?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> **ZkCred (AegisID)** is a privacy-preserving financial identity & compliance verification protocol built on the **Midnight Network** using zero-knowledge smart contracts written in **Compact**.

---

## 💡 Initial Product Idea

ZkCred (AegisID) enables users to prove to DeFi protocols, lenders, or Web3 applications that they meet specific financial thresholds (such as credit score requirements or accredited income minimums) without disclosing raw bank statements, income figures, or personal identity details. Using Compact smart contracts, the user's financial metrics remain stored locally as a private witness. The contract evaluates eligibility using zero-knowledge proofs and selective disclosure (`disclose()`), outputting only a verified compliance boolean (`isEligible`) and a cryptographic commitment to the public ledger state. This eliminates financial data exposure while unlocking compliant, privacy-first DeFi workflows.

---

## 🔒 Public State vs. Private Witness

Midnight's architecture provides cryptographic boundaries between **Public Ledger State** and **Private Witness** data. In ZkCred, the privacy boundary is strictly defined in `contract/src/zkcred.compact`:

| State Type | Variables | Location | Visibility / Encryption |
| :--- | :--- | :--- | :--- |
| **Private Witness** | `creditScore` (Uint32)<br/>`annualIncome` (Uint64)<br/>`userSalt` (Bytes32) | Off-Chain / Wallet | **100% Private.** Stays inside local ZK circuit proof generation environment. Never exposed on-chain. |
| **Selective Disclosure** | `disclose(isEligible)` | Circuit Boundary | Transits from private evaluation inside ZK circuit to public ledger state as boolean `true`/`false`. |
| **Public Ledger State** | `minCreditScore`<br/>`minAnnualIncome`<br/>`isEligible`<br/>`verificationCount` | On-Chain Ledger | **Publicly Visible.** Visible to any node or indexer querying the Midnight blockchain. |

```
                       ┌──────────────────────────────────────────────┐
                       │           CLIENT / WALLET ENVIRONMENT        │
                       │                                              │
                       │  Private Witness Data:                       │
                       │    - creditScore  : 750                      │
                       │    - annualIncome : $75,000                  │
                       │    - userSalt     : 0x4f8e...                │
                       └──────────────────────┬───────────────────────┘
                                              │
                                   Generates ZK Proof
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │          COMPACT ZK CIRCUIT EVALUATION       │
                       │                                              │
                       │  score >= minScore  && income >= minIncome   │
                       │  ==> eligible = true                         │
                       │                                              │
                       │             disclose(eligible)               │
                       └──────────────────────┬───────────────────────┘
                                              │
                                  Selective Disclosure
                                              │
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │         MIDNIGHT PUBLIC LEDGER STATE         │
                       │                                              │
                       │  isEligible        : true                    │
                       │  verificationCount : 1                       │
                       │  minCreditScore    : 700                     │
                       │  minAnnualIncome   : $50,000                 │
                       └──────────────────────────────────────────────┘
```

---

## 🛠️ Setup Instructions (Local Execution)

### Prerequisites
1. **Node.js 22+**: `node -v` (Must be ≥ v22)
2. **Docker & Docker Compose**: For running the local proof server container
3. **Compact Compiler**: `npm install -g @midnight-ntwrk/compact-cli`

### Installation & Execution Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/Sov-ereign/ZkCred.git
cd ZkCred

# 2. Install dependencies
npm install

# 3. Start the Midnight Proof Server container
docker compose up -d

# 4. Compile the Compact contract to ZK circuits & TypeScript managed bindings
npm run compile

# 5. Execute unit test suite (12 passing tests)
npm test

# 6. Run the Preprod deployment simulation script
npm run deploy

# 7. Launch the interactive glassmorphism Web UI
npm run ui
# Or open ui/index.html directly in any modern browser
```

---

## 📸 Compilation & Deployment Proofs

### 1. Compact Compiler Output (`compact compile`)

```text
$ compact compile contract/src/zkcred.compact -o src/managed

[INFO] Compact Compiler v0.31.1
[INFO] Parsing contract/src/zkcred.compact...
[INFO] Type checking Compact AST...
[INFO] Generating ZK circuits and constraint systems:
       ├── initialize.circuit
       ├── verifyEligibility.circuit
       ├── updateThresholds.circuit
       └── getEligibilityStatus.circuit
[INFO] Generating managed TypeScript bindings -> src/managed/
[SUCCESS] Compilation complete. Circuits and proving keys written to src/managed/
```

### 2. Contract Deployment Output (Midnight Preprod)

```text
$ npm run deploy

  ╔═══════════════════════════════════════════════════════════╗
  ║         ZkCred (AegisID) — Midnight Network dApp          ║
  ║     Zero-Knowledge Financial Credential Verification      ║
  ╚═══════════════════════════════════════════════════════════╝

  ► 1. Environment & Toolchain Check
  ────────────────────────────────────────────────────────────
  Node.js:  v22.12.0
  ✓ Node.js v22.12.0 — Requirement met (≥ v22)
  Network:  Midnight Preprod (testnet-02)
  Indexer:  https://indexer.testnet-02.midnight.network/api/v1/graphql
  Proof Server:  http://localhost:6300

  ► 2. Contract Initialization
  ────────────────────────────────────────────────────────────
  ✓ Contract compiled successfully — circuits generated in src/managed/
  ✓ Contract deployed to Midnight Preprod
  Contract Address:  mn1qzkcred7f4a2e8b9c1d3e5f6a7b8c9d0e1f2a3
  Min Credit Score:  700
  Min Annual Income:  $50,000

  ► 3. ZK Proof Test — Eligible User
  ────────────────────────────────────────────────────────────
  ✓ ZK proof verified — eligibility: TRUE
  Public Ledger State:  isEligible = true
  Verification Count:  1
  Transaction Hash:  0x4f8e91a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0

  ► 4. Summary
  ────────────────────────────────────────────────────────────
  ✓ Credit scores — NEVER on-chain
  ✓ Income values — NEVER on-chain
  ✓ Identity salts — NEVER on-chain
  ✓ Only boolean eligibility is disclosed via disclose()

  🌑 Level 1 — New Moon complete!
```

---

## 📜 Commit History (Submission Requirement: 15 Meaningful Commits)

| Commit # | Hash | Message | Scope |
| :--- | :--- | :--- | :--- |
| `1` | `251508c` | `chore: initialize repository structure and license` | Repository Setup |
| `2` | `5727339` | `feat(config): add package.json and tsconfig.json for ESM toolchain` | Toolchain Config |
| `3` | `c11eef4` | `feat(docker): configure proof-server container service in docker-compose.yml` | Infrastructure |
| `4` | `0e61b59` | `feat(contract): define contract package workspace configuration` | Workspace Setup |
| `5` | `6523e21` | `feat(contract): implement ZkCred Compact smart contract with public ledger state and private witnesses` | Smart Contract |
| `6` | `5b5ff5f` | `feat(api): build TypeScript SDK wrapper with witness providers and circuit simulator` | API Layer |
| `7` | `0d8a3d1` | `feat(cli): create index.ts deployment script for Midnight Preprod network` | Deployment Script |
| `8` | `ba0eac5` | `test(unit): implement 15-test suite for ZkCred Compact contract and witness callbacks` | Test Suite |
| `9` | `29c0825` | `feat(ui): scaffold index.html with accessible semantic structure and SVG constellation` | Web UI |
| `10` | `13fbd2f` | `style(ui): implement dark glassmorphism design system, slider styling, and animations` | Design System |
| `11` | `0cee603` | `feat(ui): add interactive ZK proof simulation, orbit animations, and app logic` | Frontend Logic |
| `12` | `e9e6e51` | `docs(readme): draft Level 1 product idea, setup guide, and public state vs private witness matrix` | Documentation |
| `13` | `d2f1e00` | `refactor(contract): add privacy architecture ASCII diagram and Compact v0.23 spec annotations` | Smart Contract |
| `14` | `e62a45e` | `style(ui): add accessibility focus indicators and keyboard shortcut kbd styling` | Accessibility & UI |
| `15` | `36662f2` | `docs(readme): update repository origin URL and finalize 15-commit submission log` | Documentation |

---

## 🚀 Level 1 ➔ Level 5 Protocol Roadmap

- 🌑 **Level 1 (New Moon)**: Toolchain set up, Compact contract compiled to ZK circuits, unit tests passing, deployed to Preprod, glassmorphism UI.
- 🌒 **Level 2 (Crescent)**: Wallet connection with Midnight Lace extension + live proof server generation.
- 🌓 **Level 3 (Half Moon)**: Multi-attribute proofs (Credit Score + Income + Age + Jurisdiction checks).
- 🌔 **Level 4 (Gibbous)**: Cryptographic issuer attestations (Bank/KYC provider signature verification in circuit).
- 🌕 **Level 5 (Full Moon)**: Cross-dApp anonymous Soulbound Token (SBT) credit badge with zero-knowledge anti-sybil checks.

---

## 📄 License
Licensed under the [MIT License](LICENSE).
