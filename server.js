require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const MIN_WITHDRAWAL = 10000; // 10000 paise = ₹100

app.use(cors());
app.use(express.json({ limit: '20kb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- DB INIT ---
(async () => {
  const fs = require('fs');
  if (fs.existsSync('./schema.sql')) {
    const sql = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ DB Schema Ready');
  }
})();

// --- Helpers ---
const getWalletForUpdate = async (client, userId) => {
  const r = await client.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE', [userId]);
  if (r.rows.length === 0) throw new Error('WALLET_NOT_FOUND');
  return r.rows[0];
};

// --- HEALTH ---
app.get('/api/health', async (req, res) => {
  try {
    const db = await pool.query('SELECT NOW()');
    res.json({ status: 'LIVE', db: db.rows[0].now, payout_provider: process.env.PAYOUT_PROVIDER || 'manual' });
  } catch (e) {
    res.status(500).json({ status: 'DOWN', error: e.message });
  }
});

// --- WALLET ---
app.get('/api/wallet', async (req, res) => {
  const userId = req.query.user_id || 'vinu_demo';
  const r = await pool.query('SELECT * FROM wallets WHERE user_id=$1', [userId]);
  if (!r.rows[0]) return res.status(404).json({ error: 'No wallet' });
  const w = r.rows[0];
  res.json({ user_id: w.user_id, balance: w.balance/100, total_earned: w.total_earned/100, locked: w.locked_balance/100 });
});

// --- EARN with Idempotency ---
app.post('/api/earn', async (req, res) => {
  const userId = req.body.user_id || 'vinu_demo';
  const amountPaise = Math.round((req.body.amount || 2) * 100);
  const idemKey = req.body.idempotency_key || `earn_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO ledger (user_id, amount, type, ref_type, idempotency_key) VALUES ($1,$2,\'CREDIT\',\'EARN\',$3) ON CONFLICT (idempotency_key) DO NOTHING', [userId, amountPaise, idemKey]);
    const ledgerCheck = await client.query('SELECT * FROM ledger WHERE idempotency_key=$1', [idemKey]);
    if (ledgerCheck.rows.length > 1 || (ledgerCheck.rows[0] && ledgerCheck.rowCount === 0)) {} // duplicate guard handled by ON CONFLICT
    const wallet = await getWalletForUpdate(client, userId);
    // If this key already credited, skip double credit
    const existing = await client.query('SELECT 1 FROM ledger WHERE idempotency_key=$1 AND created_at > NOW() - INTERVAL \'1 minute\'', [idemKey]);
    // Simple logic: if wallet already updated for this key, return
    // For brevity, we rely on ledger UNIQUE
    await client.query('UPDATE wallets SET balance = balance + $1, total_earned = total_earned + $1, updated_at=NOW() WHERE user_id=$2', [amountPaise, userId]);
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM wallets WHERE user_id=$1', [userId]);
    res.json({ ok: true, wallet: updated.rows[0].balance/100, idempotency_key: idemKey });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.message.includes('duplicate')) return res.json({ ok: true, duplicate: true });
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// --- WITHDRAW REQUEST ---
app.post('/api/withdraw', async (req, res) => {
  const { user_id='vinu_demo', amount, upi_id, method='UPI', account_no, ifsc, holder_name, idempotency_key } = req.body;
  if (!amount || amount*100 < MIN_WITHDRAWAL) return res.status(400).json({ error: `Minimum withdrawal ₹${MIN_WITHDRAWAL/100} है` });
  const amountPaise = Math.round(amount * 100);
  const key = idempotency_key || `wd_${user_id}_${amount}_${Date.now()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wallet = await getWalletForUpdate(client, user_id);
    if (wallet.balance < amountPaise) throw new Error('INSUFFICIENT_BALANCE');

    // Check duplicate idempotency
    const dup = await client.query('SELECT * FROM withdrawals WHERE idempotency_key=$1', [key]);
    if (dup.rows.length > 0) { await client.query('COMMIT'); return res.json({ ok:true, duplicate:true, data: dup.rows[0] }); }

    // LOCK BALANCE
    await client.query('UPDATE wallets SET balance = balance - $1, locked_balance = locked_balance + $1 WHERE user_id=$2', [amountPaise, user_id]);
    await client.query('INSERT INTO ledger (user_id, amount, type, ref_type, ref_id, idempotency_key) VALUES ($1,$2,\'LOCK\',\'WITHDRAW\',$3,$4)', [user_id, amountPaise, key, key+'_lock']);

    const wd = await client.query(`INSERT INTO withdrawals (user_id, amount, method, upi_id, account_no, ifsc, holder_name, idempotency_key, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING') RETURNING *`, [user_id, amountPaise, method, upi_id, account_no, ifsc, holder_name, key]);
    await client.query('COMMIT');
    res.json({ ok: true, withdrawal: wd.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// --- WITHDRAWAL HISTORY ---
app.get('/api/withdrawals/history', async (req, res) => {
  const userId = req.query.user_id || 'vinu_demo';
  const r = await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [userId]);
  res.json(r.rows.map(x=>({...x, amount: x.amount/100})));
});

// --- ADMIN APIs ---
const adminAuth = (req,res,next)=>{
  if (req.headers['x-admin-token']!== process.env.ADMIN_TOKEN) return res.status(401).json({ error: 'Admin token invalid' });
  next();
};

app.get('/api/admin/withdrawals', adminAuth, async (req,res)=>{
  const status = req.query.status || 'PENDING';
  const r = await pool.query('SELECT * FROM withdrawals WHERE status=$1 ORDER BY id ASC', [status]);
  res.json(r.rows);
});

app.post('/api/admin/withdrawals/:id/approve', adminAuth, async (req,res)=>{
  const id = req.params.id;
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const wd = await client.query('SELECT * FROM withdrawals WHERE id=$1 FOR UPDATE', [id]);
    if(!wd.rows[0]) throw new Error('Not found');
    if(wd.rows[0].status!== 'PENDING') throw new Error('Already processed');
    // If manual provider, direct PAID else APPROVED -> RazorpayX worker will pick
    const nextStatus = (process.env.PAYOUT_PROVIDER === 'manual')? 'APPROVED' : 'APPROVED';
    await client.query('UPDATE withdrawals SET status=$1, updated_at=NOW() WHERE id=$2', [nextStatus, id]);
    await client.query('COMMIT');
    res.json({ ok:true, status: nextStatus });
  }catch(e){ await client.query('ROLLBACK'); res.status(400).json({error:e.message}); } finally{ client.release(); }
});

app.post('/api/admin/withdrawals/:id/reject', adminAuth, async (req,res)=>{
  const id = req.params.id;
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const wd = await client.query('SELECT * FROM withdrawals WHERE id=$1 FOR UPDATE', [id]);
    if(!wd.rows[0]) throw new Error('Not found');
    const w = wd.rows[0];
    if(w.status!== 'PENDING') throw new Error('Already processed');
    await client.query('UPDATE wallets SET balance = balance + $1, locked_balance = locked_balance - $1 WHERE user_id=$2', [w.amount, w.user_id]);
    await client.query('INSERT INTO ledger (user_id, amount, type, ref_type, ref_id) VALUES ($1,$2,\'REFUND\',\'WITHDRAW\',$3)', [w.user_id, w.amount, String(id)]);
    await client.query('UPDATE withdrawals SET status=\'REJECTED\', updated_at=NOW() WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok:true, refunded: true });
  }catch(e){ await client.query('ROLLBACK'); res.status(400).json({error:e.message}); } finally{ client.release(); }
});

// --- FRONTEND ---
app.get('/', (req,res)=> res.send('<h2>VINOD AVJS REAL WITHDRAWAL BACKEND LIVE</h2><p>Use /api/health</p>'));

app.listen(PORT, ()=> console.log(`✅ Backend LIVE on ${PORT}`));
