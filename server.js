require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10kb" }));
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, "users.json");
const users = loadUsers();
const pendingSignups = new Map();
const codes = new Map();
const attempts = new Map();
const sessions = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500").split(",").map(x => x.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (FRONTEND_ORIGINS.includes(origin) || FRONTEND_ORIGINS.includes("*"))) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGINS.includes("*") ? "*" : origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const required = ["SMTP_USER", "SMTP_PASS"];
for (const key of required) {
  if (!process.env[key]) {
    console.error("Missing required environment variable:", key);
    process.exit(1);
  }
}
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || "gmail",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

function loadUsers() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read users database:", error.message);
    return [];
  }
}
function saveUsers() {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(users, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, DB_FILE);
}
function validEmail(email) {
  return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key.toString("hex")));
  });
}
function tooMany(key, max, windowMs) {
  const now = Date.now();
  const old = (attempts.get(key) || []).filter(t => now - t < windowMs);
  if (old.length >= max) { attempts.set(key, old); return true; }
  old.push(now);
  attempts.set(key, old);
  return false;
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, verified: user.verified };
}
function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}
async function sendCode(email, code) {
  await transporter.sendMail({
    from: { name: process.env.MAIL_FROM_NAME || "BENGAL Verification", address: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER },
    to: email,
    subject: "Your BENGAL verification code",
    text: "Your verification code is " + code + ". It expires in 10 minutes.",
    html: "<p>Your BENGAL verification code is:</p><p style=\"font-size:28px;font-weight:bold;letter-spacing:5px\">" + code + "</p><p>This code expires in 10 minutes.</p>"
  });
}

app.post("/api/signup", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (name.length < 1 || name.length > 100 || !validEmail(email) || password.length < 8 || password.length > 200) {
    return res.status(400).json({ message: "Enter a name, valid email, and password of at least 8 characters." });
  }
  if (users.some(user => user.email === email)) return res.status(409).json({ message: "An account with this email already exists. Please log in." });
  if (tooMany("signup:" + email, 5, 60 * 60 * 1000)) return res.status(429).json({ message: "Too many attempts. Try again later." });
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt);
    pendingSignups.set(email, { id: crypto.randomUUID(), name, email, salt, passwordHash, createdAt: Date.now() });
    return res.json({ requiresVerification: true, message: "Details saved temporarily. Verify your email to finish creating your account." });
  } catch (error) {
    console.error("Signup failed:", error.message);
    return res.status(500).json({ message: "Could not start registration. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!validEmail(email) || !password || password.length > 200) return res.status(400).json({ message: "Enter a valid email and password." });
  if (tooMany("login:" + email, 10, 15 * 60 * 1000)) return res.status(429).json({ message: "Too many login attempts. Try again later." });
  const user = users.find(item => item.email === email);
  if (!user || !user.verified) return res.status(401).json({ message: "Invalid email or password, or email not verified." });
  const hash = await hashPassword(password, user.salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ message: "Invalid email or password." });
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return res.json({ token, user: publicUser(user), message: "Logged in successfully!" });
});

app.post("/api/send-code", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!validEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (!pendingSignups.has(email) && !users.some(user => user.email === email && !user.verified)) {
    return res.status(400).json({ message: "Start Sign Up first to verify this email." });
  }
  if (tooMany("code:" + email, 5, 60 * 60 * 1000)) return res.status(429).json({ message: "Too many code requests. Try again later." });
  const code = newCode();
  codes.set(email, { hash: crypto.createHash("sha256").update(email + ":" + code + ":" + (process.env.OTP_PEPPER || "local-dev-pepper")).digest("hex"), expiresAt: Date.now() + CODE_TTL_MS });
  try {
    await sendCode(email, code);
    return res.json({ message: "If the address is valid, a verification code has been sent." });
  } catch (error) {
    codes.delete(email);
    console.error("Email send failed:", error.message);
    return res.status(502).json({ message: "Could not send email. Check the server email configuration." });
  }
});

app.post("/api/verify-code", (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ message: "Enter the email address and 6-digit code." });
  if (tooMany("verify:" + email, 8, 10 * 60 * 1000)) return res.status(429).json({ message: "Too many attempts. Request a new code later." });
  const saved = codes.get(email);
  if (!saved || saved.expiresAt < Date.now()) {
    codes.delete(email);
    return res.status(400).json({ message: "Code expired or not found. Request a new code." });
  }
  const actual = crypto.createHash("sha256").update(email + ":" + code + ":" + (process.env.OTP_PEPPER || "local-dev-pepper")).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(saved.hash, "hex"))) return res.status(400).json({ message: "Incorrect verification code." });
  codes.delete(email);
  const pending = pendingSignups.get(email);
  if (!pending) return res.status(400).json({ message: "Registration expired. Please sign up again." });
  if (users.some(user => user.email === email)) return res.status(409).json({ message: "An account with this email already exists." });
  const user = { ...pending, verified: true };
  delete user.createdAt;
  users.push(user);
  saveUsers();
  pendingSignups.delete(email);
  return res.json({ verified: true, email, message: "Email verified and account created successfully!" });
});

app.get("/api/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ message: "Please log in again." });
  }
  const user = users.find(item => item.id === session.userId);
  if (!user) return res.status(401).json({ message: "Please log in again." });
  return res.json({ user: publicUser(user) });
});
app.post("/api/logout", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  sessions.delete(token);
  return res.json({ message: "Logged out." });
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log("BENGAL Auth API listening on port " + PORT));