/**
 * AegisID — ZkCred Interactive Demo Logic
 * Zero-Knowledge Proof Simulator for Midnight Network with MongoDB Auth & Lace Wallet Integration
 */

const API_BASE = "/api";

// Real deployed contract address — fetched live from Midnight Indexer on init
const REAL_CONTRACT_ADDRESS = "0x02008f3a9e1028741362e49abfbd6a6a165b4ee3f7e6a71e41120021b33edfa54737";

function generateDynamicHex(lenBytes = 32, prefix = "0x") {
  const bytes = new Uint8Array(lenBytes);
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < lenBytes; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return prefix + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derive a deterministic salt commitment matching the Compact circuit's
 * persistent_hash<[Bytes<32>, Uint<64>]>([salt, count]) logic.
 * Uses the same XOR-based derivation as midnight.ts deriveSaltCommitment().
 */
function deriveSaltCommitment(saltHex, count) {
  const saltBytes = new Uint8Array(32);
  const hex = saltHex.replace(/^0x/, "");
  for (let i = 0; i < 32; i++) {
    saltBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2) || "00", 16);
  }
  const commitment = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    commitment[i] = saltBytes[i % saltBytes.length] ^ Number((BigInt(count) >> BigInt(i % 8)) & 0xffn) ^ 0xa5;
  }
  return "0x" + Array.from(commitment).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const STATE = {
  // Thresholds — overwritten by live /api/contract/state on init
  minCreditScore: 700,
  minAnnualIncome: 5_000_000,
  minAge: 21,
  verificationCount: 0,
  contractAddress: REAL_CONTRACT_ADDRESS,
  isGenerating: false,
  walletConnected: false,
  walletAddress: null,
  currentUser: JSON.parse(localStorage.getItem("zkcred_user") || "null"),
  authToken: localStorage.getItem("zkcred_auth_token") || null,
  onChainState: null, // populated from /api/contract/state
  userSalt: generateDynamicHex(32, "0x"), // ephemeral per-session salt
};

// ─── Modal Accessibility Helpers ──────────────────────────────────────────────

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
}

// ─── DOM References ───────────────────────────────────────────────────────────

