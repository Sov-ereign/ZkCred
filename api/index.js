/**
 * ZkCred (AegisID) — Vercel Serverless API
 * Exports the Express app as a Vercel serverless function.
 * Routes: /api/auth/register, /api/auth/login, /api/auth/google/redirect,
 *         /api/auth/google/callback, /api/auth/me, /api/verifications
 */

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

// ─── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "";
const MONGODB_URI = process.env.MONGODB_URI || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// Midnight Network config
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const MIDNIGHT_INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL || "https://indexer.preprod.midnight.network/api/v3/graphql";
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL || "http://localhost:6300";

// ─── MongoDB Connection (module-level, reused across warm invocations) ─────────

let isMongoConnected = false;
let mongoConnectPromise = null;

function ensureMongoConnected() {
  if (isMongoConnected) return Promise.resolve();
  if (!MONGODB_URI) return Promise.reject(new Error("MONGODB_URI is not configured"));
  if (mongoConnectPromise) return mongoConnectPromise;

  mongoConnectPromise = mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      isMongoConnected = true;
      console.log("[MongoDB] Connected:", MONGODB_URI);
    })
    .catch((err) => {
      isMongoConnected = false;
      mongoConnectPromise = null;
      throw err;
    });

  return mongoConnectPromise;
}

// ─── Mongoose Schemas ─────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  googleId: { type: String },
  walletAddress: { type: String, default: null },
  proofCount: { type: Number, default: 0 },
  verifiedCredentials: {
    creditScoreVerified: { type: Boolean, default: false },
    incomeVerified: { type: Boolean, default: false },
    ageVerified: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
});

const verificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String },
  contractAddress: { type: String, required: true },
  circuit: { type: String, default: "verifyEligibility" },
  isEligible: { type: Boolean, required: true },
  verificationCount: { type: Number, required: true },
  transactionHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Avoid model re-registration on warm Vercel invocations
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Verification = mongoose.models.Verification || mongoose.model("Verification", verificationSchema);

async function requireMongo(req, res, next) {
  try {
    await ensureMongoConnected();
    if (!isMongoConnected) throw new Error("MongoDB connection unavailable");
    next();
  } catch {
    return res.status(503).json({ error: "Database unavailable. MongoDB is required." });
  }
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

const ALLOWED_ORIGINS = [
  "https://zk-cred.vercel.app",
  "https://zk-cred-git-main-sov-ereign.vercel.app",
  /\.vercel\.app$/,
  /\.onrender\.com$/,
  "http://localhost:3000",
  "http://localhost:5000",
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    cb(allowed ? null : new Error("CORS not allowed"), allowed);
  },
  credentials: true,
}));
app.use(express.json());

app.use((req, res, next) => {
  if ((req.path.startsWith("/api/auth") || req.path.startsWith("/api/verifications")) && !JWT_SECRET) {
    return res.status(503).json({ error: "Authentication is not configured. Set JWT_SECRET." });
  }
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing or invalid token. Please sign in." });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized: token verification failed. Please sign in again." });
  }
}

// Resolve the OAuth redirect URI dynamically from the incoming request host
// so it works identically on localhost (vercel dev) and on Vercel production.
function getRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/auth/register */
app.post("/api/auth/register", requireMongo, async (req, res) => {
  await ensureMongoConnected();
  try {
    const { name, email, password, walletAddress } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email, and password are required" });

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      if (await User.findOne({ email: normalizedEmail }))
        return res.status(400).json({ error: "User with this email already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        name, email: normalizedEmail, passwordHash,
        walletAddress: walletAddress || null,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      });
      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    }
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

/** POST /api/auth/login */
app.post("/api/auth/login", requireMongo, async (req, res) => {
  await ensureMongoConnected();
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !user.passwordHash)
        return res.status(401).json({ error: "Invalid email or password" });
      if (!await bcrypt.compare(password, user.passwordHash))
        return res.status(401).json({ error: "Invalid email or password" });
      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

/** GET /api/auth/google/redirect — Initiate Google OAuth 2.0 */
app.get("/api/auth/google/redirect", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(`
      <html><body style="background:#0d0b1a;color:#f0e6ff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;text-align:center;padding:24px">
        <div style="font-size:3rem">⚠️</div>
        <h2 style="color:#ef4444;margin:0">Google OAuth Not Configured</h2>
        <p style="max-width:400px;color:#c4b5fd">Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your <code>.env</code> file (local) or Vercel Environment Variables (production).</p>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:#a78bfa">Open Google Cloud Console →</a>
        <p style="font-size:0.8rem;color:#7c6fa0">Add this as an Authorized Redirect URI:<br/><code style="background:#1a1035;padding:4px 8px;border-radius:4px">${getRedirectUri(req)}</code></p>
        <button onclick="window.close()" style="padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px">Close</button>
      </body></html>
    `);
  }

  const redirectUri = getRedirectUri(req);
  const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
  const authUrl = oauthClient.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    prompt: "select_account",
  });
  res.redirect(authUrl);
});

