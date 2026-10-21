const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { Pool } = require("pg");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(helmet());
app.use(cors({
origin: (process.env.ALLOWED_ORIGINS || "")
.split(",")
.filter(Boolean)
}));
app.use(express.json({ limit: "20kb" }));

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.DATABASE_URL
? { rejectUnauthorized: false }
: false
});

const PORT = process.env.PORT || 3000;
const MIN_WITHDRAWAL = 100;

app.get("/", (req, res) => {
res.json({
app: "VINOD AVJS ROYAL KING",
status: "running",
version: "1.0.0"
});
});

app.get("/api/health", async (req, res) => {
try {
await pool.query("SELECT 1");
res.json({ status: "ok", database: "connected" });
} catch {
res.status(503).json({
status: "error",
database: "unavailable"
});
}
});

async function initializeDatabase() {
await pool.query(`
CREATE TABLE IF NOT EXISTS users (
id UUID PRIMARY KEY,
name TEXT NOT NULL,
email TEXT UNIQUE NOT NULL,
password_hash TEXT NOT NULL,
balance NUMERIC(12,2) NOT NULL DEFAULT 0
CHECK (balance >= 0),
created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL
    CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 100),
  upi_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

`);
}

// Passwords are hashed using Node's built-in scrypt.
async function hashPassword(password, salt = crypto.randomBytes(16)) {
const derived = await new Promise((resolve, reject) => {
crypto.scrypt(password, salt, 64, (err, key) => {
if (err) reject(err);
else resolve(key);
});
});

return {
salt: salt.toString("hex"),
hash: derived.toString("hex")
};
}

async function verifyPassword(password, saltHex, hashHex) {
const result = await hashPassword(
password,
Buffer.from(saltHex, "hex")
);

const expected = Buffer.from(hashHex, "hex");
const actual = Buffer.from(result.hash, "hex");

return expected.length === actual.length &&
crypto.timingSafeEqual(expected, actual);
}

// Production authentication should use a vetted session/JWT
// implementation, rate limits and verified account ownership.
// This demo deliberately does not expose wallet mutation APIs.

app.post("/api/register", async (req, res) => {
try {
const { name, email, password } = req.body || {};

if (
  typeof name !== "string" ||
  name.trim().length < 2 ||
  name.length > 80 ||
  typeof email !== "string" ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  typeof password !== "string" ||
  password.length < 10 ||
  password.length > 200
) {
  return res.status(400).json({
    error: "Valid name, email and password of at least 10 characters required"
  });
}

const normalizedEmail = email.trim().toLowerCase();
const id = crypto.randomUUID();
const credentials = await hashPassword(password);

await pool.query(
  `INSERT INTO users
   (id, name, email, password_hash)
   VALUES ($1, $2, $3, $4)`,
  [
    id,
    name.trim(),
    normalizedEmail,
    `${credentials.salt}:${credentials.hash}`
  ]
);

res.status(201).json({
  message: "Registration successful",
  user: {
    id,
    name: name.trim(),
    email: normalizedEmail,
    balance: 0
  }
});

} catch (error) {
if (error.code === "23505") {
return res.status(409).json({
error: "Email already registered"
});
}

console.error("Registration failed:", error.message);
res.status(500).json({ error: "Registration failed" });

}
});

// These endpoints are intentionally placeholders until secure
// authentication and ownership checks are configured.
app.get("/api/wallet", (req, res) => {
res.status(401).json({
error: "Authentication required"
});
});

app.get("/api/transactions", (req, res) => {
res.status(401).json({
error: "Authentication required"
});
});

app.post("/api/withdrawals", (req, res) => {
res.status(401).json({
error: "Authentication required"
});
});

// Admin approval and wallet crediting must be implemented only
// behind verified admin authentication and audited ledger logic.

app.use((req, res) => {
res.status(404).json({ error: "Endpoint not found" });
});

async function start() {
if (!process.env.DATABASE_URL) {
console.error("DATABASE_URL environment variable is required.");
process.exit(1);
}

try {
await initializeDatabase();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Royal King backend listening on ${PORT}`);
});

} catch (error) {
console.error("Backend startup failed:", error.message);
process.exit(1);
}
}

start();
