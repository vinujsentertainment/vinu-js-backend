require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'VINOD_AVJS_ROYAL_KING_SECRET_2026';

app.use(cors({ origin: '*' }));
app.use(express.json());

// PostgreSQL - Neon / Render Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Init Tables
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      mobile VARCHAR(15) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      amount NUMERIC,
      type VARCHAR(20),
      status VARCHAR(20),
      ad_token VARCHAR(100) UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS withdrawals (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      amount NUMERIC,
      status VARCHAR(20) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("DB Ready - VINOD AVJS ROYAL KING");
}
initDB().catch(console.error);

// Auth Middleware
function auth(req,res,next){
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); } catch{ res.status(401).json({error:'Invalid token'}) }
}

// Register
app.post('/api/register', async (req,res)=>{
  try{
    const {mobile,password} = req.body;
    if(!mobile || !password) return res.status(400).json({error:'Mobile & password required'});
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await pool.query('INSERT INTO users(id,mobile,password_hash) VALUES($1,$2,$3)', [id,mobile,hash]);
    const token = jwt.sign({id, mobile}, JWT_SECRET, {expiresIn:'30d'});
    res.json({userId:id, token, message:'Registered'});
  }catch(e){ res.status(400).json({error: e.code==='23505' ? 'Mobile already registered' : e.message}) }
});

// Login
app.post('/api/login', async (req,res)=>{
  try{
    const {mobile,password} = req.body;
    const r = await pool.query('SELECT * FROM users WHERE mobile=$1', [mobile]);
    if(r.rows.length===0) return res.status(404).json({error:'User not found'});
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({error:'Wrong password'});
    const token = jwt.sign({id:user.id, mobile}, JWT_SECRET, {expiresIn:'30d'});
    res.json({userId:user.id, token, balance:user.balance});
  }catch(e){ res.status(500).json({error:e.message}) }
});

// Wallet
app.get('/api/wallet/:userId', auth, async (req,res)=>{
  const r = await pool.query('SELECT balance FROM users WHERE id=$1', [req.params.userId]);
  if(r.rows.length===0) return res.status(404).json({error:'User not found'});
  const tx = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.params.userId]);
  res.json({balance: r.rows[0].balance, transactions: tx.rows});
});

// IMPORTANT: Real Earning - Ad Verification
// Adsterra se earning tabhi credit hogi jab Adsterra ka postback / aapka admin manually verify kare
// Sirf ad kholne se paise nahi judenge - duplicate token check
app.post('/api/verify-ad', auth, async (req,res)=>{
  try{
    const {adToken, network} = req.body; // adToken Adsterra se aana chahiye
    if(!adToken) return res.status(400).json({error:'Ad token required - Real earning needs verification'});
    
    // Duplicate check - fraud rokne ke liye
    const dup = await pool.query('SELECT id FROM transactions WHERE ad_token=$1', [adToken]);
    if(dup.rows.length>0) return res.status(400).json({error:'Duplicate transaction blocked'});

    // Yahan Adsterra ka API verify karna hoga - abhi demo me Pending rakhte hain
    // Real me: const verified = await fetch(Adsterra Verify API)
    // Agar verified nahi hai to credit nahi hoga

    // For now, we create PENDING transaction - admin approve karega
    await pool.query(
      'INSERT INTO transactions(id,user_id,amount,type,status,ad_token) VALUES($1,$2,$3,$4,$5,$6)',
      [uuidv4(), req.user.id, 1, 'ad_earning', 'Pending', adToken]
    );
    res.json({message:'Ad view recorded - Pending admin verification. Credit only after real source verification.', status:'Pending'});
  }catch(e){ res.status(500).json({error:e.message}) }
});

// Withdrawal - Min Rs 100
app.post('/api/withdrawals', auth, async (req,res)=>{
  try{
    const {amount} = req.body;
    if(amount < 100) return res.status(400).json({error:'Min Rs 100 required'});
    const u = await pool.query('SELECT balance FROM users WHERE id=$1', [req.user.id]);
    if(Number(u.rows[0].balance) < amount) return res.status(400).json({error:'Insufficient balance'});
    
    await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [amount, req.user.id]);
    const w = await pool.query(
      'INSERT INTO withdrawals(id,user_id,amount) VALUES($1,$2,$3) RETURNING *',
      [uuidv4(), req.user.id, amount]
    );
    res.json({withdrawal:w.rows[0], message:'Withdrawal Pending -> Approved -> Paid. UPI verification needed for real payout.'});
  }catch(e){ res.status(500).json({error:e.message}) }
});

app.get('/api/withdrawals/:userId', auth, async (req,res)=>{
  const r = await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]);
  res.json(r.rows);
});

app.get('/', (req,res)=>res.send('VINOD AVJS ROYAL KING Backend Running - Real Earning Needs Adsterra Approval'));
app.listen(PORT, ()=>console.log(`Server running on ${PORT}`));
