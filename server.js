const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- DATABASE SETUP ---
let usePG = false;
let pool = null;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    usePG = true;
    console.log('Trying Postgres...');

    (async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ledger (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount INT NOT NULL,
            type TEXT NOT NULL,
            source TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS withdrawals (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount INT NOT NULL,
            upi TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log('✅ PG Tables Ready - Real Ledger Mode');
      } catch (e) {
        console.log('PG Table error:', e.message);
        usePG = false;
      }
    })();
  } catch (e) {
    console.log('PG init failed, using MEMORY mode:', e.message);
    usePG = false;
  }
}

// Fallback Memory (jab tak Neon DB nahi lagate)
let ledgerMem = [];
let withdrawalsMem = [];

async function getBalance(userId) {
  if (usePG && pool) {
    const r = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END),0) as bal FROM ledger WHERE user_id=$1`,
      [userId]
    );
    return parseInt(r.rows[0].bal || 0);
  } else {
    return ledgerMem
     .filter(l => l.userId === userId)
     .reduce((s, x) => s + (x.type === 'CREDIT'? x.amount : -x.amount), 0);
  }
}

// --- ROUTES ---

app.get('/', (req, res) => {
  res.json({
    status: 'VINOD AVJS Backend LIVE',
    mode: usePG? 'POSTGRES_REAL_LEDGER' : 'MEMORY_TEMP_LEDGER',
    message: 'Wallet is server source of truth, no fake local balance',
    time: new Date().toISOString()
  });
});

// Wallet balance
app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const bal = await getBalance(req.params.userId);
    res.json({ userId: req.params.userId, balance: bal, mode: usePG? 'PG' : 'MEM' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Earn verify - Adsterra click ke baad yahan se credit hoga
app.post('/api/earn/verify', async (req, res) => {
  try {
    const { userId = 'vinod_default', amount = 5, source = 'task' } = req.body;
    if (usePG && pool) {
      await pool.query(
        `INSERT INTO ledger (user_id, amount, type, source) VALUES ($1,$2,'CREDIT',$3)`,
        [userId, amount, source]
      );
    } else {
      ledgerMem.push({ userId, amount, type: 'CREDIT', source, time: Date.now() });
    }
    const bal = await getBalance(userId);
    res.json({ success: true, credited: amount, balance: bal });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Withdraw request - user se
app.post('/api/withdraw', async (req, res) => {
  try {
    const { userId, amount, upi } = req.body;
    if (!userId ||!amount ||!upi) return res.status(400).json({ error: 'userId, amount, upi required' });

    const bal = await getBalance(userId);
    if (bal < amount) return res.status(400).json({ error: 'Low balance', balance: bal });

    if (usePG && pool) {
      const r = await pool.query(
        `INSERT INTO withdrawals (user_id, amount, upi, status) VALUES ($1,$2,$3,'PENDING') RETURNING id`,
        [userId, amount, upi]
      );
      res.json({ status: 'PENDING_APPROVAL', id: r.rows[0].id, balance: bal });
    } else {
      const id = Date.now();
      withdrawalsMem.push({ id, userId, amount, upi, status: 'PENDING', created_at: new Date() });
      res.json({ status: 'PENDING_APPROVAL', id, balance: bal });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin - pending list
app.get('/api/admin/pending', async (req, res) => {
  if (req.headers['x-admin-secret']!== (process.env.ADMIN_SECRET || 'vinod123')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (usePG && pool) {
    const r = await pool.query(`SELECT * FROM withdrawals WHERE status='PENDING' ORDER BY created_at DESC`);
    res.json(r.rows);
  } else {
    res.json(withdrawalsMem.filter(w => w.status === 'PENDING'));
  }
});

// Admin - approve + debit + trigger payout (RazorpayX yahan lagega)
app.post('/api/admin/approve', async (req, res) => {
  if (req.headers['x-admin-secret']!== (process.env.ADMIN_SECRET || 'vinod123')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { id } = req.body;
    if (usePG && pool) {
      const w = await pool.query(`SELECT * FROM withdrawals WHERE id=$1`, [id]);
      if (!w.rows[0]) return res.status(404).json({ error: 'Withdrawal not found' });

      // Yahan RazorpayX Payout API call karna hai
      // const payout = await razorpayX.payouts.create({ account_number, amount: w.rows[0].amount*100, currency:'INR', mode:'UPI', purpose:'payout', queue_if_low_balance:true, contact, fund_account })

      await pool.query(`UPDATE withdrawals SET status='APPROVED' WHERE id=$1`, [id]);
      await pool.query(`INSERT INTO ledger (user_id, amount, type, source) VALUES ($1,$2,'DEBIT','withdrawal')`, [w.rows[0].user_id, w.rows[0].amount]);
      res.json({ success: true, message: 'Approved - Now send money via RazorpayX Payout', withdrawal: w.rows[0] });
    } else {
      const w = withdrawalsMem.find(x => String(x.id) === String(id));
      if (!w) return res.status(404).json({ error: 'Not found' });
      w.status = 'APPROVED';
      ledgerMem.push({ userId: w.userId, amount: w.amount, type: 'DEBIT', source: 'withdrawal' });
      res.json({ success: true, withdrawal: w });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Backend LIVE on ${PORT} Mode=${usePG? 'POSTGRES' : 'MEMORY'}`));
