/**
 * ZkCred (AegisID) — Auth & MongoDB API Server
 * Provides Google OAuth 2.0 (Authorization Code), Manual Auth, and MongoDB Audit Persistence.
 * Trigger deployment build update.
 */

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { ContractState } from "@midnight-ntwrk/compact-runtime";
import { ledger as decodeGeneratedLedger } from "../src/managed/contract/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/zkcred";

// Google OAuth 2.0 credentials — set these in your .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `https://zkcred-api.onrender.com/api/auth/google/callback`;

// The origin that is permitted to receive OAuth postMessage results.
// MUST match the exact origin of the frontend application (scheme + host + port).
// Default: production Vercel deployment.  Override in .env for staging / local dev.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://zk-cred.vercel.app";

// Midnight Network config
const DEPLOYED_PREPROD_CONTRACT_ADDRESS = "cef93529eef2b8b8e85cd013619267e25df14e496ac1ea2e937681e909b6abd7";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || DEPLOYED_PREPROD_CONTRACT_ADDRESS;
const MIDNIGHT_INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL || "https://indexer.preprod.midnight.network/api/v3/graphql";
// Proof server runs locally via Docker: docker compose up -d (see docker-compose.yml)
const PROOF_SERVER_URL = process.env.PROOF_SERVER_URL || "http://localhost:6300";

const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

const ALLOWED_ORIGINS = [
  "https://zk-cred.vercel.app",
  /\.vercel\.app$/,
  /\.onrender\.com$/,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:4000",
  "http://localhost:5000",
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    cb(ok ? null : new Error("CORS not allowed"), ok);
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

// ─── MongoDB Connection ───────────────────────────────────────────────────────

let isMongoConnected = false;

async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully to ${MONGODB_URI}`);
  } catch (err) {
    isMongoConnected = false;
    console.error(`[MongoDB] Database connection failed:`, err.message);
  }
}

connectMongoDB();

// ─── Mongoose Schemas & Models ────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  displayName: { type: String, default: "" },
  email: { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, default: false },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  googleId: { type: String },
  authProvider: { type: String, enum: ["manual", "google"], default: "manual" },
  locale: { type: String, default: "" },
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

const User = mongoose.model("User", userSchema);
const Verification = mongoose.model("Verification", verificationSchema);

function requireMongo(req, res, next) {
  if (!isMongoConnected) {
    return res.status(503).json({ error: "Database unavailable. Authentication and audit storage require MongoDB." });
  }
  next();
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function authenticatedUserId(req) {
  const candidate = req.user?.id ?? req.user?._id ?? req.user?.userId;
  if (candidate == null) return null;
  const value = String(candidate);
  return mongoose.Types.ObjectId.isValid(value) ? value : null;
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing or invalid token. Please sign in." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if (!authenticatedUserId(req)) return res.status(401).json({ error: "Unauthorized: invalid account identifier." });
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: token verification failed. Please sign in again." });
  }
}

// ─── API Routes ───────────────────────────────────────────────────────────────

/** POST /api/auth/register — Manual User Registration */
app.post("/api/auth/register", requireMongo, async (req, res) => {
  try {
    const { name, email, password, walletAddress } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) return res.status(400).json({ error: "User with this email already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const cleanName = name.trim();
      const user = await User.create({
        name: cleanName,
        firstName: cleanName.split(/\s+/)[0] || "",
        lastName: cleanName.split(/\s+/).slice(1).join(" "),
        displayName: cleanName,
        email: normalizedEmail,
        passwordHash,
        authProvider: "manual",
        walletAddress: walletAddress || null,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      });

      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: publicProfile(user) });
    }
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

/** POST /api/auth/login — Manual User Login */
app.post("/api/auth/login", requireMongo, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (isMongoConnected) {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: "Invalid email or password" });

      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: publicProfile(user) });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

/** GET /api/auth/google/redirect — Initiate Google OAuth 2.0 Authorization Code Flow */
app.get("/api/auth/google/redirect", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(`
      <html><body style="background:#0d0b1a;color:#f0e6ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px">
        <h2 style="color:#ef4444">⚠ Google OAuth Not Configured</h2>
        <p>Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your <code>.env</code> file.</p>
        <p>See <a href="https://console.cloud.google.com/apis/credentials" style="color:#a78bfa" target="_blank">Google Cloud Console → Credentials</a></p>
        <p>Add <code>http://localhost:4000/api/auth/google/callback</code> as an Authorized Redirect URI.</p>
        <button onclick="window.close()" style="padding:10px 24px;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px">Close</button>
      </body></html>
    `);
  }

  const scopes = ["profile", "email"];
  const authUrl = googleOAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "select_account",
  });
  res.redirect(authUrl);
});

/** GET /api/auth/google/callback — Google returns here after consent */
app.get("/api/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.send(`
      <script>
        window.opener && window.opener.postMessage({ type: "GOOGLE_AUTH_ERROR", error: ${JSON.stringify(error || "No auth code returned")} }, ${JSON.stringify(FRONTEND_ORIGIN)});
        window.close();
      </script>
    `);
  }

  try {
    if (!isMongoConnected) return res.status(503).send("Database unavailable. Google sign-in requires MongoDB.");
    // Exchange code for tokens
    const { tokens } = await googleOAuthClient.getToken(code);
    googleOAuthClient.setCredentials(tokens);

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json();

    const { id: googleId, name, email, picture: avatarUrl, verified_email: emailVerified, given_name: firstName, family_name: lastName, locale } = googleUser;
    if (!email || !name) throw new Error("Google did not return email/name");

    const normalizedEmail = email.toLowerCase().trim();
    const avatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`;

    let appUser;
    if (isMongoConnected) {
      let user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        user = await User.create({ name, firstName: firstName || "", lastName: lastName || "", displayName: name, email: normalizedEmail, emailVerified: Boolean(emailVerified), googleId, avatarUrl: avatar, authProvider: "google", locale: locale || "" });
      } else {
        user.googleId = googleId;
        user.authProvider = "google";
        user.emailVerified = Boolean(emailVerified);
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.displayName = user.displayName || name;
        user.locale = locale || user.locale;
        if (avatarUrl) user.avatarUrl = avatarUrl;
        await user.save();
      }
      appUser = publicProfile(user);
    }

    const token = jwt.sign({ id: appUser.id, email: appUser.email, name: appUser.name }, JWT_SECRET, { expiresIn: "7d" });

    // Send result back to opener (popup) and close
    res.send(`
      <script>
        window.opener && window.opener.postMessage(
          { type: "GOOGLE_AUTH_SUCCESS", token: ${JSON.stringify(token)}, user: ${JSON.stringify(appUser)} },
          ${JSON.stringify(FRONTEND_ORIGIN)}
        );
        window.close();
      </script>
    `);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.send(`
      <script>
        window.opener && window.opener.postMessage({ type: "GOOGLE_AUTH_ERROR", error: ${JSON.stringify(err.message)} }, ${JSON.stringify(FRONTEND_ORIGIN)});
        window.close();
      </script>
    `);
  }
});

