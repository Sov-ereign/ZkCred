/**
 * AegisID — ZkCred Interactive Demo Logic
 * Zero-knowledge credential client for Midnight Network with MongoDB Auth & Lace Wallet Integration.
 */

// ─── API Base Configuration ───────────────────────────────────────────────────
// If RENDER_BACKEND_URL env is injected at build time, use it; otherwise use same-origin /api.
// To connect to a Render backend, set window.__RENDER_API__ before this script loads.
const isLocalDev = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const API_BASE = isLocalDev ? "/api" : ((typeof window !== "undefined" && window.__RENDER_API__)
  ? window.__RENDER_API__.replace(/\/$/, "")
  : "/api");
// Public, verified Midnight Preprod contract configuration. A visitor may
// override it by deploying a newer verifier in their own browser; this is not
// a synthetic fallback and is always checked against the live indexer.
const DEPLOYED_PREPROD_CONTRACT_ADDRESS = "a95f0d061323e6c1568e39344bcbae6d559e58c4bd6df335dc5c20de81a6f2b6";

function generateDynamicHex(lenBytes = 32, prefix = "0x") {
  const bytes = new Uint8Array(lenBytes);
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < lenBytes; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return prefix + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const STATE = {
  // These fields are populated only from verified on-chain contract state.
  minCreditScore: null,
  minAnnualIncome: null,
  minAge: null,
  verificationCount: null,
  contractAddress: normalizeContractAddress(localStorage.getItem("zkcred_contract_address") || DEPLOYED_PREPROD_CONTRACT_ADDRESS),
  isGenerating: false,
  walletConnected: false,
  walletAddress: null,
  currentUser: JSON.parse(localStorage.getItem("zkcred_user") || "null"),
  authToken: localStorage.getItem("zkcred_auth_token") || null,
  onChainState: null, // populated from /api/contract/state
  userSalt: generateDynamicHex(32, "0x"), // ephemeral per-session salt
};

function currentRoute() {
  const route = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return ["home", "dashboard", "profile", "auth"].includes(route) ? route : "home";
}

function applyRoute() {
  const route = currentRoute();
  document.body.dataset.route = route === "auth" ? "home" : route;
  if (route === "auth") openModal(document.getElementById("auth-modal"));
  else closeModal(document.getElementById("auth-modal"));
  window.scrollTo(0, 0);
}

function navigate(route) {
  window.location.hash = `/${route}`;
}

function normalizeContractAddress(address) {
  if (!address) return null;
  const hex = String(address).replace(/^0x/i, "");
  return /^[0-9a-f]+$/i.test(hex) ? hex : null;
}

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
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
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
const verifyLedgerBtn = document.getElementById("verify-ledger-btn");
const verifyTxBtn = document.getElementById("verify-tx-btn");
const txVerificationStatus = document.getElementById("tx-verification-status");

const MIDNIGHT_INDEXER_GRAPHQL = "https://indexer.preprod.midnight.network/api/v3/graphql";

async function verifyTransactionOnChain(transactionId) {
  if (!transactionId) throw new Error("No finalized transaction ID is available yet.");
  const query = `query($offset:TransactionOffset!){transactions(offset:$offset){id hash block{height hash timestamp} ... on RegularTransaction { identifiers transactionResult{status} }}}`;
  const response = await fetch(MIDNIGHT_INDEXER_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { offset: { identifier: transactionId } } }),
  });
  if (!response.ok) throw new Error(`Indexer returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message || "Indexer query failed.");
  const transaction = payload.data?.transactions?.[0];
  if (!transaction) throw new Error("Transaction is not indexed yet. Try again shortly.");
  return transaction;
}

function renderTransactionVerification(transaction) {
  if (!txVerificationStatus) return;
  const status = transaction?.transactionResult?.status || "INDEXED";
  const block = transaction?.block?.height;
  txVerificationStatus.textContent = `✓ ${status}${block ? ` · block ${block}` : ""}`;
  txVerificationStatus.classList.add("verified");
}

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
    if (!STATE.contractAddress) {
      console.warn("[Midnight] No deployed contract address is configured.");
      return null;
    }
    const data = await window.ZkCredMidnight?.getLedgerState(STATE.contractAddress);
    if (!data) throw new Error("Midnight client is not ready.");
    STATE.onChainState = data;
    // Update thresholds from live contract state
    if (!Number.isSafeInteger(data.minCreditScore) || !Number.isSafeInteger(Number(data.minAnnualIncome)) || !Number.isSafeInteger(data.minAge)) {
      throw new Error("Indexer returned an invalid contract state.");
    }
    STATE.minCreditScore = data.minCreditScore;
    STATE.minAnnualIncome = Number(data.minAnnualIncome);
    STATE.minAge = data.minAge;
    if (data.verificationCount !== undefined) STATE.verificationCount = Number(data.verificationCount);
    if (data.contractAddress) {
      STATE.contractAddress = data.contractAddress;
      localStorage.setItem("zkcred_contract_address", data.contractAddress);
    }
    console.log("[Midnight] Live on-chain state loaded:", data);
    return data;
  } catch (err) {
    console.warn("[Midnight] On-chain state fetch failed:", err.message);
    return null;
  }
}

async function fetchLiveVerificationCount() {
  try {
    if (!STATE.authToken) return 0;
    const res = await fetch(`${API_BASE}/verifications/count`, {
      headers: { Authorization: `Bearer ${STATE.authToken}` },
    });
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

  // Mandatory Authentication Check
  if (!STATE.currentUser || !STATE.authToken) {
    const authAlert = document.getElementById("auth-alert");
    if (authAlert) {
      authAlert.className = "auth-alert error";
      authAlert.textContent = "Please sign in or create an account first to generate ZK proofs.";
      authAlert.hidden = false;
    }
    const authModal = document.getElementById("auth-modal");
    openModal(authModal);
    return;
  }

  if (!STATE.walletConnected) {
    setProofStatus("Connect Lace before generating a proof.", true);
    openModal(document.getElementById("lace-download-modal"));
    return;
  }

  STATE.isGenerating = true;

  const age = ageSlider ? parseInt(ageSlider.value) : 24;
  const score = parseInt(creditSlider.value);
  const income = parseInt(incomeSlider.value);

  generateBtn.disabled = true;
  proofBtnText.textContent = "Generating Proof...";
  proofAnimation.classList.add("active");
  ledgerFields.style.opacity = "0.4";
  txResult.hidden = true;

  try {
    // ── Step 1: Fetch live on-chain thresholds ──────────────────────────────
    setProofStatus("Fetching live thresholds from Midnight Indexer...");
    const onChainState = STATE.onChainState || await fetchOnChainState();
    if (!onChainState) throw new Error("Cannot create a proof until the deployed contract state has been verified.");

    // This is preview-only. The result shown after submission is re-read from
    // the finalized public contract state below.
    const previewEligible = age >= STATE.minAge && score >= STATE.minCreditScore && income >= STATE.minAnnualIncome;

    // The official Midnight.js client builds the Compact circuit transaction;
    // private witnesses are closed over in that browser module and never sent
    // to this application API.
    setProofStatus("Generating and submitting verifyEligibility through Lace...");
    const result = await window.ZkCredMidnight?.submitEligibility(STATE.contractAddress, {
      creditScore: score, annualIncome: income, age, userSalt: STATE.userSalt,
    });
    const transactionHash = result?.transactionId;
    if (!transactionHash || typeof transactionHash !== "string") throw new Error("Lace did not return a finalized transaction ID.");

    // Re-fetch on-chain state to confirm the finalized transaction's public result.
    setProofStatus("Querying Midnight Indexer for finalized public state...");
    const confirmedState = await fetchOnChainState();
    if (!confirmedState) throw new Error("Transaction submitted, but its finalized public contract state could not be verified.");
    const eligible = Boolean(confirmedState.isEligible);

    // The contract stores a domain-separated nullifier for this private salt.
    // Rotate after a confirmed call so a later proof cannot replay it.
    STATE.userSalt = generateDynamicHex(32, "0x");

    // ── Step 6: Update UI ──────────────────────────────────────────────────
    proofAnimation.classList.remove("active");
    ledgerFields.style.opacity = "1";

    ledgerAddress.textContent = STATE.contractAddress;
    eligibilityBadge.className = `eligibility-badge ${eligible ? "eligible" : "ineligible"}`;
    eligibilityBadge.textContent = eligible ? "✓ true" : "✗ false";

    ledgerCount.textContent = STATE.onChainState?.verificationCount ?? "unavailable";
    ledgerCount.style.animation = "none";
    ledgerCount.offsetHeight;
    ledgerCount.style.animation = "badgePop 0.4s ease-out";

    txResult.hidden = false;
    txHashDisplay.textContent = transactionHash;

    STATE.lastTxHash = transactionHash;
    STATE.lastEligibility = eligible;

    // Verify the submitted transaction directly against the public Preprod
    // indexer. This is a real POST query; the indexer endpoint is not a web
    // page and must not be presented as a broken outbound explorer link.
    try {
      const indexedTransaction = await verifyTransactionOnChain(transactionHash);
      renderTransactionVerification(indexedTransaction);
    } catch (verificationError) {
      if (txVerificationStatus) txVerificationStatus.textContent = verificationError.message;
      console.warn("[Midnight] Transaction verification pending:", verificationError.message);
    }

    setProofStatus(`✓ Lace submitted a finalized transaction (preview: ${previewEligible}).`);

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
      verificationCount: Number(confirmedState.verificationCount),
      transactionHash,
    });

    trackVercelEvent("proof_generated", { eligible, verificationCount: Number(confirmedState.verificationCount) });
  } catch (err) {
    console.error("Proof generation failed:", err);
    setProofStatus(err instanceof Error ? err.message : "Proof generation failed.", true);
    proofAnimation.classList.remove("active");
    ledgerFields.style.opacity = "1";
    generateBtn.disabled = false;
    proofBtnText.textContent = "Generate ZK Proof";
    STATE.isGenerating = false;
  }
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
      fetchProfileFromMongoDB();
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
      renderAuditTableFromMongoDB(data.records || []);
    }
  } catch (err) {
    console.warn("[MongoDB] Verification fetch warning:", err.message);
  }
}

function renderAuditTableFromMongoDB(records) {
  const tbody = document.getElementById("audit-table-body");
  const modalTbody = document.getElementById("modal-activity-body");
  if (tbody) tbody.innerHTML = "";
  if (modalTbody) modalTbody.innerHTML = "";

  if (!records.length) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:1.5rem;">No proof verifications recorded yet.</td></tr>';
    if (modalTbody) modalTbody.innerHTML = '<tr><td colspan="3" class="profile-activity-empty">No proofs generated yet.</td></tr>';
    return;
  }

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
    if (tbody) tbody.appendChild(row);
    if (modalTbody) {
      const modalRow = document.createElement("tr");
      modalRow.innerHTML = `<td>${rec.circuit || "verifyEligibility"}</td><td><span class="badge-status ${rec.isEligible ? "eligible" : "ineligible"}">${rec.isEligible ? "✓ Passed" : "✗ Failed"}</span></td><td class="time-cell">${formattedTime}</td>`;
      modalTbody.appendChild(modalRow);
    }
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

// ─── Lace Wallet Connector & Extension Check ──────────────────────────────────

function initWalletConnect() {
  const walletBtns = [
    document.getElementById("wallet-connect-btn"),
    document.getElementById("mobile-wallet-connect-btn"),
    document.getElementById("modal-connect-wallet-btn"),
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
  const btnRetryLace = document.getElementById("btn-retry-lace");

  const authModal = document.getElementById("auth-modal");
  const authAlert = document.getElementById("auth-alert");

  if (laceModalClose) {
    laceModalClose.addEventListener("click", () => {
      closeModal(laceModal);
    });
  }

  if (btnRetryLace) {
    btnRetryLace.addEventListener("click", () => {
      closeModal(laceModal);
      document.getElementById("wallet-connect-btn")?.click();
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

      walletTexts.forEach((t) => (t.textContent = "Connecting Lace..."));

      try {
        // `ZkCredMidnight` polls the standard `window.midnight` connector map
        // and calls InitialAPI.connect("preprod"); legacy provider fallbacks
        // are intentionally not accepted.
        const connection = await window.ZkCredMidnight?.connect("preprod");
        if (!connection?.address) throw new Error("Midnight Lace did not provide a shielded address.");
        STATE.walletAddress = connection.address;
        STATE.walletConnected = true;

        if (STATE.authToken) {
          try {
            const profileRes = await fetch(`${API_BASE}/auth/profile`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${STATE.authToken}` },
              body: JSON.stringify({ walletAddress: connection.address }),
            });
            if (!profileRes.ok) throw new Error(`Profile API returned ${profileRes.status}`);
            const { user } = await profileRes.json();
            STATE.currentUser = user;
            localStorage.setItem("zkcred_user", JSON.stringify(user));
            renderProfile(user);
          } catch (profileError) {
            // Wallet authorization is independent of optional profile sync.
            // Keep the real Lace connection usable when a hosted API has a
            // temporary outage or rejects localhost CORS preflight.
            console.warn("[MongoDB] Wallet connected; profile sync deferred:", profileError?.message || profileError);
          }
        }

        const shortAddr = `${STATE.walletAddress.slice(0, 6)}...${STATE.walletAddress.slice(-4)}`;
        walletBtns.forEach((b) => b.classList.add("connected"));
        walletTexts.forEach((t) => (t.textContent = `${shortAddr} (Connected)`));

        if (profileWalletTitle) profileWalletTitle.textContent = "Lace Wallet Connected";
        if (profileWalletAddr) profileWalletAddr.textContent = STATE.walletAddress;
        if (profileStatusDot) profileStatusDot.style.background = "var(--green-400)";

        trackVercelEvent("wallet_connected", { address: shortAddr });
        await fetchOnChainState();
        if (STATE.onChainState) {
          updateEligibilityPreview();
          renderAdminControls();
        }
        console.log(`Lace Wallet connected: ${STATE.walletAddress}`);
      } catch (err) {
        console.error("Wallet connection failed:", err.message);
        walletTexts.forEach((t) => (t.textContent = "Connect Lace Wallet"));
        STATE.walletConnected = false;
        openModal(laceModal);
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
    try {
      if (popup.closed) {
        clearInterval(pollClosed);
        window.removeEventListener("message", onMessage);
      }
    } catch {
      // Ignore COOP access warnings during cross-origin OAuth navigation
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

function setCredentialBadge(id, statusId, verified) {
  const badge = document.getElementById(id);
  const status = document.getElementById(statusId);
  if (badge) badge.classList.toggle("locked", !verified);
  if (status) status.textContent = verified ? "Verified" : "Locked";
}

function renderProfile(user = STATE.currentUser) {
  if (!user) return;
  const fallbackAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(user.name || user.email)}`;
  const credentials = user.verifiedCredentials || {};
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "Unknown";
  const wallet = user.walletAddress || "Not connected";

  const fields = {
    "modal-profile-name": user.name || "AegisID member",
    "modal-profile-email": user.email || "",
    "modal-profile-auth-type": user.googleId ? "Google OAuth" : "Manual Account",
    "modal-profile-created": `Member since ${memberSince}`,
    "modal-profile-wallet": wallet,
    "modal-proof-count": String(user.proofCount || 0),
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
  const avatar = document.getElementById("modal-profile-avatar");
  if (avatar) avatar.src = user.avatarUrl || fallbackAvatar;
  const mainCount = document.getElementById("profile-proof-count");
  if (mainCount) mainCount.textContent = `${user.proofCount || 0} Proof${user.proofCount === 1 ? "" : "s"}`;
  const firstName = document.getElementById("profile-first-name");
  const lastName = document.getElementById("profile-last-name");
  const displayName = document.getElementById("profile-display-name");
  const locale = document.getElementById("profile-locale");
  const emailValue = document.getElementById("profile-email-value");
  const emailVerified = document.getElementById("profile-email-verified");
  const providerChip = document.getElementById("profile-provider-chip");
  if (firstName) firstName.value = user.firstName || "";
  if (lastName) lastName.value = user.lastName || "";
  if (displayName) displayName.value = user.displayName || user.name || "";
  if (locale) locale.value = user.locale || "";
  if (emailValue) emailValue.textContent = user.email || "—";
  if (emailVerified) emailVerified.textContent = user.emailVerified ? "Verified by Google" : "Password account";
  if (providerChip) providerChip.textContent = user.authProvider === "google" || user.googleId ? "Google account" : "Manual account";
  setCredentialBadge("badge-credit", "status-credit", Boolean(credentials.creditScoreVerified));
  setCredentialBadge("badge-income", "status-income", Boolean(credentials.incomeVerified));
  setCredentialBadge("badge-age", "status-age", Boolean(credentials.ageVerified));
}

function renderAdminControls() {
  const panel = document.getElementById("admin-controls");
  const hasAdminKey = Boolean(STATE.contractAddress && window.ZkCredMidnight?.hasAdminKey?.(STATE.contractAddress));
  if (panel) panel.hidden = !hasAdminKey;
  if (!hasAdminKey) return;
  const score = document.getElementById("admin-min-score");
  const income = document.getElementById("admin-min-income");
  const age = document.getElementById("admin-min-age");
  if (score) score.value = String(STATE.minCreditScore ?? 700);
  if (income) income.value = String(STATE.minAnnualIncome ?? 5000000);
  if (age) age.value = String(STATE.minAge ?? 21);
}

async function fetchProfileFromMongoDB() {
  if (!STATE.authToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${STATE.authToken}` },
    });
    if (res.status === 401) throw new Error("Your sign-in session has expired.");
    if (!res.ok) throw new Error("Unable to load your profile.");
    const { user } = await res.json();
    STATE.currentUser = user;
    localStorage.setItem("zkcred_user", JSON.stringify(user));
    renderProfile(user);
    updateAuthUI();
    return user;
  } catch (err) {
    console.warn("[MongoDB] Profile fetch warning:", err.message);
    return null;
  }
}

