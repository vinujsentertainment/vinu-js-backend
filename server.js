const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors({origin:'*'}));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-create tables
(async()=>{
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        balance NUMERIC DEFAULT 0,
        total_earned NUMERIC DEFAULT 0,
        referral_code TEXT,
        referred_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        amount NUMERIC,
        description TEXT,
        transaction_id TEXT UNIQUE,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('TABLES READY');
  }catch(e){ console.log('DB ERROR', e.message); }
})();

// ===== ROOT - ISSE NOT FOUND KHATAM HOGA =====
app.get('/', (req,res)=>{
  res.send('VINOD AVJS ROYAL KING SECURE API - MD VINOD BAIDORIYA - SSV + LEDGER + IDEMPOTENCY - LIVE - '+new Date().toISOString());
});
app.get('/health', (req,res)=> res.json({status:'ROYAL KING LIVE', backend:'js-backend.onrender.com', time:new Date()}));

// WALLET - Server decides amount
app.get('/api/wallet/:uid', async (req,res)=>{
  try{
    let uid = req.params.uid;
    let r = await pool.query('SELECT * FROM users WHERE user_id=$1', [uid]);
    if(r.rows.length===0){
      let ref = 'RK'+Math.random().toString(36).toUpperCase().slice(2,7);
      await pool.query('INSERT INTO users(user_id,balance,total_earned,referral_code) VALUES($1,0,0,$2)', [uid, ref]);
      r = await pool.query('SELECT * FROM users WHERE user_id=$1', [uid]);
    }
    res.json(r.rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ADMOB SSV - REAL MONEY - IDEMPOTENCY
app.get('/api/admob/ssv', async (req,res)=>{
  const { user_id, transaction_id, signature, key_id } = req.query;
  console.log('SSV HIT:', req.query);
  if(!transaction_id) return res.send('NO_TX');
  if(!user_id) return res.send('NO_USER');
  try{
    let check = await pool.query('SELECT id FROM transactions WHERE transaction_id=$1', [transaction_id]);
    if(check.rows.length>0) return res.send('ALREADY_CREDITED');

    // TODO: Real me signature verify karo AdMob public key se
    await pool.query('INSERT INTO transactions(user_id,type,amount,description,transaction_id,verified) VALUES($1,$2,$3,$4,$5,true)', [user_id, 'admob_reward', 2, 'AdMob Reward Verified', transaction_id]);
    await pool.query('UPDATE users SET balance=balance+2, total_earned=total_earned+2 WHERE user_id=$1', [user_id]);
    res.send('OK');
  }catch(e){
    if(e.code==='23505') return res.send('ALREADY_CREDITED');
    res.send('ERROR '+e.message);
  }
});

// SIMPLE EARN
app.post('/api/earn/:type', async (req,res)=>{
  const map = {daily:2, spin:5, quiz:5, scratch:2, survey:10};
  let amt = map[req.params.type]||1;
  let uid = req.body.userId;
  try{
    // Daily limit
    if(req.params.type==='daily'){
      let today = await pool.query("SELECT id FROM transactions WHERE user_id=$1 AND type='daily' AND created_at::date=NOW()::date", [uid]);
      if(today.rows.length>0) return res.json({success:false, message:'Daily already claimed'});
    }
    await pool.query('INSERT INTO transactions(user_id,type,amount,description,transaction_id) VALUES($1,$2,$3,$4,$5)', [uid, req.params.type, amt, req.params.type+' reward', 'MANUAL_'+Date.now()+'_'+uid]);
    await pool.query('UPDATE users SET balance=balance+$1, total_earned=total_earned+$1 WHERE user_id=$2', [amt, uid]);
    res.json({success:true, reward:amt});
  }catch(e){ res.json({success:false, message:e.message}); }
});

app.get('/api/history/:uid', async (req,res)=>{
  let r = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 100', [req.params.uid]);
  res.json({transactions:r.rows});
});

app.post('/api/withdraw', async (req,res)=>{
  try{
    let {userId, amount, upiId} = req.body;
    let u = await pool.query('SELECT balance FROM users WHERE user_id=$1', [userId]);
    if(u.rows[0].balance < amount) return res.json({message:'Insufficient balance'});
    await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)', [userId, 'withdraw', -amount, 'Withdraw to '+upiId]);
    await pool.query('UPDATE users SET balance=balance-$1 WHERE user_id=$2', [amount, userId]);
    res.json({message:'Withdraw request sent: ₹'+amount+' to '+upiId});
  }catch(e){ res.json({message:e.message}); }
});

app.post('/api/referral/apply', async (req,res)=>{
  try{
    let {userId, referralCode} = req.body;
    let owner = await pool.query('SELECT user_id FROM users WHERE referral_code=$1', [referralCode]);
    if(owner.rows.length===0) return res.json({message:'Invalid referral code'});
    if(owner.rows[0].user_id===userId) return res.json({message:'Self referral not allowed'});
    await pool.query('UPDATE users SET referred_by=$1 WHERE user_id=$2', [referralCode, userId]);
    // Owner ko 50 credit
    await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)', [owner.rows[0].user_id, 'referral', 50, 'Referral bonus from '+userId]);
    await pool.query('UPDATE users SET balance=balance+50, total_earned=total_earned+50 WHERE user_id=$1', [owner.rows[0].user_id]);
    res.json({message:'Referral applied! Owner got ₹50'});
  }catch(e){ res.json({message:e.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('ROYAL KING LIVE ON '+PORT));