function publicProfile(user) {
  return {
    id: String(user._id),
    name: user.name, firstName: user.firstName || "", lastName: user.lastName || "", displayName: user.displayName || user.name,
    email: user.email, emailVerified: Boolean(user.emailVerified),
    avatarUrl: user.avatarUrl,
    googleId: user.googleId || null,
    authProvider: user.authProvider || (user.googleId ? "google" : "manual"), locale: user.locale || "",
    walletAddress: user.walletAddress || null,
    proofCount: user.proofCount || 0,
    verifiedCredentials: user.verifiedCredentials || { creditScoreVerified: false, incomeVerified: false, ageVerified: false },
    createdAt: user.createdAt,
  };
}

async function getProfile(req, res) {
  try {
    if (isMongoConnected) {
      const user = await User.findById(authenticatedUserId(req));
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: publicProfile(user) });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
}

/** GET /api/auth/profile — Complete authenticated MongoDB profile. */
app.get("/api/auth/profile", authMiddleware, requireMongo, getProfile);
/** Backwards-compatible alias. */
app.get("/api/auth/me", authMiddleware, requireMongo, getProfile);

/** PUT /api/auth/profile — Update user-controlled profile metadata. */
app.put("/api/auth/profile", authMiddleware, requireMongo, async (req, res) => {
  const updates = {};
  if (typeof req.body.name === "string" && req.body.name.trim()) updates.name = req.body.name.trim().slice(0, 100);
  if (typeof req.body.displayName === "string" && req.body.displayName.trim()) updates.displayName = req.body.displayName.trim().slice(0, 100);
  if (typeof req.body.firstName === "string") updates.firstName = req.body.firstName.trim().slice(0, 60);
  if (typeof req.body.lastName === "string") updates.lastName = req.body.lastName.trim().slice(0, 60);
  if (typeof req.body.locale === "string") updates.locale = req.body.locale.trim().slice(0, 20);
  if (typeof req.body.avatarUrl === "string") updates.avatarUrl = req.body.avatarUrl.trim().slice(0, 2048);
  if (typeof req.body.walletAddress === "string") updates.walletAddress = req.body.walletAddress.trim() || null;

  try {
    let user;
    if (isMongoConnected) {
      user = await User.findByIdAndUpdate(authenticatedUserId(req), { $set: updates }, { new: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ success: true, user: publicProfile(user) });
    }
    return res.status(503).json({ error: "Database unavailable" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

/** PUT /api/auth/wallet — Save Connected Wallet Address to MongoDB User Profile */
app.put("/api/auth/wallet", authMiddleware, requireMongo, async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress is required" });
  }

  try {
    if (isMongoConnected) {
      const user = await User.findByIdAndUpdate(authenticatedUserId(req), { walletAddress }, { new: true });
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ success: true, walletAddress: user.walletAddress });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save wallet address" });
  }
});

// ─── Midnight on-chain eligibility verifier ─────────────────────────────────

/**
 * Queries the Midnight Preprod Indexer to confirm that a given salt nullifier
 * is present in the contract's `eligibleNullifiers` set.
 *
 * The indexer returns raw Compact-encoded ledger state. We extract the
 * `eligibleNullifiers` set entries by requesting the full contractAction state
 * and scanning the encoded bytes for the nullifier — this is the server-side
 * equivalent of checkNullifierEligible() in the Compact contract.
 *
 * Note: The Midnight Indexer does not yet expose individual set-member queries
 * via GraphQL, so we use the `contractAction { state }` field and call the
 * checkNullifierEligible circuit off-chain through the GraphQL query that
 * returns the full eligible nullifiers set.
 *
 * Returns true only if the indexer confirms membership. Any network error,
 * GraphQL error, or absence of the nullifier returns false (fail-closed).
 */
async function verifyNullifierOnChain(contractAddress, nullifierHex) {
  if (!contractAddress || !nullifierHex) return false;
  const cleanNullifier = nullifierHex.replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleanNullifier)) return false;

  try {
    const response = await fetch(MIDNIGHT_INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query CheckNullifier($address: HexEncoded!) {
          contractAction(address: $address) {
            state
          }
        }`,
        variables: { address: contractAddress },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[on-chain verify] Indexer HTTP ${response.status}`);
      return false;
    }

    const json = await response.json();
    if (json.errors?.length) {
      console.error("[on-chain verify] GraphQL errors:", json.errors);
      return false;
    }

    const state = json?.data?.contractAction?.state;
    if (!state || typeof state !== "string") {
      console.error("[on-chain verify] No contract state returned for address:", contractAddress);
      return false;
    }

    // The Midnight Indexer encodes the full Compact ledger state as a hex
    // SCALE-encoded blob in the `state` field. The eligibleNullifiers set
    // is a Compact Set<Bytes<32>>. We look for the 32-byte nullifier bytes
    // within the raw state hex as a fast membership probe.
    //
    // This is a conservative, fail-closed check: if the nullifier bytes appear
    // verbatim in the state blob it is a strong signal the nullifier is
    // recorded (it is 32 random bytes with ~2^-256 false-positive probability).
    // A relying party running the full Compact verifier would use the generated
    // ledger() binding directly; the server-side approach here avoids bundling
    // the WASM runtime into the Node process.
    if (!/^(?:[0-9a-f]{2})+$/i.test(state)) return false;
    const contractState = ContractState.deserialize(Buffer.from(state, "hex"));
    const ledger = decodeGeneratedLedger(contractState.data);
    return Boolean(ledger.eligibleNullifiers.member(Buffer.from(cleanNullifier, "hex")));
  } catch (err) {
    console.error("[on-chain verify] Network/parse error:", err.message);
    return false;
  }
}

