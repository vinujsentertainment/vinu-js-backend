const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0, is_premium BOOLEAN DEFAULT false);
CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, transaction_id TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW());
`).then(()=>console.log('DB Ready - VINOD AVJS'));

// Wallet
app.get('/api/wallet/:uid', async(req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM users WHERE id=$1',[req.params.uid]);
    res.json(r.rows[0] || {balance:0,total_earned:0,is_premium:false});
  }catch(e){ res.json({balance:0,total_earned:0}); }
});

// History
app.get('/api/history/:uid', async(req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.params.uid]);
    res.json(r.rows);
  }catch(e){ res.json([]); }
});

// 300 Apps Task Verify - SECURE
app.post('/api/tasks/verify-ad-secure', async(req,res)=>{
  try{
    const {userId, appId} = req.body;
    const tid = `${userId}_${appId}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    let check = await pool.query('SELECT id FROM transactions WHERE user_id=$1 AND description=$2',[userId, `App #${appId}`]);
    if(check.rows.length>0) return res.json({success:false, message:'Ye App Pehle Ho Gaya!'});
    let reward = appId <= 60 ? 50 : appId <= 130 ? 20 : 5;
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, reward]);
    await pool.query('INSERT INTO transactions(user_id,amount,type,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[userId, reward, 'task', `App #${appId}`, tid]);
    let b = await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    res.json({success:true, reward, newBalance:b.rows[0].balance});
  }catch(e){ res.json({success:false, message:'Server waking, 20 sec baad try karo'}); }
});

// 9 Tarah Se Earning + AdMoney - FIXED (Error nahi ayega)
const REWARDS = {spin:5, daily:2, quiz:5, scratch:3, survey:10, admob:2, fb:2, rigi:3};

app.post('/api/earn/:type', async(req,res)=>{
  try{
    const type = req.params.type;
    const {userId} = req.body;
    if(!REWARDS[type]) return res.json({success:false, message:'Invalid type'});
    
    let interval = '24 hours';
    if(type === 'spin') interval = '1 hour';
    if(type === 'admob' || type === 'fb' || type === 'rigi') interval = '2 minutes';

    let check = await pool.query(`SELECT id FROM transactions WHERE user_id=$1 AND description ILIKE $2 AND created_at > NOW() - INTERVAL '${interval}'`,[userId, `%${type}%`]);
    if(check.rows.length>0) return res.json({success:false, message:`${type.toUpperCase()} ${interval} me 1 baar milega!`});

    let reward = REWARDS[type];
    let tid = `${userId}_${type}_${Date.now()}`;
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, reward]);
    await pool.query('INSERT INTO transactions(user_id,amount,type,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[userId, reward, 'earning', `${type} ₹${reward}`, tid]);
    let b = await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    res.json({success:true, reward, newBalance:b.rows[0].balance});
  }catch(e){ res.json({success:false, message:'DB waking...'}); }
});

// Refer Link
app.post('/api/earn/refer', async(req,res)=>{
  res.json({success:true, message:`Refer Link: https://vinu-js-frontend.vercel.app?ref=${req.body.userId} - Per Refer ₹50`});
});

// Withdraw - REAL SYSTEM
app.post('/api/withdraw', async(req,res)=>{
  try{
    const {userId, amount, upiId} = req.body;
    let u = await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    if(!u.rows[0] || u.rows[0].balance < 100) return res.json({success:false, message:'Min ₹100 chahiye!'});
    if(amount > u.rows[0].balance) return res.json({success:false, message:'Balance kam hai'});
    await pool.query('UPDATE users SET balance=balance-$1 WHERE id=$2',[amount,userId]);
    await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, -amount, 'withdraw', `Withdraw ₹${amount} to ${upiId}`]);
    console.log(`PAYOUT REQUEST: ${userId} -> ${upiId} -> ₹${amount}`);
    res.json({success:true, message:`✅ Withdraw Request ₹${amount} to ${upiId} - VINOD AVJS 24h me pay karega`});
  }catch(e){ res.json({success:false, message:'Withdraw error'}); }
});

// Premium
app.post('/api/premium/verify', async(req,res)=>{
  try{
    await pool.query('INSERT INTO users(id,is_premium) VALUES($1,true) ON CONFLICT(id) DO UPDATE SET is_premium=true',[req.body.userId]);
    res.json({success:true, message:'✅ Premium Active - Ad Band!'});
  }catch(e){ res.json({success:false}); }
});

app.get('/', (req,res)=> res.send('VINOD AVJS ENTERTAINMENT V22 EARNING LIVE - MD VINOD BAIDORIYA'));
app.listen(process.env.PORT||10000, ()=> console.log('Server Running V22'));
