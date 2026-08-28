/**
 * AegisID — ZkCred Interactive Demo Logic
 * Zero-Knowledge Proof Simulator for Midnight Network
 */

// ─── State ────────────────────────────────────────────────────────────────────

const STATE = {
  minCreditScore: 700,
  minAnnualIncome: 5_000_000, // cents = $50,000
  verificationCount: 0,
  contractAddress: 'mn1qzkcred7f4a2e8b9c1d3e5f6a7b8c9d0e1f2a3',
  isGenerating: false,
};

// ─── DOM References ───────────────────────────────────────────────────────────

const creditSlider     = document.getElementById('credit-score-slider');
const incomeSlider     = document.getElementById('income-slider');
const creditDisplay    = document.getElementById('credit-score-display');
const incomeDisplay    = document.getElementById('income-display');
const checkScore       = document.getElementById('check-score');
const checkIncome      = document.getElementById('check-income');
const checkScoreVal    = document.getElementById('check-score-val');
const checkIncomeVal   = document.getElementById('check-income-val');
const generateBtn      = document.getElementById('generate-proof-btn');
const proofBtnText     = document.getElementById('proof-btn-text');
const proofAnimation   = document.getElementById('proof-animation');
const proofStatus      = document.getElementById('proof-status');
const ledgerFields     = document.getElementById('ledger-fields');
const eligibilityBadge = document.getElementById('eligibility-badge');
const ledgerCount      = document.getElementById('ledger-count');
const ledgerAddress    = document.getElementById('ledger-address');
const txResult         = document.getElementById('tx-result');
const txHashDisplay    = document.getElementById('tx-hash-display');

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatIncomeCents(cents) {
  const dollars = Math.round(cents / 100);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars);
}