/** POST /api/verifications — Save ZK Verification Audit Log & Update User Credentials */
app.post("/api/verifications", authMiddleware, requireMongo, async (req, res) => {
  try {
    const { contractAddress, circuit, isEligible, verificationCount, transactionHash, nullifierHex } = req.body;
    if (!contractAddress || isEligible === undefined || !verificationCount || !transactionHash) {
      return res.status(400).json({ error: "Missing verification parameters" });
    }

    // ── On-chain nullifier gate ──────────────────────────────────────────────
    // We NEVER trust the client-supplied `isEligible` flag alone.
    // Before awarding any credential badge, confirm that the nullifier for
    // this proof call is present in the on-chain eligibleNullifiers set.
    //
    // If nullifierHex is absent or the indexer cannot confirm membership,
    // we still record the verification in the audit log (for non-eligible
    // submissions this is expected) but we do NOT award credential badges.
    let onChainEligible = false;
    if (Boolean(isEligible)) {
      if (!nullifierHex) {
        return res.status(400).json({
          error: "nullifierHex is required when isEligible is true. " +
                 "Supply the salt nullifier returned by the ZK proof submission.",
        });
      }
      onChainEligible = await verifyNullifierOnChain(contractAddress, nullifierHex);
      if (!onChainEligible) {
        return res.status(403).json({
          error: "On-chain eligibility could not be confirmed: the supplied nullifier " +
                 "was not found in the contract's eligibleNullifiers set. " +
                 "Proof verification failed — no credential badge will be awarded.",
        });
      }
    }
    // ── End on-chain gate ────────────────────────────────────────────────────

    if (isMongoConnected) {
      const record = await Verification.create({
        userId: authenticatedUserId(req),
        userEmail: req.user.email,
        contractAddress,
        circuit: circuit || "verifyEligibility",
        isEligible: onChainEligible,
        verificationCount: Number(verificationCount),
        transactionHash,
        timestamp: new Date(),
      });

      // The pinned Compact toolchain cannot verify issuer signatures. The
      // current circuit therefore proves only the supplied numbers, not that
      // they came from a trusted issuer. Record the result, but never award
      // credential-authenticity badges on this evidence alone.
      await User.findByIdAndUpdate(authenticatedUserId(req), { $inc: { proofCount: 1 } });

      return res.json({ success: true, record });
    }
  } catch (err) {
    console.error("Save verification error:", err);
    res.status(500).json({ error: "Failed to save verification record to MongoDB" });
  }
});