/** GET /api/auth/google/callback — Google returns here after consent */
app.get("/api/auth/google/callback", async (req, res) => {
  await ensureMongoConnected();
  const { code, error } = req.query;

  const postMessageScript = (payload) => `
    <html><body>
      <script>
        try {
          window.opener && window.opener.postMessage(${JSON.stringify(payload)}, "*");
        } catch(e) {}
        setTimeout(() => window.close(), 200);
      </script>
      <p style="font-family:system-ui;text-align:center;margin-top:40px;color:#888">
        ${payload.type === "GOOGLE_AUTH_SUCCESS" ? "✅ Signed in! Closing…" : "❌ Auth failed. Closing…"}
      </p>
    </body></html>
  `;

  if (error || !code) {
    return res.send(postMessageScript({ type: "GOOGLE_AUTH_ERROR", error: error || "No auth code returned" }));
  }

  try {
    if (!isMongoConnected) return res.status(503).send("Database unavailable. Google sign-in requires MongoDB.");
    const redirectUri = getRedirectUri(req);
    const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri);
    const { tokens } = await oauthClient.getToken(code);

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const { id: googleId, name, email, picture: avatarUrl } = await userInfoRes.json();

    if (!email || !name) throw new Error("Google did not return email/name");

    const normalizedEmail = email.toLowerCase().trim();
    const avatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;

    let appUser;
    if (isMongoConnected) {
      let user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        user = await User.create({ name, email: normalizedEmail, googleId, avatarUrl: avatar });
      } else {
        user.googleId = googleId;
        if (avatarUrl) user.avatarUrl = avatarUrl;
        await user.save();
      }
      appUser = { id: String(user._id), name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress };
    }

    const token = jwt.sign({ id: appUser.id, email: appUser.email, name: appUser.name }, JWT_SECRET, { expiresIn: "7d" });
    res.send(postMessageScript({ type: "GOOGLE_AUTH_SUCCESS", token, user: appUser }));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.send(postMessageScript({ type: "GOOGLE_AUTH_ERROR", error: err.message }));
  }
});

function publicProfile(user) {
  return {
    id: String(user._id), name: user.name, email: user.email,
    avatarUrl: user.avatarUrl, googleId: user.googleId || null, walletAddress: user.walletAddress || null,
    proofCount: user.proofCount || 0,
    verifiedCredentials: user.verifiedCredentials || { creditScoreVerified: false, incomeVerified: false, ageVerified: false },
    createdAt: user.createdAt,
  };
}

async function getProfile(req, res) {
  await ensureMongoConnected();
  try {
    if (isMongoConnected) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: publicProfile(user) });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

app.get("/api/auth/profile", authMiddleware, requireMongo, getProfile);
app.get("/api/auth/me", authMiddleware, requireMongo, getProfile);

app.put("/api/auth/profile", authMiddleware, requireMongo, async (req, res) => {
  await ensureMongoConnected();
  const updates = {};
  if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim().slice(0, 100);
  if (typeof req.body.avatarUrl === "string") updates.avatarUrl = req.body.avatarUrl.trim().slice(0, 2048);
  if (typeof req.body.walletAddress === "string") updates.walletAddress = req.body.walletAddress.trim() || null;
  try {
    if (isMongoConnected) {
      const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ success: true, user: publicProfile(user) });
    }
    return res.status(503).json({ error: "Database unavailable" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update user profile" });
  }
});

/** PUT /api/auth/wallet — Save Connected Wallet Address to MongoDB User Profile */
app.put("/api/auth/wallet", authMiddleware, requireMongo, async (req, res) => {
  await ensureMongoConnected();
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress is required" });
  }

  try {
    if (isMongoConnected) {
      const user = await User.findByIdAndUpdate(req.user.id, { walletAddress }, { new: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ success: true, walletAddress: user.walletAddress });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save wallet address" });
  }
});