function formatIncomeShort(cents) {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}k`;
  return `$${dollars}`;
}

function randomHex(len) {
  const chars = '0123456789abcdef';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

// ─── Slider Updates ───────────────────────────────────────────────────────────

function updateCreditScore() {
  const val = parseInt(creditSlider.value);
  const min = parseInt(creditSlider.min);
  const max = parseInt(creditSlider.max);
  const pct = ((val - min) / (max - min)) * 100;

  // Update thumb fill via CSS custom prop
  creditSlider.style.setProperty('--fill', `${pct}%`);
  creditSlider.setAttribute('aria-valuenow', val);
  creditSlider.setAttribute('aria-valuetext', `Credit score: ${val}`);
  creditDisplay.textContent = val;

  updateEligibilityPreview();
}

function updateIncome() {
  const val = parseInt(incomeSlider.value);
  const min = parseInt(incomeSlider.min);
  const max = parseInt(incomeSlider.max);
  const pct = ((val - min) / (max - min)) * 100;

  incomeSlider.style.setProperty('--fill', `${pct}%`);
  incomeSlider.setAttribute('aria-valuenow', val);
  incomeSlider.setAttribute('aria-valuetext', `Annual income: ${formatIncomeCents(val)}`);
  incomeDisplay.textContent = formatIncomeShort(val);

  updateEligibilityPreview();
}

function updateEligibilityPreview() {
  const score = parseInt(creditSlider.value);
  const income = parseInt(incomeSlider.value);
  const scorePass = score >= STATE.minCreditScore;
  const incomePass = income >= STATE.minAnnualIncome;

  // Score check
  checkScore.className = `check-item ${scorePass ? 'pass' : 'fail'}`;
  checkScore.querySelector('.check-icon').textContent = scorePass ? '✓' : '✗';
  checkScoreVal.textContent = `${score} ${scorePass ? '≥' : '<'} ${STATE.minCreditScore}`;

  // Income check
  checkIncome.className = `check-item ${incomePass ? 'pass' : 'fail'}`;
  checkIncome.querySelector('.check-icon').textContent = incomePass ? '✓' : '✗';
  checkIncomeVal.textContent = `${formatIncomeShort(income)} ${incomePass ? '≥' : '<'} ${formatIncomeShort(STATE.minAnnualIncome)}`;

  // Button state
  if (!STATE.isGenerating) {
    const allPass = scorePass && incomePass;
    generateBtn.style.background = allPass
      ? 'linear-gradient(135deg, #6d28d9, #7c3aed)'
      : 'linear-gradient(135deg, #7c3aed, #a21caf)';
  }
}

// ─── ZK Proof Generation Simulation ──────────────────────────────────────────

const PROOF_STEPS = [
  'Initializing ZK circuit...',
  'Loading private witness data...',
  'Evaluating credit threshold...',
  'Evaluating income threshold...',
  'Computing eligibility...',
  'Generating ZK proof via proof-server...',
  'Building transaction...',
  'Submitting to Midnight Preprod...',
  'Awaiting confirmation...',
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateProof() {
  if (STATE.isGenerating) return;
  STATE.isGenerating = true;

  const score = parseInt(creditSlider.value);
  const income = parseInt(incomeSlider.value);
  const eligible = score >= STATE.minCreditScore && income >= STATE.minAnnualIncome;

  // ── UI: Start generating state
  generateBtn.disabled = true;
  proofBtnText.textContent = 'Generating Proof...';
  proofAnimation.classList.add('active');
  ledgerFields.style.opacity = '0.4';
  txResult.hidden = true;

  // ── Animate proof steps
  for (let i = 0; i < PROOF_STEPS.length; i++) {
    proofStatus.textContent = PROOF_STEPS[i];
    await sleep(300 + Math.random() * 200);
  }

  await sleep(400);

  // ── Update public ledger state
  STATE.verificationCount++;
  const txHash = `0x${randomHex(64)}`;

  // Update UI
  proofAnimation.classList.remove('active');
  ledgerFields.style.opacity = '1';

  // Update ledger address (first proof sets it)
  ledgerAddress.textContent = STATE.contractAddress;

  // Update eligibility badge
  eligibilityBadge.className = `eligibility-badge ${eligible ? 'eligible' : 'ineligible'}`;
  eligibilityBadge.textContent = eligible ? '✓ true' : '✗ false';

  // Update count with animation
  ledgerCount.textContent = STATE.verificationCount;
  ledgerCount.style.animation = 'none';
  ledgerCount.offsetHeight; // Reflow
  ledgerCount.style.animation = 'badgePop 0.4s ease-out';

  // Show transaction hash
  txResult.hidden = false;
  txHashDisplay.textContent = txHash;

  // Reset button
  generateBtn.disabled = false;
  proofBtnText.textContent = eligible ? '✓ Proof Generated — Eligible' : '✗ Proof Generated — Ineligible';

  setTimeout(() => {
    proofBtnText.textContent = 'Generate ZK Proof';
    STATE.isGenerating = false;
  }, 3000);

  // Update hero result too
  const heroResult = document.getElementById('hero-result');
  if (heroResult) {
    heroResult.className = `result-value ${eligible ? 'eligible' : 'ineligible'}`;
    heroResult.innerHTML = `isEligible: <strong>${eligible}</strong>`;
    heroResult.style.color = eligible ? 'var(--green-400)' : 'var(--red-400)';
  }
}

// ─── Stats Counter Animation ──────────────────────────────────────────────────

function animateCounter(el, target, duration = 1800) {
  if (!el) return;
  const start = performance.now();
  const startVal = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(startVal + (target - startVal) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

// ─── Intersection Observer for animations ────────────────────────────────────

function observeSection(selector, callback) {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  els.forEach(el => observer.observe(el));
}

// ─── Copy Buttons ─────────────────────────────────────────────────────────────

function setupCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codeBlock = btn.closest('.code-block');
      const text = codeBlock?.querySelector('code')?.textContent ?? '';

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        btn.textContent = 'Copy';
      }
    });
  });
}

// ─── Smooth Scroll for Nav Links ──────────────────────────────────────────────

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ─── Parallax Star Effect ─────────────────────────────────────────────────────

function setupParallax() {
  const bgCanvas = document.querySelector('.bg-canvas');
  if (!bgCanvas) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        bgCanvas.style.transform = `translateY(${scrollY * 0.15}px)`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// ─── Mouse Glow Effect on Cards ───────────────────────────────────────────────

function setupCardGlow() {
  document.querySelectorAll('.glass-card, .step-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
      card.style.background = `
        radial-gradient(
          circle at ${x}% ${y}%,
          rgba(124, 58, 237, 0.06),
          rgba(255, 255, 255, 0.035) 60%
        )
      `;
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '';
    });
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  // Sliders
  creditSlider.addEventListener('input', updateCreditScore);
  incomeSlider.addEventListener('input', updateIncome);

  // Generate button
  generateBtn.addEventListener('click', generateProof);

  // Initial UI state
  updateCreditScore();
  updateIncome();

  // Ledger defaults
  ledgerAddress.textContent = STATE.contractAddress;

  // Stats counter animation on view
  observeSection('#stat-proofs .stat-value', el => {
    animateCounter(el, 4821);
  });

  // Fade-in sections on scroll
  const sectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.step-card, .panel, .privacy-col, .setup-step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    sectionObserver.observe(el);
  });

  // Features
  setupCopyButtons();
  setupSmoothScroll();
  setupParallax();
  setupCardGlow();

  // Keyboard shortcut: Ctrl+Enter to generate proof
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      generateProof();
    }
  });

  console.log(
    '%c🛡 AegisID — ZkCred%c\nZero-Knowledge Credit Verification on Midnight Network\n' +
    'Contract: ' + STATE.contractAddress + '\n' +
    'Press Ctrl+Enter to generate a ZK proof.',
    'color: #a78bfa; font-size: 16px; font-weight: bold;',
    'color: #c4b5fd; font-size: 12px;'
  );
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