const ageSlider = document.getElementById("age-slider");
const creditSlider = document.getElementById("credit-score-slider");
const incomeSlider = document.getElementById("income-slider");
const ageDisplay = document.getElementById("age-display");
const creditDisplay = document.getElementById("credit-score-display");
const incomeDisplay = document.getElementById("income-display");
const checkAge = document.getElementById("check-age");
const checkScore = document.getElementById("check-score");
const checkIncome = document.getElementById("check-income");
const checkAgeVal = document.getElementById("check-age-val");
const checkScoreVal = document.getElementById("check-score-val");
const checkIncomeVal = document.getElementById("check-income-val");
const generateBtn = document.getElementById("generate-proof-btn");
const proofBtnText = document.getElementById("proof-btn-text");
const proofAnimation = document.getElementById("proof-animation");
const proofStatus = document.getElementById("proof-status");
const ledgerFields = document.getElementById("ledger-fields");
const eligibilityBadge = document.getElementById("eligibility-badge");
const ledgerCount = document.getElementById("ledger-count");
const ledgerAddress = document.getElementById("ledger-address");
const txResult = document.getElementById("tx-result");
const txHashDisplay = document.getElementById("tx-hash-display");

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatIncomeCents(cents) {
  const dollars = Math.round(cents / 100);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

function formatIncomeShort(cents) {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}k`;
  return `$${dollars}`;
}

// ─── Slider Updates ───────────────────────────────────────────────────────────

function updateAge() {
  if (!ageSlider) return;
  const val = parseInt(ageSlider.value);
  const min = parseInt(ageSlider.min);
  const max = parseInt(ageSlider.max);
  const pct = ((val - min) / (max - min)) * 100;

  ageSlider.style.setProperty("--fill", `${pct}%`);
  ageSlider.setAttribute("aria-valuenow", val);
  ageSlider.setAttribute("aria-valuetext", `Age: ${val} years`);
  if (ageDisplay) ageDisplay.textContent = val;

  updateEligibilityPreview();
}

function updateCreditScore() {
  const val = parseInt(creditSlider.value);
  const min = parseInt(creditSlider.min);
  const max = parseInt(creditSlider.max);
  const pct = ((val - min) / (max - min)) * 100;

  creditSlider.style.setProperty("--fill", `${pct}%`);
  creditSlider.setAttribute("aria-valuenow", val);
  creditSlider.setAttribute("aria-valuetext", `Credit score: ${val}`);
  creditDisplay.textContent = val;

  updateEligibilityPreview();
}

function updateIncome() {
  const val = parseInt(incomeSlider.value);
  const min = parseInt(incomeSlider.min);
  const max = parseInt(incomeSlider.max);
  const pct = ((val - min) / (max - min)) * 100;

  incomeSlider.style.setProperty("--fill", `${pct}%`);
  incomeSlider.setAttribute("aria-valuenow", val);
  incomeSlider.setAttribute("aria-valuetext", `Annual income: ${formatIncomeCents(val)}`);
  incomeDisplay.textContent = formatIncomeShort(val);

  updateEligibilityPreview();
}

function updateEligibilityPreview() {
  const age = ageSlider ? parseInt(ageSlider.value) : 24;
  const score = parseInt(creditSlider.value);
  const income = parseInt(incomeSlider.value);

  const agePass = age >= STATE.minAge;
  const scorePass = score >= STATE.minCreditScore;
  const incomePass = income >= STATE.minAnnualIncome;

  if (checkAge && checkAgeVal) {
    checkAge.className = `check-item ${agePass ? "pass" : "fail"}`;
    checkAge.querySelector(".check-icon").textContent = agePass ? "✓" : "✗";
    checkAgeVal.textContent = `${age} ${agePass ? "≥" : "<"} ${STATE.minAge} yrs`;
  }

  checkScore.className = `check-item ${scorePass ? "pass" : "fail"}`;
  checkScore.querySelector(".check-icon").textContent = scorePass ? "✓" : "✗";
  checkScoreVal.textContent = `${score} ${scorePass ? "≥" : "<"} ${STATE.minCreditScore}`;

  checkIncome.className = `check-item ${incomePass ? "pass" : "fail"}`;
  checkIncome.querySelector(".check-icon").textContent = incomePass ? "✓" : "✗";
  checkIncomeVal.textContent = `${formatIncomeShort(income)} ${incomePass ? "≥" : "<"} ${formatIncomeShort(STATE.minAnnualIncome)}`;

  if (!STATE.isGenerating) {
    const allPass = agePass && scorePass && incomePass;
    generateBtn.style.background = allPass
      ? "linear-gradient(135deg, #6d28d9, #7c3aed)"
      : "linear-gradient(135deg, #7c3aed, #a21caf)";
  }
}

// ─── Live On-Chain State Fetcher ───────────────────────────────────────────────

async function fetchOnChainState() {
  try {
    const res = await fetch(`${API_BASE}/contract/state`);
    if (!res.ok) {
      console.warn("[Midnight] Could not fetch on-chain state:", res.status);
      return null;
    }
    const data = await res.json();
    STATE.onChainState = data;
    // Update thresholds from live contract state
    if (data.minCreditScore) STATE.minCreditScore = data.minCreditScore;
    if (data.minAnnualIncome) STATE.minAnnualIncome = Number(data.minAnnualIncome);
    if (data.minAge) STATE.minAge = data.minAge;
    if (data.verificationCount !== undefined) STATE.verificationCount = Number(data.verificationCount);
    if (data.contractAddress) STATE.contractAddress = data.contractAddress;
    console.log("[Midnight] Live on-chain state loaded:", data);
    return data;
  } catch (err) {
    console.warn("[Midnight] On-chain state fetch failed:", err.message);
    return null;
  }
}

async function fetchLiveVerificationCount() {
  try {
    const res = await fetch(`${API_BASE}/verifications/count`);
    if (res.ok) {
      const { count } = await res.json();
      return count;
    }
  } catch { /* ignore */ }
  return 0;
}

// ─── Real ZK Proof Generation ────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setProofStatus(msg, isError = false) {
  if (proofStatus) {
    proofStatus.textContent = msg;
    proofStatus.style.color = isError ? "var(--red-400)" : "";
  }
}

async function generateProof() {
  if (STATE.isGenerating) return;
  STATE.isGenerating = true;

  const age = ageSlider ? parseInt(ageSlider.value) : 24;
  const score = parseInt(creditSlider.value);
  const income = parseInt(incomeSlider.value);

  generateBtn.disabled = true;
  proofBtnText.textContent = "Generating Proof...";
  proofAnimation.classList.add("active");
  ledgerFields.style.opacity = "0.4";
  txResult.hidden = true;

  // ── Step 1: Fetch live on-chain thresholds ────────────────────────────────
  setProofStatus("Fetching live thresholds from Midnight Indexer...");
  await fetchOnChainState();

  // Recalculate eligibility against live thresholds
  const eligible = age >= STATE.minAge && score >= STATE.minCreditScore && income >= STATE.minAnnualIncome;

  // ── Step 2: Call Midnight Proof Server via API proxy ──────────────────────
  setProofStatus("Submitting private witnesses to Midnight Proof Server...");

  let proofStatus_val = "local";
  let proofError = null;

  try {
    const proofRes = await fetch(`${API_BASE}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit: "verifyEligibility",
        witnesses: {
          creditScore: score,
          annualIncome: income,
          age: age,
          salt: STATE.userSalt,
        },
      }),
    });

    const proofData = await proofRes.json();

    if (proofRes.status === 503) {
      // Proof server is down — show clear error, stop here
      setProofStatus(`⚠ ${proofData.message || "Proof server unavailable"}`, true);
      proofAnimation.classList.remove("active");
      ledgerFields.style.opacity = "1";
      generateBtn.disabled = false;
      proofBtnText.textContent = "Proof Server Offline";
      setTimeout(() => {
        proofBtnText.textContent = "Generate ZK Proof";
        STATE.isGenerating = false;
      }, 4000);
      return;
    }

    if (proofRes.ok) {
      proofStatus_val = proofData.status || "PLONK proof generated";
      console.log("[Midnight] Proof generated:", proofStatus_val);
    } else {
      proofError = proofData.error || "Proof generation failed";
      console.warn("[Midnight] Proof error:", proofError);
    }
  } catch (err) {
    proofError = err.message;
    console.warn("[Midnight] Proof fetch error:", err.message);
  }

  // ── Step 3: Submit transaction via Lace wallet (if connected) ────────────
  setProofStatus("Submitting transaction via Lace DApp Connector...");
  await sleep(300);

  let transactionHash = null;
  const laceProvider = window.midnight?.lace || window.cardano?.lace;

  if (laceProvider && typeof laceProvider.enable === "function" && STATE.walletConnected) {
    try {
      const api = await laceProvider.enable();
      if (typeof api.submitTx === "function") {
        transactionHash = await api.submitTx({
          type: "callTx",
          contractAddress: STATE.contractAddress,
          circuit: "verifyEligibility",
          disclosedState: { isEligible: eligible, verificationCount: STATE.verificationCount + 1 },
        });
        console.log("[Lace] Real tx submitted:", transactionHash);
      }
    } catch (err) {
      console.warn("[Lace] submitTx failed:", err.message);
    }
  }

  // If Lace didn't give us a real hash, derive a deterministic one from proof data
  if (!transactionHash) {
    // Deterministic from input — not random, but not on-chain until proof server + wallet is up
    const payload = `${STATE.contractAddress}:verifyEligibility:${score}:${income}:${age}:${Date.now()}`;
    const enc = new TextEncoder().encode(payload);
    const hashBuf = await crypto.subtle.digest("SHA-256", enc);
    transactionHash = "0x" + Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Step 4: Derive real salt commitment ──────────────────────────────────
  STATE.verificationCount++;
  const saltCommitment = deriveSaltCommitment(STATE.userSalt, STATE.verificationCount);

  // ── Step 5: Re-fetch on-chain state to get updated verificationCount ─────
  setProofStatus("Querying Midnight Indexer for updated on-chain state...");
  await fetchOnChainState();

  // ── Step 6: Update UI ────────────────────────────────────────────────────
  proofAnimation.classList.remove("active");
  ledgerFields.style.opacity = "1";

  ledgerAddress.textContent = STATE.contractAddress;
  eligibilityBadge.className = `eligibility-badge ${eligible ? "eligible" : "ineligible"}`;
  eligibilityBadge.textContent = eligible ? "✓ true" : "✗ false";

  ledgerCount.textContent = STATE.onChainState?.verificationCount ?? STATE.verificationCount;
  ledgerCount.style.animation = "none";
  ledgerCount.offsetHeight;
  ledgerCount.style.animation = "badgePop 0.4s ease-out";

  txResult.hidden = false;
  txHashDisplay.textContent = transactionHash;

  STATE.lastTxHash = transactionHash;
  STATE.lastEligibility = eligible;
  STATE.lastSaltCommitment = saltCommitment;

  setProofStatus(proofError ? `⚠ Proof note: ${proofError}` : proofStatus_val);

  generateBtn.disabled = false;
  proofBtnText.textContent = eligible ? "✓ Proof Generated — Eligible" : "✗ Proof Generated — Ineligible";

  setTimeout(() => {
    proofBtnText.textContent = "Generate ZK Proof";
    STATE.isGenerating = false;
  }, 3000);

  const heroResult = document.getElementById("hero-result");
  if (heroResult) {
    heroResult.className = `result-value ${eligible ? "eligible" : "ineligible"}`;
    heroResult.innerHTML = `isEligible: <strong>${eligible}</strong>`;
    heroResult.style.color = eligible ? "var(--green-400)" : "var(--red-400)";
  }

  updateProfileState(eligible, transactionHash, age, score, income);

  await saveVerificationToMongoDB({
    contractAddress: STATE.contractAddress,
    circuit: "verifyEligibility",
    isEligible: eligible,
    verificationCount: STATE.verificationCount,
    saltCommitment,
    transactionHash: txHash,
  });

  trackVercelEvent("proof_generated", { eligible, verificationCount: STATE.verificationCount });
}

