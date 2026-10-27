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

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = Number(process.env.PORT || 3000);
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",").map(x => x.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (FRONTEND_ORIGINS.includes(origin) || FRONTEND_ORIGINS.includes("*"))) {
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGINS.includes("*") ? "*" : origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const required = ["SMTP_USER", "SMTP_PASS", "OTP_PEPPER"];
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

const codes = new Map();
const sendAttempts = new Map();
const verifyAttempts = new Map();
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 8;

function hashCode(email, code) {
  return crypto.createHmac("sha256", process.env.OTP_PEPPER)
    .update(email.toLowerCase() + ":" + code).digest("hex");
}
function validEmail(email) {
  return typeof email === "string" && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function tooMany(map, key, max, windowMs) {
  const now = Date.now();
  const old = (map.get(key) || []).filter(t => now - t < windowMs);
  if (old.length >= max) { map.set(key, old); return true; }
  old.push(now); map.set(key, old); return false;
}

app.post("/api/send-code", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!validEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  if (tooMany(sendAttempts, email, MAX_SENDS_PER_HOUR, 60 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many code requests. Try again later." });
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  codes.set(email, { hash: hashCode(email, code), expiresAt: Date.now() + CODE_TTL_MS });
  verifyAttempts.delete(email);

  try {
    await transporter.sendMail({
      from: {
        name: process.env.MAIL_FROM_NAME || "BENGAL Verification",
        address: process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER
      },
      to: email,
      subject: "Your email verification code",
      text: "Your verification code is " + code + ". It expires in 10 minutes.",
      html: "<p>Your verification code is:</p><p style=\\"font-size:28px;font-weight:bold;letter-spacing:5px\\">" +
        code + "</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p>"
    });
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
  if (!validEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Enter the email address and 6-digit code." });
  }
  if (tooMany(verifyAttempts, email, MAX_VERIFY_ATTEMPTS, 10 * 60 * 1000)) {
    return res.status(429).json({ message: "Too many attempts. Request a new code later." });
  }

  const saved = codes.get(email);
  if (!saved || saved.expiresAt < Date.now()) {
    codes.delete(email);
    return res.status(400).json({ message: "Code expired or not found. Request a new code." });
  }

  const actual = Buffer.from(hashCode(email, code), "hex");
  const expected = Buffer.from(saved.hash, "hex");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return res.status(400).json({ message: "Incorrect verification code." });
  }

  codes.delete(email);
  verifyAttempts.delete(email);
  return res.json({ verified: true, email, message: "Email verified successfully!" });
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log("Bengal Auth API listening on port " + PORT));
`,
  ".env": `SMTP_USER=youraddress@gmail.com
SMTP_PASS=your_gmail_app_password
OTP_PEPPER=replace_with_a_long_random_secret
MAIL_FROM_NAME=BENGAL Verification
MAIL_FROM_ADDRESS=youraddress@gmail.com
SMTP_SERVICE=gmail
FRONTEND_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
PORT=3000
`,
  ".gitignore": `.env
node_modules/
`,
  "README.md": `# Bengal Auth Backend

## Requirements
- Node.js 18 or newer
- Gmail with 2-Step Verification and a Gmail App Password, or a compatible SMTP provider

## Install
Run these commands from this backend folder:

\`\`\`bash
npm init -y
npm install express nodemailer dotenv
node server.js
\`\`\`

## Configure .env
Edit the generated .env file. Set SMTP_USER to your sender account, SMTP_PASS to your provider's app password, and OTP_PEPPER to a long random secret. Never share or commit .env. MAIL_FROM_ADDRESS should be an address your email provider permits.

Set FRONTEND_ORIGINS to your website origin(s), separated by commas. For local VS Code Live Server, the default ports are examples; change them to match your local URL. For production, use your real website origin and HTTPS.

## Widget
Set BengalAuth.init({ apiUrl: "http://localhost:3000" }) while testing locally. Once deployed, replace it with your backend's HTTPS URL.

## API
- POST /api/send-code with JSON { "email": "person@example.com" }
- POST /api/verify-code with JSON { "email": "person@example.com", "code": "123456" }
- GET /health

## Important limitations
This starter stores codes and rate limits in memory, so a restart clears them and it is not production-ready for multiple instances. Add persistent storage, distributed rate limiting, monitoring, and stronger abuse protection before production. A verified email response does not create an account or establish a login session; implement those separately if needed.
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
