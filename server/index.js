/**
 * ZkCred (AegisID) — Auth & MongoDB API Server
 * Provides Google OAuth 2.0 (Authorization Code), Manual Auth, and MongoDB Audit Persistence.
 */

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "zkcred_jwt_secret_key_2026";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/zkcred";

// Google OAuth 2.0 credentials — set these in your .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/api/auth/google/callback`;

const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

const ALLOWED_ORIGINS = [
  "https://zk-cred.vercel.app",
  /\.vercel\.app$/,
  /\.onrender\.com$/,
  "http://localhost:3000",
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

// ─── MongoDB Connection ───────────────────────────────────────────────────────

let isMongoConnected = false;

async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    isMongoConnected = true;
    console.log(`[MongoDB] Connected successfully to ${MONGODB_URI}`);
  } catch (err) {
    isMongoConnected = false;
    console.warn(`[MongoDB] Database connection warning (running in memory fallback mode):`, err.message);
  }
}

connectMongoDB();

// ─── Mongoose Schemas & Models ────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  googleId: { type: String },
  walletAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const verificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userEmail: { type: String },
  contractAddress: { type: String, required: true },
  circuit: { type: String, default: "verifyEligibility" },
  isEligible: { type: Boolean, required: true },
  verificationCount: { type: Number, required: true },
  saltCommitment: { type: String, required: true },
  transactionHash: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Verification = mongoose.model("Verification", verificationSchema);

// Memory fallback store if MongoDB container is not running locally
const memoryUsers = new Map();
const memoryVerifications = [];

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: missing or invalid token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: token verification failed" });
  }
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      req.user = { id: "anonymous", email: "guest@zkcred.io", name: "Anonymous Guest" };
    }
  } else {
    req.user = { id: "anonymous", email: "guest@zkcred.io", name: "Anonymous Guest" };
  }
  next();
}

// ─── API Routes ───────────────────────────────────────────────────────────────

/** POST /api/auth/register — Manual User Registration */
app.post("/api/auth/register", async (req, res) => {
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
      const user = await User.create({
        name,
        email: normalizedEmail,
        passwordHash,
        walletAddress: walletAddress || null,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      });

      const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    } else {
      if (memoryUsers.has(normalizedEmail)) {
        return res.status(400).json({ error: "User with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = {
        id: "mem_" + Date.now(),
        name,
        email: normalizedEmail,
        passwordHash,
        walletAddress,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      };
      memoryUsers.set(normalizedEmail, user);
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    }
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error during registration" });
  }
});

/** POST /api/auth/login — Manual User Login */
app.post("/api/auth/login", async (req, res) => {
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
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    } else {
      const user = memoryUsers.get(normalizedEmail);
      if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid email or password" });

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) return res.status(401).json({ error: "Invalid email or password" });

      const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
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
        window.opener && window.opener.postMessage({ type: "GOOGLE_AUTH_ERROR", error: ${JSON.stringify(error || "No auth code returned")} }, "*");
        window.close();
      </script>
    `);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await googleOAuthClient.getToken(code);
    googleOAuthClient.setCredentials(tokens);

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json();

    const { id: googleId, name, email, picture: avatarUrl } = googleUser;
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
      appUser = { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress };
    } else {
      let user = memoryUsers.get(normalizedEmail);
      if (!user) {
        user = { id: "mem_g_" + Date.now(), name, email: normalizedEmail, googleId, avatarUrl: avatar };
        memoryUsers.set(normalizedEmail, user);
      } else {
        user.googleId = googleId;
        if (avatarUrl) user.avatarUrl = avatarUrl;
      }
      appUser = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress };
    }

    const token = jwt.sign({ id: appUser.id, email: appUser.email, name: appUser.name }, JWT_SECRET, { expiresIn: "7d" });

    // Send result back to opener (popup) and close
    res.send(`
      <script>
        window.opener && window.opener.postMessage(
          { type: "GOOGLE_AUTH_SUCCESS", token: ${JSON.stringify(token)}, user: ${JSON.stringify(appUser)} },
          "*"
        );
        window.close();
      </script>
    `);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.send(`
      <script>
        window.opener && window.opener.postMessage({ type: "GOOGLE_AUTH_ERROR", error: ${JSON.stringify(err.message)} }, "*");
        window.close();
      </script>
    `);
  }
});

/** GET /api/auth/me — Current User Profile */
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    } else {
      const user = memoryUsers.get(req.user.email);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, walletAddress: user.walletAddress } });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

/** POST /api/verifications — Save ZK Verification Audit Log to MongoDB */
app.post("/api/verifications", optionalAuthMiddleware, async (req, res) => {
  try {
    const { contractAddress, circuit, isEligible, verificationCount, saltCommitment, transactionHash } = req.body;
    if (!contractAddress || isEligible === undefined || !verificationCount || !saltCommitment || !transactionHash) {
      return res.status(400).json({ error: "Missing verification parameters" });
    }

    if (isMongoConnected) {
      const record = await Verification.create({
        userId: req.user.id,
        userEmail: req.user.email,
        contractAddress,
        circuit: circuit || "verifyEligibility",
        isEligible: Boolean(isEligible),
        verificationCount: Number(verificationCount),
        saltCommitment,
        transactionHash,
        timestamp: new Date(),
      });
      return res.json({ success: true, record });
    } else {
      const record = {
        id: "ver_" + Date.now(),
        userId: req.user.id,
        userEmail: req.user.email,
        contractAddress,
        circuit: circuit || "verifyEligibility",
        isEligible: Boolean(isEligible),
        verificationCount: Number(verificationCount),
        saltCommitment,
        transactionHash,
        timestamp: new Date().toISOString(),
      };
      memoryVerifications.push(record);
      return res.json({ success: true, record });
    }
  } catch (err) {
    console.error("Save verification error:", err);
    res.status(500).json({ error: "Failed to save verification record to MongoDB" });
  }
});

/** GET /api/verifications — Fetch User Verification Audit Logs from MongoDB */
app.get("/api/verifications", optionalAuthMiddleware, async (req, res) => {
  try {
    if (isMongoConnected) {
      const filter = req.user.id === "anonymous" ? {} : { userId: req.user.id };
      const records = await Verification.find(filter).sort({ timestamp: -1 }).limit(50);
      return res.json({ records });
    } else {
      const records = req.user.id === "anonymous" ? [...memoryVerifications].reverse() : memoryVerifications.filter((v) => v.userId === req.user.id).reverse();
      return res.json({ records });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch verifications" });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[ZkCred Server] Express & MongoDB API Server listening on port ${PORT}`);
});