function openProfile() {
  if (!STATE.currentUser || !STATE.authToken) {
    const authAlert = document.getElementById("auth-alert");
    if (authAlert) {
      authAlert.className = "auth-alert error";
      authAlert.textContent = "Please sign in to view your profile.";
      authAlert.hidden = false;
    }
    openModal(document.getElementById("auth-modal"));
    return;
  }
  renderProfile();
  fetchProfileFromMongoDB();
  openModal(document.getElementById("user-profile-modal"));
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
  renderProfile();

  if (navAuthBtn) {
    navAuthBtn.addEventListener("click", () => {
      navigate("auth");
    });
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", () => {
      closeModal(authModal);
      if (currentRoute() === "auth") navigate("home");
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", (event) => {
      event.stopPropagation();
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
        fetchProfileFromMongoDB();
        closeModal(authModal);
        navigate("dashboard");
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
      const payload = authMode === "register" ? { name, email, password } : { email, password };

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
          fetchProfileFromMongoDB();
          closeModal(authModal);
          navigate("dashboard");
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

  document.getElementById("user-badge")?.addEventListener("click", openProfile);
  document.getElementById("nav-profile-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    openProfile();
  });
  document.getElementById("profile-modal-close")?.addEventListener("click", () => closeModal(document.getElementById("user-profile-modal")));
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
      },
      transactionHash: STATE.lastTxHash || "Not available until a real transaction is submitted",
      proofSystem: "PLONK ZK-SNARK",
      witnessProtection: "100% Zero-Knowledge Witness (Age, Credit Score, Income shielded)",
      indexerVerificationUrl: MIDNIGHT_INDEXER_GRAPHQL,
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
      const href = link.getAttribute("href");
      if (href?.startsWith("#/")) return;
      const target = document.querySelector(href);
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