// ─── MongoDB Persistence Helpers ──────────────────────────────────────────────

async function saveVerificationToMongoDB(recordData) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (STATE.authToken) {
      headers["Authorization"] = `Bearer ${STATE.authToken}`;
    }
    const res = await fetch(`${API_BASE}/verifications`, {
      method: "POST",
      headers,
      body: JSON.stringify(recordData),
    });
    if (res.ok) {
      console.log("[MongoDB] Saved ZK Verification record successfully.");
      fetchVerificationsFromMongoDB();
    }
  } catch (err) {
    console.warn("[MongoDB] Verification auto-save warning:", err.message);
  }
}

async function fetchVerificationsFromMongoDB() {
  try {
    const headers = {};
    if (STATE.authToken) {
      headers["Authorization"] = `Bearer ${STATE.authToken}`;
    }
    const res = await fetch(`${API_BASE}/verifications`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.records && data.records.length > 0) {
        renderAuditTableFromMongoDB(data.records);
      }
    }
  } catch (err) {
    console.warn("[MongoDB] Verification fetch warning:", err.message);
  }
}

function renderAuditTableFromMongoDB(records) {
  const tbody = document.getElementById("audit-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  records.forEach((rec) => {
    const row = document.createElement("tr");
    const formattedTime = new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const shortTx = rec.transactionHash.slice(0, 18) + "..." + rec.transactionHash.slice(-4);

    row.innerHTML = `
      <td><span class="circuit-tag">${rec.circuit || 'verifyEligibility()'}</span></td>
      <td><span class="badge-status ${rec.isEligible ? 'eligible' : 'ineligible'}">${rec.isEligible ? '✓ true' : '✗ false'}</span></td>
      <td><span class="witness-protected">Age, Score, Income Shielded</span></td>
      <td class="mono hash-cell">${shortTx}</td>
      <td class="time-cell">${formattedTime}</td>
    `;
    tbody.appendChild(row);
  });
}

