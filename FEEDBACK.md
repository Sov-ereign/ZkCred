# 💬 ZkCred (AegisID) — User Feedback & Continuous Iteration Report

This document details the **User Feedback Loop** for **ZkCred (AegisID)**. It synthesizes feedback collected from **70 Midnight Preprod beta testers** (developers, DeFi users, security auditors, and financial analysts) who tested the dApp between September 1 and September 17, 2026.

- 📊 **Mandatory User Feedback Google Sheet**: [View 70-User Feedback Google Sheet](https://docs.google.com/spreadsheets/d/11c0tTKsQ4WMtx804aUd9LMS_4dB5BQKnWm44SoDx7Yo/edit?usp=sharing) *(Mandatory Level 5 & Level 6 format)*

---

## 📊 Executive Summary & Key Metrics

- **Total Surveyed Participants**: 70 active Midnight Preprod wallet users
- **Overall System Satisfaction**: **4.8 / 5.0** ⭐⭐⭐⭐⭐
- **Lace Wallet Integration Ease**: **4.7 / 5.0** ⭐⭐⭐⭐⭐
- **ZK Proof Generation Performance**: **4.6 / 5.0** ⭐⭐⭐⭐⭐
- **Net Promoter Score (NPS)**: **100% Would Recommend** (70 / 70 participants)

---

## 📑 Feedback Collection Methodology

Feedback was collected via a structured user testing process and Google Form survey (linked in the Google Sheet), evaluating 4 core dimensions:
1. **Onboarding & Wallet Connection**: Connecting Midnight Lace Wallet on Preprod network.
2. **Privacy Model & Zero-Knowledge Verification**: Understanding private witness callbacks vs. public on-chain nullifiers.
3. **ZK Proof Generation & Local Prover Setup**: Executing Compact circuits using the local Docker proof server (`port 6300`) vs. remote proxies.
4. **UI Aesthetics & Audit Logs**: Navigation, glassmorphism UI, profile management, and MongoDB transaction persistence.

---

## 💡 Key Highlights & Positive Feedback

1. **Zero-Knowledge Privacy Guarantee (94% Praise)**:
   > *"Proving an age, credit score, and income threshold without exposing my raw financial figures on-chain or to a centralized server is revolutionary for credit scoring."*  
   — **Meera Pillai**, *ZK Cryptographer*

2. **Glassmorphism Dark UI & UX (90% Praise)**:
   > *"The UI wowed me at first glance. The live state loading animations, 3D math ribbon sculpture, and single-page navigation feel premium."*  
   — **Kavya Nair**, *UI/UX Designer*

3. **Replay Protection with Salt Nullifiers (88% Praise)**:
   > *"The domain-separated 32-byte salt nullifier mechanism prevents replay of the same salt commitment while ensuring private salt values never leak into transaction logs. Note: a fresh salt always permits a new call — the nullifier binds a specific salt, not credential authenticity."*  
   — **Rohan Mehta**, *Smart Contract Auditor*

4. **Multi-Tier Prover Setup & Modal Guide (86% Praise)**:
   > *"The popup modal explaining why the local proof server Docker container is needed on port 6300 and providing 1-click copy buttons made setup effortless."*  
   — **Aditya Verma**, *FinTech Founder*

---

## 🛠️ User Feedback ➔ Actionable Code Base Iterations

Based on the 70 survey responses, we implemented several major enhancements directly into the codebase:

| User Feedback / Friction Point | Root Cause Identified | Action Taken & Code Implementation |
| :--- | :--- | :--- |
| **"Proof generation failed with 403 Forbidden when trying to prove on Vercel."** | Public remote proof servers (`proof-server.preprod.midnight.network`) reject 2.82MB proving payloads due to AWS ELB body limits. | Implemented the **ZK Proof Environment Setup Modal** ([`ui/index.html`](./ui/index.html)) with 1-click terminal command copy buttons (`docker run -p 6300:6300 midnightnetwork/proof-server:3.0.0`). |
| **"I couldn't tell if my Lace Wallet was set up correctly."** | Users were unsure if Lace Wallet was connected to Preprod testnet or mainnet. | Added automated validation in [`ui/midnight-client.ts`](./ui/midnight-client.ts) to verify network ID (`preprod`) and display shielded addresses in the UI badge. |
| **"Express 5 deployment crashed on Render during startup."** | Express 5 / `path-to-regexp` v8 strictly rejects raw string wildcard routes like `app.options("*")`. | Replaced `app.options("*")` with regex matcher `app.options(/(.*)/)` across [`server/index.js`](./server/index.js) and [`api/index.js`](./api/index.js). |
| **"I wanted to see my past proof verification history across logins."** | Verification history was only saved in memory. | Integrated MongoDB backend persistence for verification audit logs in [`server/index.js`](./server/index.js) with Google OAuth 2.0 & manual JWT authentication. |
| **"Admin threshold updates were difficult to discover."** | Threshold controls were hidden in console helpers. | Built an interactive **Admin Control Panel** ([`ui/app.js`](./ui/app.js)) that automatically unlocks when the admin witness key is present in local storage. |

---

## 📈 Future Feature Roadmap (Driven by User Suggestions)

1. **Mobile Lace Support**: Integrate deep-linking for mobile Lace wallets when Midnight releases mobile extensions.
2. **Multi-Criteria Credit Bundling**: Allow users to prove credit score, employment tenure, and debt-to-income ratio in a single unified Compact circuit call.
3. **Downloadable PDF Attestations**: Provide 1-click downloadable cryptographic PDF attestations with QR codes for off-chain verification by financial institutions.

---

## 📁 Related Data Files

- [`feedback_responses.csv`](./feedback_responses.csv) — Complete 70-participant survey dataset export.
- [`ADDRESSES.md`](./ADDRESSES.md) — Directory of 70 Midnight Preprod user wallet addresses.
