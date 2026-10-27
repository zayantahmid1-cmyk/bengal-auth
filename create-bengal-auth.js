const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Where should the backend files be created?\nEnter a folder path (or press Enter for ./backend): ", answer => {
  rl.close();

  const chosenPath = answer.trim();
  const backendDir = path.resolve(process.cwd(), chosenPath || "backend");

  try {
    fs.mkdirSync(backendDir, { recursive: true });
    generateFiles(backendDir);
  } catch (error) {
    console.error("Could not create backend files:", error.message);
    process.exitCode = 1;
  }
});

function generateFiles(backendDir) {
  const files = {
  "server.js": String.raw`require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10kb" }));
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, "users.json");
const SESSIONS_FILE = path.join(__dirname, "sessions.json");
const users = loadUsers();
const pendingSignups = new Map();
const codes = new Map();
const attempts = new Map();
const sessions = loadSessions();
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
function loadSessions() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
    const active = Object.entries(parsed).filter(([, session]) => session && session.expiresAt > Date.now());
    return new Map(active);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not read sessions database:", error.message);
    return new Map();
  }
}
function saveSessions() {
  const active = Object.fromEntries([...sessions.entries()].filter(([, session]) => session.expiresAt > Date.now()));
  const temp = SESSIONS_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(active, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, SESSIONS_FILE);
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
  const templatePath = path.join(__dirname, "verification-email.html");
  let html;
  try {
    html = fs.readFileSync(templatePath, "utf8")
      .replace(/{{CODE}}/g, code)
      .replace(/{{EXPIRY_MINUTES}}/g, String(Math.floor(CODE_TTL_MS / 60000)))
      .replace(/{{BRAND_NAME}}/g, process.env.MAIL_FROM_NAME || "BENGAL");
  } catch (error) {
    console.error("Could not load verification-email.html:", error.message);
    throw new Error("Email template is missing or unreadable.");
  }
  await transporter.sendMail({
    from: { name: process.env.MAIL_FROM_NAME || "BENGAL Verification", address: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER },
    to: email,
    subject: "Your BENGAL verification code",
    text: "Your BENGAL verification code is " + code + ". It expires in " + Math.floor(CODE_TTL_MS / 60000) + " minutes. Never share this code.",
    html
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
  sessions.set(token, { userId: user.id, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  saveSessions();
  const redirectUrl = process.env.LOGIN_REDIRECT_URL || "/home.html";
  return res.json({ token, user: publicUser(user), redirectUrl, message: "Logged in successfully!" });
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
  saveSessions();
  return res.json({ message: "Logged out." });
});
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log("BENGAL Auth API listening on port " + PORT));`,
  "verification-email.html": String.raw`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>BENGAL verification code</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your BENGAL verification code expires in {{EXPIRY_MINUTES}} minutes.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
      <tr><td style="padding:28px 32px;background:#0b1120;color:#ffffff;">
        <div style="font-size:12px;letter-spacing:4px;font-weight:bold;color:#93c5fd;">WELCOME TO</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:3px;margin-top:6px;">{{BRAND_NAME}}</div>
      </td></tr>
      <tr><td style="padding:34px 32px 18px;">
        <div style="font-size:23px;font-weight:700;margin-bottom:12px;">Verify your email address</div>
        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 24px;">Use the secure verification code below to finish creating your account. If you did not request this code, you can safely ignore this email.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;text-align:center;padding:22px 12px;">
          <div style="font-size:12px;font-weight:bold;letter-spacing:2px;color:#1d4ed8;margin-bottom:10px;">YOUR VERIFICATION CODE</div>
          <div style="font-size:34px;line-height:1.3;font-weight:800;letter-spacing:9px;color:#0f172a;">{{CODE}}</div>
        </div>
        <p style="font-size:13px;line-height:1.7;color:#64748b;margin:20px 0 0;">For your security, this code expires in <strong>{{EXPIRY_MINUTES}} minutes</strong>. Never share it with anyone.</p>
      </td></tr>
      <tr><td style="padding:22px 32px 28px;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;line-height:1.7;color:#94a3b8;margin:0;">This is an automated message from {{BRAND_NAME}}. Please do not reply to this email.</p>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#94a3b8;padding:18px 12px;">© {{BRAND_NAME}} · Account security</div>
  </td></tr></table>
</body></html>`,
  ".env": `SMTP_USER=youraddress@gmail.com
SMTP_PASS=your_gmail_app_password
OTP_PEPPER=replace_with_a_long_random_secret
MAIL_FROM_NAME=BENGAL Verification
MAIL_FROM_ADDRESS=youraddress@gmail.com
SMTP_SERVICE=gmail
FRONTEND_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
PORT=3000
LOGIN_REDIRECT_URL=/home.html
`,
  ".gitignore": `.env
node_modules/
`,
  "README.md": `# BENGAL Auth Backend

## Requirements
- Node.js 18 or newer
- Gmail with 2-Step Verification and a Gmail App Password, or a compatible SMTP provider

## Install
Run these commands in the generated backend folder:

\`\`\`bash
npm install express nodemailer dotenv
node server.js
\`\`\`

## Configure .env
Set SMTP_USER and SMTP_PASS to your real SMTP credentials, and set OTP_PEPPER to a long random secret. Never share or commit .env.

Set LOGIN_REDIRECT_URL to the destination after successful login, such as /dashboard.html or https://your-site.example/dashboard. Set FRONTEND_ORIGINS to your frontend origin(s), separated by commas.

## Customize the verification email
Edit verification-email.html. It is an HTML email template. Keep these placeholders so the server can fill them in:
- {{CODE}} — the 6-digit code
- {{EXPIRY_MINUTES}} — how long the code remains valid
- {{BRAND_NAME}} — the configured brand/sender name

Email apps may display HTML differently, so use inline styles and table-based layout for compatibility.

## Important
User accounts are saved in users.json and sessions in sessions.json; login sessions expire after 30 days. Verification codes and rate limits remain in memory and are cleared when the server restarts. This starter is for development, not production deployment. Use HTTPS and a proper database before production.
`
  };

  for (const [name, data] of Object.entries(files)) {
    const target = path.join(backendDir, name);
    if (fs.existsSync(target)) {
      console.log("Skipped existing file:", target);
      continue;
    }
    fs.writeFileSync(target, data, { encoding: "utf8", flag: "wx" });
    console.log("Created:", target);
  }

  console.log("\nBackend folder:", backendDir);
  console.log("Next: open a terminal in that folder, then run npm init -y && npm install express nodemailer dotenv");
}