function initRouting() {
  window.addEventListener("hashchange", applyRoute);
  applyRoute();
  document.getElementById("nav-profile-link")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!STATE.authToken) return navigate("auth");
    navigate("profile");
    fetchProfileFromMongoDB();
  });
}

function initProfileEditor() {
  const form = document.getElementById("profile-editor-form");
  const status = document.getElementById("profile-editor-status");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!STATE.authToken) {
      navigate("auth");
      return;
    }
    const payload = {
      firstName: document.getElementById("profile-first-name")?.value || "",
      lastName: document.getElementById("profile-last-name")?.value || "",
      displayName: document.getElementById("profile-display-name")?.value || "",
      locale: document.getElementById("profile-locale")?.value || "",
    };
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${STATE.authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save profile.");
      STATE.currentUser = data.user;
      localStorage.setItem("zkcred_user", JSON.stringify(data.user));
      renderProfile(data.user);
      updateAuthUI();
      if (status) { status.hidden = false; status.className = "auth-alert success"; status.textContent = "Profile saved."; }
    } catch (error) {
      if (status) { status.hidden = false; status.className = "auth-alert error"; status.textContent = error.message || "Unable to save profile."; }
    }
  });
}

function initThresholdControls() {
  const form = document.getElementById("threshold-update-form");
  const status = document.getElementById("threshold-update-status");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!STATE.walletConnected) {
      setProofStatus("Connect the administrator Lace wallet before updating thresholds.", true);
      return;
    }
    const thresholds = {
      minCreditScore: Number(document.getElementById("admin-min-score")?.value),
      minAnnualIncome: Number(document.getElementById("admin-min-income")?.value),
      minAge: Number(document.getElementById("admin-min-age")?.value),
    };
    try {
      if (status) { status.hidden = false; status.className = "auth-alert"; status.textContent = "Submitting administrator-authorized transaction through Lace…"; }
      const result = await window.ZkCredMidnight?.updateThresholds(STATE.contractAddress, thresholds);
      if (!result?.transactionId) throw new Error("Lace did not return a threshold-update transaction ID.");
      const liveState = await fetchOnChainState();
      if (!liveState) throw new Error("Threshold transaction was sent but live contract state could not be read.");
      renderAdminControls();
      updateEligibilityPreview();
      if (status) { status.className = "auth-alert success"; status.textContent = `Threshold update finalized: ${result.transactionId}`; }
    } catch (error) {
      if (status) { status.className = "auth-alert error"; status.textContent = error.message || "Unable to update thresholds."; }
    }
  });
}

