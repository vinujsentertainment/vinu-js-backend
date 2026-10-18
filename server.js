"use strict";

const express = require("express");
const { Pool } = require("pg");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "20kb" }));

app.use("/api", rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
}));

const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32) {
  console.error("Set a strong ADMIN_TOKEN of at least 32 characters");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false"
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MIN_WITHDRAWAL_PAISE = 10000; // ₹100

function rupees(paise) {
  return Number((paise / 100).toFixed(2));
}

function newUserId() {
  return "VK" + crypto.randomBytes(8).toString("hex");
}

function asyncRoute(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallet_ledger (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_paise BIGINT NOT NULL,
      entry_type TEXT NOT NULL
        CHECK (entry_type IN ('credit', 'debit')),
      source TEXT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      amount_paise BIGINT NOT NULL CHECK (amount_paise >= 10000),
      status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Approved', 'Paid', 'Rejected')),
      payment_reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ledger_user_idx
      ON wallet_ledger(user_id);

    CREATE INDEX IF NOT EXISTS withdrawals_user_idx
      ON withdrawals(user_id);
  `);

  console.log("Database initialized");
}

async function getBalance(client, userId) {
  const result = await client.query(`
    SELECT COALESCE(SUM(
      CASE
        WHEN entry_type = 'credit' THEN amount_paise
        ELSE -amount_paise
      END
    ), 0)::bigint AS balance
    FROM wallet_ledger
    WHERE user_id = $1
  `, [userId]);

  return Number(result.rows[0].balance);
}

function requireAdmin(req, res, next) {
  const supplied = req.get("x-admin-token") || "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_TOKEN);

  if (a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "VINOD AVJS ROYAL KING"
  });
});

// Create a new user account.
app.post("/api/users", asyncRoute(async (req, res) => {
  const id = newUserId();

  await pool.query(
    "INSERT INTO users (id) VALUES ($1)",
    [id]
  );

  res.status(201).json({
    userId: id,
    balance: 0,
    currency: "INR"
  });
}));

// Get wallet balance and transaction history.
app.get("/api/wallet/:userId", asyncRoute(async (req, res) => {
  const userId = req.params.userId;

  const user = await pool.query(
    "SELECT id FROM users WHERE id = $1",
    [userId]
  );

  if (!user.rowCount) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  const balance = await getBalance(pool, userId);

  const ledger = await pool.query(`
    SELECT id, amount_paise, entry_type, source,
           reference, created_at
    FROM wallet_ledger
    WHERE user_id = $1
    ORDER BY id DESC
    LIMIT 50
  `, [userId]);

  res.json({
    userId,
    balance: rupees(balance),
    currency: "INR",
    transactions: ledger.rows.map(row => ({
      id: row.id,
      amount: rupees(Number(row.amount_paise)),
      type: row.entry_type,
      source: row.source,
      reference: row.reference,
      createdAt: row.created_at
    }))
  });
}));

// Submit a withdrawal request.
app.post("/api/withdrawals", asyncRoute(async (req, res) => {
  const userId = String(req.body.userId || "");
  const amount = Number(req.body.amount);

  if (!userId || !Number.isFinite(amount) ||
      !Number.isSafeInteger(amount * 100) ||
      amount < 100 || amount > 1000000) {
    return res.status(400).json({
      error: "Valid userId and amount between ₹100 and ₹10,00,000 required"
    });
  }

  const amountPaise = Math.round(amount * 100);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    if (!user.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "User not found"
      });
    }

    const balance = await getBalance(client, userId);

    const pending = await client.query(`
      SELECT COALESCE(SUM(amount_paise), 0)::bigint AS total
      FROM withdrawals
      WHERE user_id = $1
        AND status IN ('Pending', 'Approved')
    `, [userId]);

    const reserved = Number(pending.rows[0].total);

    if (balance - reserved < amountPaise) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Insufficient available balance",
        availableBalance: rupees(Math.max(0, balance - reserved))
      });
    }

    const result = await client.query(`
      INSERT INTO withdrawals (user_id, amount_paise)
      VALUES ($1, $2)
      RETURNING id, amount_paise, status, created_at
    `, [userId, amountPaise]);

    await client.query("COMMIT");

    res.status(201).json({
      withdrawal: {
        id: result.rows[0].id,
        amount: rupees(Number(result.rows[0].amount_paise)),
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

// Check withdrawal status.
app.get("/api/withdrawals/:userId", asyncRoute(async (req, res) => {
  const result = await pool.query(`
    SELECT id, amount_paise, status,
           payment_reference, created_at, updated_at
    FROM withdrawals
    WHERE user_id = $1
    ORDER BY id DESC
    LIMIT 50
  `, [req.params.userId]);

  res.json({
    withdrawals: result.rows.map(row => ({
      id: row.id,
      amount: rupees(Number(row.amount_paise)),
      status: row.status,
      paymentReference: row.payment_reference,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  });
}));

// Admin-only verified revenue credit.
// Never call this endpoint directly from the frontend.
app.post("/api/admin/credit", requireAdmin,
  asyncRoute(async (req, res) => {
    const userId = String(req.body.userId || "");
    const amount = Number(req.body.amount);
    const reference = String(req.body.reference || "");
    const source = String(req.body.source || "");

    if (!userId || !reference ||
        reference.length > 200 ||
        !Number.isFinite(amount) ||
        !Number.isSafeInteger(amount * 100) ||
        amount <= 0 || amount > 1000000 ||
        !["verified_ad_revenue", "admin_adjustment"].includes(source)) {
      return res.status(400).json({
        error: "Invalid credit data"
      });
    }

    const amountPaise = Math.round(amount * 100);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const user = await client.query(
        "SELECT id FROM users WHERE id = $1 FOR UPDATE",
        [userId]
      );

      if (!user.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "User not found"
        });
      }

      const result = await client.query(`
        INSERT INTO wallet_ledger
          (user_id, amount_paise, entry_type, source, reference)
        VALUES ($1, $2, 'credit', $3, $4)
        ON CONFLICT (reference) DO NOTHING
        RETURNING id
      `, [userId, amountPaise, source, reference]);

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Transaction reference already used"
        });
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        credited: rupees(amountPaise)
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

// Admin reviews withdrawal requests.
app.get("/api/admin/withdrawals", requireAdmin,
  asyncRoute(async (req, res) => {
    const result = await pool.query(`
      SELECT id, user_id, amount_paise, status,
             payment_reference, created_at
      FROM withdrawals
      ORDER BY id DESC
      LIMIT 100
    `);

    res.json({
      withdrawals: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        amount: rupees(Number(row.amount_paise)),
        status: row.status,
        paymentReference: row.payment_reference,
        createdAt: row.created_at
      }))
    });
  })
);

// Allowed transitions:
// Pending -> Approved / Rejected
// Approved -> Paid / Rejected
app.post("/api/admin/withdrawals/:id/status",
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = req.params.id;
    const status = String(req.body.status || "");
    const paymentReference = String(
      req.body.paymentReference || ""
    );

    if (!["Approved", "Paid", "Rejected"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status"
      });
    }

    if (status === "Paid" &&
        (!paymentReference || paymentReference.length > 200)) {
      return res.status(400).json({
        error: "Payment reference required when marking as Paid"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(`
        SELECT * FROM withdrawals
        WHERE id = $1
        FOR UPDATE
      `, [id]);

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Withdrawal not found"
        });
      }

      const withdrawal = result.rows[0];

      const allowed =
        (withdrawal.status === "Pending" &&
          ["Approved", "Rejected"].includes(status)) ||
        (withdrawal.status === "Approved" &&
          ["Paid", "Rejected"].includes(status));

      if (!allowed) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Invalid status transition",
          currentStatus: withdrawal.status
        });
      }

      if (status === "Rejected") {
        const user = await client.query(
          "SELECT id FROM users WHERE id = $1 FOR UPDATE",
          [withdrawal.user_id]
        );

        // Recheck available balance before releasing reserved funds.
        const balance = await getBalance(client, withdrawal.user_id);

        const otherPending = await client.query(`
          SELECT COALESCE(SUM(amount_paise), 0)::bigint AS total
          FROM withdrawals
          WHERE user_id = $1
            AND id <> $2
            AND status IN ('Pending', 'Approved')
        `, [withdrawal.user_id, id]);

        if (balance < Number(otherPending.rows[0].total)) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Cannot reject safely: wallet balance needs review"
          });
        }
      }

      const updated = await client.query(`
        UPDATE withdrawals
        SET status = $1,
            payment_reference = CASE
              WHEN $1 = 'Paid' THEN $2
              ELSE payment_reference
            END,
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, user_id, amount_paise, status,
                  payment_reference, updated_at
      `, [status, paymentReference || null, id]);

      // Once paid, create an idempotent ledger debit.
      if (status === "Paid") {
        const w = updated.rows[0];

        const debit = await client.query(`
          INSERT INTO wallet_ledger
            (user_id, amount_paise, entry_type, source, reference)
          VALUES ($1, $2, 'debit', 'withdrawal', $3)
          ON CONFLICT (reference) DO NOTHING
          RETURNING id
        `, [w.user_id, w.amount_paise, `withdrawal:${w.id}`]);

        if (!debit.rowCount) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            error: "Withdrawal debit already exists; reconcile manually"
          });
        }
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        withdrawal: {
          id: updated.rows[0].id,
          userId: updated.rows[0].user_id,
          amount: rupees(Number(updated.rows[0].amount_paise)),
          status: updated.rows[0].status,
          paymentReference: updated.rows[0].payment_reference
        }
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.use((err, req, res, next) => {
  console.error("Request failed:", err.message);

  if (res.headersSent) return next(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

async function start() {
  await initDatabase();

  const server = app.listen(PORT, () => {
    console.log(`VINOD AVJS ROYAL KING running on port ${PORT}`);
  });

  async function shutdown() {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch(error => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});