/** POST /api/verifications */
app.post("/api/verifications", authMiddleware, requireMongo, async (req, res) => {
  await ensureMongoConnected();
  try {
    const { contractAddress, circuit, isEligible, verificationCount, transactionHash } = req.body;
    if (!contractAddress || isEligible === undefined || !verificationCount || !transactionHash)
      return res.status(400).json({ error: "Missing verification parameters" });

    if (isMongoConnected) {
      const record = await Verification.create({
        userId: req.user.id,
        userEmail: req.user.email,
        contractAddress,
        circuit: circuit || "verifyEligibility",
        isEligible: Boolean(isEligible),
        verificationCount: Number(verificationCount),
        transactionHash,
        timestamp: new Date(),
      });

      if (Boolean(isEligible)) {
        await User.findByIdAndUpdate(req.user.id, {
          $inc: { proofCount: 1 },
          $set: {
            "verifiedCredentials.creditScoreVerified": true,
            "verifiedCredentials.incomeVerified": true,
            "verifiedCredentials.ageVerified": true,
          },
        });
      } else {
        await User.findByIdAndUpdate(req.user.id, { $inc: { proofCount: 1 } });
      }

      return res.json({ success: true, record });
    }
  } catch (err) {
    console.error("Save verification error:", err);
    res.status(500).json({ error: "Failed to save verification record" });
  }
});

/** GET /api/verifications */
app.get("/api/verifications", authMiddleware, requireMongo, async (req, res) => {
  await ensureMongoConnected();
  try {
    if (isMongoConnected) {
      const records = await Verification.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(50);
      return res.json({ records });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch verifications" });
  }
});

// ─── Midnight Network Routes ─────────────────────────────────────────────────

/**
 * GET /api/contract/state
 * Proxies GraphQL query to Midnight Indexer and returns live on-chain ledger state.
 * Returns minCreditScore, minAnnualIncome, minAge, isEligible, verificationCount.
 */
app.get("/api/contract/state", async (req, res) => {
  const address = req.query.address || CONTRACT_ADDRESS;
  if (!address) return res.status(503).json({ error: "No deployed contract is configured. Set CONTRACT_ADDRESS after a verified Preprod deployment." });
  const graphqlQuery = {
      query: `query GetContractState($address: HexEncoded!) {
        contractAction(address: $address) {
          state
        }
    }`,
    variables: { address },
  };

  try {
    const response = await fetch(MIDNIGHT_INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graphqlQuery),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Midnight Indexer returned HTTP ${response.status}` });
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      return res.status(502).json({ error: "Midnight Indexer GraphQL error", details: json.errors });
    }

    const state = json?.data?.contractAction;
    if (!state) {
      return res.status(404).json({ error: `No contract state found for address ${address}` });
    }
    // State is an encoded Compact value. The browser decodes it with the
    // generated contract binding after verifier-key validation; this API must
    // not guess application fields from opaque ledger bytes.
    return res.json({ contractAddress: address, state: state.state });
  } catch (err) {
    console.error("[Midnight Indexer] Proxy error:", err.message);
    return res.status(502).json({ error: "Failed to reach Midnight Indexer", message: err.message });
  }
});

/**
 * POST /api/proof
 * Proxies ZK proof request to the Midnight Proof Server (PROOF_SERVER_URL).
 * Body: { circuit, witnesses }
 * Returns: { proof (base64), status }
 */
/**
 * POST /api/proof
 * Proxies ZK proof request to the Midnight Proof Server (PROOF_SERVER_URL).
 * Private witnesses are never accepted by this API. Proof generation belongs to
 * the wallet-local Midnight proving provider.
 */
app.post("/api/proof", async (req, res) => {
  return res.status(410).json({ error: "Proof generation is wallet-local. This API never accepts private witnesses." });
});

/**
 * GET /api/verifications/count
 * Returns the total number of verification records stored.
 */
app.get("/api/verifications/count", authMiddleware, requireMongo, async (req, res) => {
  await ensureMongoConnected();
  try {
    const count = await Verification.countDocuments({ userId: req.user.id });
    return res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count verifications" });
  }
});

// ─── Export for Vercel ─────────────────────────────────────────────────────────

module.exports = app;