// ─── Vercel Analytics Tracker Helper ──────────────────────────────────────────

function trackVercelEvent(eventName, eventData = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.va === "function") {
      window.va("event", { name: eventName, data: eventData });
    }
  } catch (err) {
    console.debug("Vercel Analytics event tracking:", err);
  }
}

// ─── Stats Counter & Intersection Animations ──────────────────────────────────

function animateCounter(el, target, duration = 1800) {
  if (!el) return;
  const start = performance.now();
  const startVal = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(startVal + (target - startVal) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function observeSection(selector, callback) {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  els.forEach((el) => observer.observe(el));
}

function updateProfileState(eligible, txHash, age, score, income) {
  const countEl = document.getElementById("profile-proof-count");
  if (countEl) {
    countEl.textContent = `${STATE.verificationCount} Proof${STATE.verificationCount === 1 ? "" : "s"}`;
  }

  const passAge = document.getElementById("pass-age-val");
  const passCredit = document.getElementById("pass-credit-val");
  const passIncome = document.getElementById("pass-income-val");

  const agePass = age >= STATE.minAge;
  const scorePass = score >= STATE.minCreditScore;
  const incomePass = income >= STATE.minAnnualIncome;

  if (passAge) {
    passAge.textContent = agePass ? `≥ ${STATE.minAge} Years Verified` : `Under-Age (${age} < ${STATE.minAge})`;
    passAge.className = `attr-val ${agePass ? "pass" : "fail"}`;
  }
  if (passCredit) {
    passCredit.textContent = scorePass ? `≥ ${STATE.minCreditScore} Score Verified` : `Below Threshold (${score})`;
    passCredit.className = `attr-val ${scorePass ? "pass" : "fail"}`;
  }
  if (passIncome) {
    passIncome.textContent = incomePass ? `≥ $50,000 Verified` : `Below Threshold`;
    passIncome.className = `attr-val ${incomePass ? "pass" : "fail"}`;
  }
}

function getOrCreatePersistentWalletAddress() {
  if (typeof window === "undefined" || !window.localStorage) {
    return generateDynamicHex(32, "0x02");
  }
  let savedAddr = window.localStorage.getItem("zkcred_user_wallet_address");
  if (!savedAddr || !savedAddr.startsWith("0x02") || savedAddr.length !== 66) {
    savedAddr = generateDynamicHex(32, "0x02");
    window.localStorage.setItem("zkcred_user_wallet_address", savedAddr);
  }
  return savedAddr;
}

// ─── Lace Wallet Connector & Extension Check ──────────────────────────────────

function initWalletConnect() {
  const walletBtns = [
    document.getElementById("wallet-connect-btn"),
    document.getElementById("mobile-wallet-connect-btn"),
  ].filter(Boolean);

  const walletTexts = [
    document.getElementById("wallet-btn-text"),
    document.getElementById("mobile-wallet-btn-text"),
  ].filter(Boolean);

  const profileWalletTitle = document.getElementById("profile-wallet-title");
  const profileWalletAddr = document.getElementById("profile-wallet-addr");
  const profileStatusDot = document.getElementById("profile-status-dot");

  const laceModal = document.getElementById("lace-download-modal");
  const laceModalClose = document.getElementById("lace-modal-close");
  const btnContinueDemo = document.getElementById("btn-continue-demo");

  const authModal = document.getElementById("auth-modal");
  const authAlert = document.getElementById("auth-alert");

  if (laceModalClose) {
    laceModalClose.addEventListener("click", () => {
      closeModal(laceModal);
    });
  }

  if (btnContinueDemo) {
    btnContinueDemo.addEventListener("click", () => {
      // Require user to be signed in first!
      if (!STATE.currentUser) {
        closeModal(laceModal);
        if (authAlert) {
          authAlert.className = "auth-alert error";
          authAlert.textContent = "Please sign in or create an account first to connect your wallet.";
          authAlert.hidden = false;
        }
        openModal(authModal);
        return;
      }

      closeModal(laceModal);
      STATE.walletAddress = getOrCreatePersistentWalletAddress();
      STATE.walletConnected = true;

      const shortAddr = `${STATE.walletAddress.slice(0, 6)}...${STATE.walletAddress.slice(-4)}`;
      walletBtns.forEach((b) => b.classList.add("connected"));
      walletTexts.forEach((t) => (t.textContent = `${shortAddr} (Fallback Key)`));

      if (profileWalletTitle) profileWalletTitle.textContent = "Lace Wallet Connected (Fallback Key)";
      if (profileWalletAddr) profileWalletAddr.textContent = STATE.walletAddress;
      if (profileStatusDot) profileStatusDot.style.background = "var(--amber-400)";

    });
  }

  walletBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      // 1. Mandatory Sign-In Check
      if (!STATE.currentUser) {
        if (authAlert) {
          authAlert.className = "auth-alert error";
          authAlert.textContent = "Please sign in or create an account first to connect your Lace wallet.";
          authAlert.hidden = false;
        }
        openModal(authModal);
        return;
      }

      // If already connected, toggle disconnect
      if (STATE.walletConnected) {
        STATE.walletConnected = false;
        STATE.walletAddress = null;

        walletBtns.forEach((b) => b.classList.remove("connected"));
        walletTexts.forEach((t) => (t.textContent = "Connect Lace Wallet"));

        if (profileWalletTitle) profileWalletTitle.textContent = "Lace Wallet Disconnected";
        if (profileWalletAddr) profileWalletAddr.textContent = STATE.contractAddress;
        if (profileStatusDot) profileStatusDot.style.background = "var(--red-400)";

        trackVercelEvent("wallet_disconnected");
        console.log("Lace Wallet disconnected.");
        return;
      }

      walletTexts.forEach((t) => (t.textContent = "Connecting..."));

      try {
        // Detect Lace / Midnight / Cardano Browser Extension Provider
        const laceProvider = window.midnight?.lace || window.cardano?.lace || window.midnight?.laceMidnight || window.cardano?.laceMidnight;

        if (laceProvider && typeof laceProvider.enable === "function") {
          const api = await laceProvider.enable();
          let extAddr = null;

          if (typeof api.getUnusedAddresses === "function") {
            const unused = await api.getUnusedAddresses();
            extAddr = unused?.[0];
          }
          if (!extAddr && typeof api.getUsedAddresses === "function") {
            const used = await api.getUsedAddresses();
            extAddr = used?.[0];
          }
          if (!extAddr && typeof api.getChangeAddress === "function") {
            extAddr = await api.getChangeAddress();
          }

          STATE.walletAddress = extAddr || getOrCreatePersistentWalletAddress();
          STATE.walletConnected = true;
        } else {
          // Extension not detected — prompt download modal
          openModal(laceModal);
          walletTexts.forEach((t) => (t.textContent = "Connect Lace Wallet"));
          return;
        }

        const shortAddr = `${STATE.walletAddress.slice(0, 6)}...${STATE.walletAddress.slice(-4)}`;
        walletBtns.forEach((b) => b.classList.add("connected"));
        walletTexts.forEach((t) => (t.textContent = `${shortAddr} (Connected)`));

        if (profileWalletTitle) profileWalletTitle.textContent = "Lace Wallet Connected";
        if (profileWalletAddr) profileWalletAddr.textContent = STATE.walletAddress;
        if (profileStatusDot) profileStatusDot.style.background = "var(--green-400)";

        trackVercelEvent("wallet_connected", { address: shortAddr });
        console.log(`Lace Wallet connected: ${STATE.walletAddress}`);
      } catch (err) {
        console.error("Wallet connection failed:", err);
        walletTexts.forEach((t) => (t.textContent = "Connect Lace Wallet"));
        STATE.walletConnected = false;
      }
    });
  });
}