/** GET /api/verifications — Fetch User Verification Audit Logs from MongoDB */
app.get("/api/verifications", authMiddleware, requireMongo, async (req, res) => {
  try {
    if (isMongoConnected) {
      const records = await Verification.find({ userId: authenticatedUserId(req) }).sort({ timestamp: -1 }).limit(50);
      return res.json({ records });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch verifications" });
  }
});

/** GET /api/verifications/count */
app.get("/api/verifications/count", authMiddleware, requireMongo, async (req, res) => {
  try {
    const count = await Verification.countDocuments({ userId: authenticatedUserId(req) });
    return res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count verifications" });
  }
});

/**
 * GET /api/contract/state
 * Proxies GraphQL query to the Midnight Preprod Indexer and returns live on-chain state.
 */
app.get("/api/contract/state", async (req, res) => {
  const address = req.query.address || CONTRACT_ADDRESS;
  if (!address) return res.status(503).json({ error: "No deployed contract is configured. Set CONTRACT_ADDRESS after a verified Preprod deployment." });

  try {
    const graphqlQuery = {
      query: `query GetContractState($address: HexEncoded!) {
        contractAction(address: $address) {
          state
        }
      }`,
      variables: { address },
    };

    const response = await fetch(MIDNIGHT_INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graphqlQuery),
      signal: AbortSignal.timeout(8000),
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
    // State is encoded Compact data. It is decoded in the browser with the
    // generated binding after verifier-key validation; never infer fields here.
    return res.json({ contractAddress: address, state: state.state });
  } catch (err) {
    console.error("[Midnight Indexer] Unreachable:", err.message);
    return res.status(502).json({ error: "Failed to reach Midnight Indexer", message: err.message });
  }
});

/**
 * POST /api/proof
 * This endpoint is intentionally disabled. A browser dApp must generate the proof
 * through the user's wallet/proving provider so private witnesses never reach this API.
 */
app.post("/api/proof", async (req, res) => {
  return res.status(410).json({ error: "Proof generation is wallet-local. This API never accepts private witnesses." });
});

// ─── Health Check ──────────────────────────────────────────────────────────────────────────

/** GET /api/health — Render & uptime monitors call this */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "zkcred-api",
    timestamp: new Date().toISOString(),
    mongo: isMongoConnected ? "connected" : "unavailable",
    proofServer: PROOF_SERVER_URL,
    contract: CONTRACT_ADDRESS,
    indexer: MIDNIGHT_INDEXER_URL,
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[ZkCred] Server running on port ${PORT}`);
  console.log(`[ZkCred] Proof Server: ${PROOF_SERVER_URL}`);
  console.log(`[ZkCred] Indexer: ${MIDNIGHT_INDEXER_URL}`);
  console.log(`[ZkCred] Contract: ${CONTRACT_ADDRESS}`);
  console.log(`[ZkCred] Google OAuth callback: ${GOOGLE_REDIRECT_URI}`);
});
