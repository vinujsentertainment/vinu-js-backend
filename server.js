const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());
app.set('trust proxy', 1);

// Security: Spam rokne ke liye
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use('/api/', limiter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Database Setup ---
(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS claims (user_id TEXT, app_id INT, claimed_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, app_id))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`);
    console.log("DB READY - VINOD AVJS ENTERTAINMENT");
  } catch (e) { console.log(e.message); }
})();

// --- Config ---
const APP_REWARDS = {}; // 1 se 310 tak auto reward 2-10
for(let i=1; i<=310; i++) { APP_REWARDS[i] = i % 5 === 0? 10 : 2; }
const MIN_WITHDRAW = 100;
const DAILY_LIMIT = 50;
const ADMIN_KEY = process.env.ADMIN_KEY || "VINOD123";

// --- APIs ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.get('/api/wallet/:userId', async (req, res) => {
  const r = await pool.query('SELECT balance, total_earned FROM users WHERE id=$1', [req.params.userId]);
  if (r.rows.length == 0) {
    await pool.query('INSERT INTO users(id,balance) VALUES($1,0)', [req.params.userId]);
    return res.json({ balance: 0, total_earned: 0 });
  }
  res.json(r.rows[0]);
});

app.post('/api/tasks/verify-ad', async (req, res) => {
  const { userId, appId, adWatched } = req.body;
  if (!userId ||!appId ||!adWatched) return res.json({ success: false, message: 'Invalid Request' });
  try {
    const todayClaims = await pool.query("SELECT COUNT(*) FROM claims WHERE user_id=$1 AND claimed_at > NOW() - INTERVAL '24 hours'", [userId]);
    if (parseInt(todayClaims.rows[0].count) >= DAILY_LIMIT) return res.json({ success: false, message: 'Aaj ka 50 task limit pura ho gaya!' });

    const already = await pool.query('SELECT 1 FROM claims WHERE user_id=$1 AND app_id=$2', [userId, appId]);
    if (already.rows.length > 0) return res.json({ success: false, message: 'Already Claimed!' });

    const reward = APP_REWARDS[parseInt(appId)] || 2;
    await pool.query('INSERT INTO claims(user_id, app_id) VALUES($1,$2)', [userId, appId]);
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance = users.balance + $2, total_earned = users.total_earned + $2', [userId, reward]);
    const bal = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
    res.json({ success: true, newBalance: bal.rows[0].balance, reward });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/withdraw', async (req, res) => {
  const { userId, upiId, amount } = req.body;
  const withdrawAmount = parseInt(amount);
  if (!upiId ||!upiId.includes('@')) return res.json({ success: false, message: 'Sahi UPI ID dalo' });
  if (withdrawAmount < MIN_WITHDRAW) return res.json({ success: false, message: `Minimum ${MIN_WITHDRAW} Rs hai` });
  const user = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
  if (!user.rows.length || user.rows[0].balance < withdrawAmount) return res.json({ success: false, message: 'Balance kam hai' });
  await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [withdrawAmount, userId]);
  await pool.query('INSERT INTO withdrawals(user_id, amount, upi_id) VALUES($1,$2,$3)', [userId, withdrawAmount, upiId]);
  res.json({ success: true, message: 'Withdrawal request bhej diya, 24hr me payment hoga!' });
});

// Admin APIs
app.get('/api/admin/withdrawals', async (req, res) => {
  if (req.query.key!== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const r = await pool.query('SELECT * FROM withdrawals ORDER BY created_at DESC');
  res.json(r.rows);
});

app.post('/api/admin/update-status', async (req, res) => {
  if (req.query.key!== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { id, status } = req.body; // status = 'paid' or 'rejected'
  await pool.query('UPDATE withdrawals SET status=$1 WHERE id=$2', [status, id]);
  res.json({ success: true });
});

app.listen(process.env.PORT || 10000, () => console.log('Server Running'));
