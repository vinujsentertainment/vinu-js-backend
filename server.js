const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`
    CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY, referral_code TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY, balance INT DEFAULT 0, coins INT DEFAULT 100, referrals INT DEFAULT 0, total_earned INT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS wallet_transactions(id SERIAL PRIMARY KEY, user_id TEXT, type TEXT, amount INT, coins INT, description TEXT, transaction_id TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS withdrawals(id SERIAL PRIMARY KEY, user_id TEXT, upi TEXT, coins INT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW());
  `).then(()=>console.log('✅ ALL TABLES READY')).catch(e=>console.log('DB ERROR',e.message));
}

const getWallet = async (uid) => {
  if (!pool) return { user_id: uid, balance: 0, coins: 100, referral_code: 'RKTEST', referrals: 0 };
  let u = await pool.query('SELECT * FROM users WHERE user_id=$1', [uid]);
  if (u.rows.length === 0) {
    let code = 'RK' + Math.random().toString(36).toUpperCase().slice(2, 6);
    await pool.query('INSERT INTO users(user_id, referral_code) VALUES($1,$2)', [uid, code]);
    await pool.query('INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING', [uid]);
  }
  let w = await pool.query('SELECT * FROM wallets WHERE user_id=$1', [uid]);
  let user = await pool.query('SELECT * FROM users WHERE user_id=$1', [uid]);
  return {...user.rows[0],...w.rows[0] };
}

app.get('/', (req, res) => res.send('👑 ROYAL KING FINAL LIVE - ' + new Date().toISOString()));
app.get('/api/content', (req, res) => {
  res.json([
    { id: 'c1', title: 'Royal King Ki Kahani', type: 'audio', thumb: '👑', coins_required: 5 },
    { id: 'c2', title: 'Messenger Pro', type: 'app', thumb: '💬', coins_required: 10 },
    { id: 'c3', title: 'Fast Browser', type: 'app', thumb: '🌐', coins_required: 10 },
    { id: 'c4', title: 'TV Shows HD', type: 'app', thumb: '📺', coins_required: 10 }
  ]);
});

app.get('/api/wallet/:uid', async (req, res) => res.json(await getWallet(req.params.uid)));

app.post('/api/earn/:type', async (req, res) => {
  const { userId } = req.body;
  const type = req.params.type;
  const map = { daily: { a: 2, c: 10 }, spin: { a: 2, c: 25 }, task: { a: 1, c: 10 }, content: { a: 1, c: 5 }, ad: { a: 2, c: 20 } };
  const r = map[type] || { a: 1, c: 10 };
  try {
    if (!pool) return res.json({ success: true, reward: r.a, coins: r.c });
    if (type === 'daily') {
      let chk = await pool.query("SELECT 1 FROM wallet_transactions WHERE user_id=$1 AND type='daily' AND created_at::date = NOW()::date", [userId]);
      if (chk.rows.length) return res.json({ success: false, message: 'Aaj ka bonus le liya hai' });
    }
    let txid = `${type}_${userId}_${Date.now()}`;
    await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,coins,description,transaction_id) VALUES($1,$2,$3,$4,$5,$6)', [userId, type, r.a, r.c, type + ' reward', txid]);
    await pool.query('UPDATE wallets SET balance=balance+$1, coins=coins+$2, total_earned=total_earned+$1 WHERE user_id=$3', [r.a, r.c, userId]);
    res.json({ success: true, reward: r.a, coins: r.c });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

app.get('/api/admob/ssv', async (req, res) => {
  const { user_id, transaction_id } = req.query;
  if (!pool) return res.send('OK_NO_DB');
  let chk = await pool.query('SELECT 1 FROM wallet_transactions WHERE transaction_id=$1', [transaction_id]);
  if (chk.rows.length) return res.send('ALREADY_CREDITED');
  await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,coins,description,transaction_id) VALUES($1,$2,$3,$4,$5,$6)', [user_id, 'ad_reward', 2, 20, 'AdMob Verified', transaction_id]);
  await pool.query('UPDATE wallets SET balance=balance+2, coins=coins+20, total_earned=total_earned+2 WHERE user_id=$1', [user_id]);
  res.send('OK');
});

app.get('/api/history/:uid', async (req, res) => {
  if (!pool) return res.json({ transactions: [] });
  let r = await pool.query('SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.params.uid]);
  res.json({ transactions: r.rows });
});

app.post('/api/referral/apply', async (req, res) => {
  let { userId, referralCode } = req.body;
  if (!pool) return res.json({ message: 'DB not connected' });
  let owner = await pool.query('SELECT user_id FROM users WHERE referral_code=$1', [referralCode]);
  if (!owner.rows.length) return res.json({ message: 'Galat Referral Code' });
  if (owner.rows[0].user_id === userId) return res.json({ message: 'Apna code use nahi kar sakte' });
  await pool.query('UPDATE wallets SET coins=coins+100, balance=balance+5, referrals=referrals+1, total_earned=total_earned+5 WHERE user_id=$1', [owner.rows[0].user_id]);
  await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,coins,description,transaction_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [owner.rows[0].user_id, 'referral', 5, 100, 'Referral Bonus ' + userId, 'REF_' + userId + '_' + Date.now()]);
  res.json({ message: 'Referral Applied! Dost ko 100 Coins mile' });
});

app.post('/api/withdraw', async (req, res) => {
  let { userId, upi, coins } = req.body;
  let w = await getWallet(userId);
  if (w.coins < 200) return res.json({ success: false, message: 'Min 200 Coins chahiye' });
  if (w.referrals < 5) return res.json({ success: false, message: '5 Referral pure karo tabhi withdraw hoga - Tumhare Point 8 ke hisab se' });
  await pool.query('INSERT INTO withdrawals(user_id, upi, coins) VALUES($1,$2,$3)', [userId, upi, coins]);
  await pool.query('UPDATE wallets SET coins=coins-$1 WHERE user_id=$2', [coins, userId]);
  res.json({ success: true, message: 'Withdraw Request Bheja - 24hr me payment hoga' });
});

app.get('/api/admin/withdrawals', async (req, res) => {
  if (!pool) return res.json([]);
  let r = await pool.query('SELECT * FROM withdrawals ORDER BY id DESC');
  res.json(r.rows);
});

app.post('/api/admin/approve/:id', async (req, res) => {
  await pool.query("UPDATE withdrawals SET status='approved' WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 10000, () => console.log('ROYAL KING FINAL LIVE'));