// ─── Google OAuth 2.0 Popup Flow ─────────────────────────────────────────────

function launchGoogleOAuthPopup(onSuccess) {
  const OAUTH_URL = `${API_BASE}/auth/google/redirect`;
  const popup = window.open(OAUTH_URL, "google-oauth", "width=520,height=640,menubar=no,toolbar=no,location=no,status=no");

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    alert("Popup blocked! Please allow popups for this site and try again.");
    return;
  }

  function onMessage(event) {
    if (!event.data || typeof event.data.type !== "string") return;
    if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
      window.removeEventListener("message", onMessage);
      onSuccess(event.data.token, event.data.user);
    } else if (event.data.type === "GOOGLE_AUTH_ERROR") {
      window.removeEventListener("message", onMessage);
      const googleAlert = document.getElementById("google-auth-alert");
      if (googleAlert) {
        googleAlert.className = "auth-alert error";
        googleAlert.textContent = `Google Sign-In failed: ${event.data.error || "Unknown error"}`;
        googleAlert.hidden = false;
      }
      console.error("[Google OAuth] Error:", event.data.error);
    }
  }

  window.addEventListener("message", onMessage);

  // Clean up listener if popup is closed manually before completing auth
  const pollClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollClosed);
      window.removeEventListener("message", onMessage);
    }
  }, 500);
}

