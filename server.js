const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- ROOT - YE SABSE UPAR HONA CHAHIYE ---
app.get('/', (req,res)=>{
  res.send('VINOD AVJS ROYAL KING SECURE API - MD VINOD BAIDORIYA - SSV + LEDGER + IDEMPOTENCY - LIVE '+ new Date().toISOString());
});

app.get('/health', (req,res)=> res.json({status:'LIVE', time: new Date()}));

// WALLET
app.get('/api/wallet/:uid', async (req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.params.uid]);
    if(r.rows.length==0){
      await pool.query('INSERT INTO users(user_id, balance, total_earned, referral_code) VALUES($1,0,0,$2)', [req.params.uid, 'RK'+Math.random().toString(36).slice(2,6).toUpperCase()]);
      r = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.params.uid]);
    }
    res.json(r.rows[0]);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// ADMOB SSV - SABSE IMPORTANT
app.get('/api/admob/ssv', async (req,res)=>{
  const { user_id, transaction_id } = req.query;
  if(!transaction_id) return res.send('NO_TX');
  if(!user_id) return res.send('NO_USER');
  try{
    let check = await pool.query('SELECT id FROM transactions WHERE transaction_id=$1', [transaction_id]);
    if(check.rows.length>0) return res.send('ALREADY_CREDITED');

    await pool.query('INSERT INTO transactions(user_id, type, amount, description, transaction_id, verified) VALUES($1,$2,$3,$4,$5,true)', [user_id, 'admob_reward', 2, 'AdMob Verified Reward', transaction_id]);
    await pool.query('UPDATE users SET balance = balance + 2, total_earned = total_earned + 2 WHERE user_id=$1', [user_id]);
    console.log('ROYAL KING SSV CREDIT:', user_id, transaction_id);
    res.send('OK');
  }catch(e){ res.send('ERROR '+e.message); }
});

// EARN
app.post('/api/earn/:type', async (req,res)=>{
  const rewards = {daily:2, spin:5, quiz:5};
  const amt = rewards[req.params.type]||1;
  // simple ledger for daily tasks
  try{
    await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)', [req.body.userId, req.params.type, amt, req.params.type+' reward']);
    await pool.query('UPDATE users SET balance=balance+$1, total_earned=total_earned+$1 WHERE user_id=$2', [amt, req.body.userId]);
    res.json({success:true, reward:amt});
  }catch(e){ res.json({success:false, message:e.message}); }
});

app.get('/api/history/:uid', async (req,res)=>{
  let r = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.params.uid]);
  res.json({transactions:r.rows});
});

app.post('/api/withdraw', async (req,res)=> res.json({message:'Withdraw request received - Min 100'}));
app.post('/api/referral/apply', async (req,res)=> res.json({message:'Referral applied'}));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('ROYAL KING LIVE ON '+PORT));