// ─── Application Initialization ────────────────────────────────────────────────

function init() {
  if (ageSlider) ageSlider.addEventListener("input", updateAge);
  creditSlider.addEventListener("input", updateCreditScore);
  incomeSlider.addEventListener("input", updateIncome);

  generateBtn.addEventListener("click", generateProof);

  verifyLedgerBtn?.addEventListener("click", async () => {
    if (!STATE.walletConnected) {
      setProofStatus("Connect Lace before verifying live state.", true);
      return;
    }
    verifyLedgerBtn.disabled = true;
    verifyLedgerBtn.textContent = "Checking…";
    try {
      const state = await fetchOnChainState();
      if (!state) throw new Error("The contract state is not available yet.");
      verifyLedgerBtn.textContent = "✓ State Verified";
    } catch (error) {
      verifyLedgerBtn.textContent = "Retry Verification";
      setProofStatus(error.message || "Indexer verification failed.", true);
    } finally {
      verifyLedgerBtn.disabled = false;
    }
  });

  verifyTxBtn?.addEventListener("click", async () => {
    if (!STATE.lastTxHash) {
      if (txVerificationStatus) txVerificationStatus.textContent = "Generate a proof first.";
      return;
    }
    verifyTxBtn.disabled = true;
    verifyTxBtn.textContent = "Checking…";
    try {
      renderTransactionVerification(await verifyTransactionOnChain(STATE.lastTxHash));
    } catch (error) {
      if (txVerificationStatus) txVerificationStatus.textContent = error.message;
    } finally {
      verifyTxBtn.disabled = false;
      verifyTxBtn.textContent = "Verify transaction on Preprod";
    }
  });

  updateAge();
  updateCreditScore();
  updateIncome();

  ledgerAddress.textContent = STATE.contractAddress || "Not configured";
  const profileWalletAddr = document.getElementById("profile-wallet-addr");
  if (profileWalletAddr) profileWalletAddr.textContent = STATE.contractAddress || "Not configured";
  const profileSalt = document.getElementById("profile-witness-salt");
  // The raw salt is private. The circuit records only a domain-separated
  // nullifier, so this value is never published to the ledger.
  if (profileSalt) profileSalt.textContent = STATE.userSalt.slice(0, 10) + "..." + STATE.userSalt.slice(-6);

  observeSection("#stat-proofs .stat-value", async (el) => {
    // Use the authenticated user's live count from MongoDB.
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
  initRouting();
  initProfileEditor();
  initThresholdControls();
  initMobileDrawer();
  initExportAttestation();
  setupCopyButtons();
  setupSmoothScroll();
  setupParallax();
  setupCardGlow();

  fetchVerificationsFromMongoDB();
  fetchProfileFromMongoDB();

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
      renderAdminControls();
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