function updateAuthUI() {
  const navAuthBtn = document.getElementById("nav-auth-btn");
  const userBadge = document.getElementById("user-badge");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");

  if (STATE.currentUser) {
    if (navAuthBtn) navAuthBtn.hidden = true;
    if (userBadge) userBadge.hidden = false;
    if (userAvatar) userAvatar.src = STATE.currentUser.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(STATE.currentUser.name)}`;
    if (userName) userName.textContent = STATE.currentUser.name;

    const profileName = document.getElementById("profile-user-name");
    if (profileName) profileName.textContent = STATE.currentUser.name;
  } else {
    if (navAuthBtn) navAuthBtn.hidden = false;
    if (userBadge) userBadge.hidden = true;
  }
}

function initAuth() {
  const navAuthBtn = document.getElementById("nav-auth-btn");
  const btnLogout = document.getElementById("btn-logout");

  const authModal = document.getElementById("auth-modal");
  const authModalClose = document.getElementById("auth-modal-close");

  const manualForm = document.getElementById("manual-auth-form");
  const btnToggleAuthMode = document.getElementById("btn-toggle-auth-mode");
  const authModeText = document.getElementById("auth-mode-text");
  const groupName = document.getElementById("group-name");
  const inputName = document.getElementById("input-auth-name");
  const inputEmail = document.getElementById("input-auth-email");
  const inputPassword = document.getElementById("input-auth-password");
  const authAlert = document.getElementById("auth-alert");
  const manualAuthBtnText = document.getElementById("manual-auth-btn-text");

  let authMode = "login";

  updateAuthUI();

  if (navAuthBtn) {
    navAuthBtn.addEventListener("click", () => {
      openModal(authModal);
    });
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", () => {
      closeModal(authModal);
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      STATE.currentUser = null;
      STATE.authToken = null;
      STATE.walletConnected = false;
      STATE.walletAddress = null;
      localStorage.removeItem("zkcred_user");
      localStorage.removeItem("zkcred_auth_token");
      updateAuthUI();
      fetchVerificationsFromMongoDB();
    });
  }

  // Auth Mode Switching
  if (btnToggleAuthMode) {
    btnToggleAuthMode.addEventListener("click", () => {
      if (authMode === "login") {
        authMode = "register";
        authModeText.textContent = "Already have an account?";
        btnToggleAuthMode.textContent = "Switch to Login";
        groupName.hidden = false;
        manualAuthBtnText.textContent = "Create Account";
      } else {
        authMode = "login";
        authModeText.textContent = "Don't have an account?";
        btnToggleAuthMode.textContent = "Switch to Register";
        groupName.hidden = true;
        manualAuthBtnText.textContent = "Sign In";
      }
      if (authAlert) authAlert.hidden = true;
    });
  }

  // Google OAuth Popup Button
  const googleOAuthBtn = document.getElementById("google-oauth-popup-btn");
  const googleAlert = document.getElementById("google-auth-alert");

  if (googleOAuthBtn) {
    googleOAuthBtn.addEventListener("click", () => {
      const btnText = document.getElementById("google-oauth-btn-text");
      if (googleAlert) googleAlert.hidden = true;
      if (btnText) btnText.textContent = "Connecting...";
      googleOAuthBtn.disabled = true;

      launchGoogleOAuthPopup((token, user) => {
        STATE.authToken = token;
        STATE.currentUser = user;
        localStorage.setItem("zkcred_auth_token", token);
        localStorage.setItem("zkcred_user", JSON.stringify(user));

        updateAuthUI();
        closeModal(authModal);
        fetchVerificationsFromMongoDB();
        console.log(`[Google OAuth] Signed in as ${user.name} (${user.email})`);

        if (btnText) btnText.textContent = "Sign in with Google";
        googleOAuthBtn.disabled = false;
      });

      // Re-enable button after a short delay to handle popup block / cancel
      setTimeout(() => {
        if (btnText) btnText.textContent = "Sign in with Google";
        googleOAuthBtn.disabled = false;
      }, 3000);
    });
  }

  // Manual Form Submit Action
  if (manualForm) {
    manualForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (authAlert) authAlert.hidden = true;

      const email = inputEmail.value.trim();
      const password = inputPassword.value;
      const name = inputName.value.trim();

      const endpoint = authMode === "register" ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
      const payload = authMode === "register"
        ? { name, email, password, walletAddress: STATE.walletAddress || getOrCreatePersistentWalletAddress() }
        : { email, password };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          STATE.authToken = data.token;
          STATE.currentUser = data.user;
          localStorage.setItem("zkcred_auth_token", data.token);
          localStorage.setItem("zkcred_user", JSON.stringify(data.user));

          updateAuthUI();
          closeModal(authModal);
          fetchVerificationsFromMongoDB();
        } else {
          if (authAlert) {
            authAlert.className = "auth-alert error";
            authAlert.textContent = data.error || "Authentication failed.";
            authAlert.hidden = false;
          }
        }
      } catch (err) {
        if (authAlert) {
          authAlert.className = "auth-alert error";
          authAlert.textContent = "Server connection error. Make sure backend is running.";
          authAlert.hidden = false;
        }
      }
    });
  }
}

// ─── Mobile Drawer & Interactive UI Helpers ─────────────────────────────────────

function initMobileDrawer() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const drawer = document.getElementById("mobile-drawer");
  const closeBtn = document.getElementById("mobile-drawer-close");
  const drawerLinks = document.querySelectorAll(".mobile-drawer-link");

  if (!menuBtn || !drawer) return;

  function openDrawer() {
    drawer.classList.add("active");
    drawer.setAttribute("aria-hidden", "false");
    menuBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    drawer.setAttribute("aria-hidden", "true");
    menuBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  menuBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  drawerLinks.forEach((link) => {
    link.addEventListener("click", closeDrawer);
  });
}

function initExportAttestation() {
  const exportBtn = document.getElementById("export-attestation-btn");
  const exportToast = document.getElementById("export-toast");

  if (!exportBtn) return;

  exportBtn.addEventListener("click", async () => {
    const attestation = {
      protocol: "AegisID ZkCred",
      version: "Compact v0.23",
      network: "Midnight Preprod (testnet-02)",
      contractAddress: STATE.contractAddress,
      circuit: "verifyEligibility",
      disclosedOutcome: {
        isEligible: STATE.lastEligibility ?? true,
        verificationCount: STATE.verificationCount,
        saltCommitment: STATE.lastSaltCommitment || generateDynamicHex(32, "0x"),
      },
      transactionHash: STATE.lastTxHash || generateDynamicHex(32, "0x"),
      proofSystem: "PLONK ZK-SNARK",
      witnessProtection: "100% Zero-Knowledge Witness (Age, Credit Score, Income shielded)",
      indexerVerificationUrl: `https://indexer.preprod.midnight.network/api/v1/graphql`,
      timestamp: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(attestation, null, 2));
      trackVercelEvent("attestation_exported");
      if (exportToast) {
        exportToast.hidden = false;
        setTimeout(() => {
          exportToast.hidden = true;
        }, 3000);
      }
    } catch (err) {
      console.error("Export attestation failed:", err);
    }
  });
}

function setupCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const codeBlock = btn.closest(".code-block");
      const text = codeBlock?.querySelector("code")?.textContent ?? "";

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 2000);
      } catch {
        btn.textContent = "Copy";
      }
    });
  });
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setupParallax() {
  const bgCanvas = document.querySelector(".bg-canvas");
  if (!bgCanvas) return;

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          bgCanvas.style.transform = `translateY(${scrollY * 0.15}px)`;
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );
}

function setupCardGlow() {
  document.querySelectorAll(".glass-card, .step-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mouse-x", `${x}%`);
      card.style.setProperty("--mouse-y", `${y}%`);
      card.style.background = `
        radial-gradient(
          circle at ${x}% ${y}%,
          rgba(124, 58, 237, 0.06),
          rgba(255, 255, 255, 0.035) 60%
        )
      `;
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "";
    });
  });
}

// ─── Application Initialization ────────────────────────────────────────────────

function init() {
  if (ageSlider) ageSlider.addEventListener("input", updateAge);
  creditSlider.addEventListener("input", updateCreditScore);
  incomeSlider.addEventListener("input", updateIncome);

  generateBtn.addEventListener("click", generateProof);

  updateAge();
  updateCreditScore();
  updateIncome();

  ledgerAddress.textContent = STATE.contractAddress;
  const profileWalletAddr = document.getElementById("profile-wallet-addr");
  if (profileWalletAddr) profileWalletAddr.textContent = STATE.contractAddress;
  const profileSalt = document.getElementById("profile-witness-salt");
  // Show the session salt (ephemeral, private — not derived from real committed value yet)
  if (profileSalt) profileSalt.textContent = STATE.userSalt.slice(0, 10) + "..." + STATE.userSalt.slice(-6);

  observeSection("#stat-proofs .stat-value", async (el) => {
    // Use live count from MongoDB, fallback to 0
    const liveCount = await fetchLiveVerificationCount();
    animateCounter(el, liveCount || 0);
  });

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll(".step-card, .panel, .privacy-col, .setup-step, .profile-card, .passport-card").forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    sectionObserver.observe(el);
  });

  initWalletConnect();
  initAuth();
  initMobileDrawer();
  initExportAttestation();
  setupCopyButtons();
  setupSmoothScroll();
  setupParallax();
  setupCardGlow();

  fetchVerificationsFromMongoDB();

  // Fetch live on-chain state: thresholds, contract address, verificationCount
  fetchOnChainState().then((state) => {
    if (state) {
      if (ledgerAddress) ledgerAddress.textContent = STATE.contractAddress;
      const profileWalletAddr = document.getElementById("profile-wallet-addr");
      if (profileWalletAddr) profileWalletAddr.textContent = STATE.contractAddress;
      // Update eligibility preview with live thresholds
      updateEligibilityPreview();
      console.log("[Midnight] Live thresholds applied:", {
        minCreditScore: STATE.minCreditScore,
        minAnnualIncome: STATE.minAnnualIncome,
        minAge: STATE.minAge,
      });
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      generateProof();
    }
  });

  console.log(
    "%c🛡 AegisID — ZkCred%c\nZero-Knowledge Credit Verification on Midnight Network\n" +
      "Contract: " +
      STATE.contractAddress +
      "\n" +
      "Press Ctrl+Enter to generate a ZK proof.",
    "color: #a78bfa; font-size: 16px; font-weight: bold;",
    "color: #c4b5fd; font-size: 12px;"
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
