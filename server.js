const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');
const app = express();
app.use(cors()); app.use(express.json()); app.use(express.static(__dirname));
app.set('trust proxy', 1);
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 40 }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS claims (user_id TEXT, app_id INT, claimed_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, app_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`);
})();
const ADMIN_KEY = process.env.ADMIN_KEY || "VINOD123";
app.get('/api/wallet/:userId', async (req,res)=>{
  const r=await pool.query('SELECT balance FROM users WHERE id=$1',[req.params.userId]);
  if(!r.rows.length){ await pool.query('INSERT INTO users(id,balance) VALUES($1,0)',[req.params.userId]); return res.json({balance:0});}
  res.json(r.rows[0]);
});
app.post('/api/tasks/verify-ad', async (req,res)=>{
  const {userId, appId, adWatched} = req.body;
  if(!adWatched) return res.json({success:false});
  try{
    const already=await pool.query('SELECT 1 FROM claims WHERE user_id=$1 AND app_id=$2',[userId, appId]);
    if(already.rows.length) return res.json({success:false, message:'Already claimed'});
    const reward = parseInt(appId) % 5 === 0? 10 : 2;
    await pool.query('INSERT INTO claims(user_id, app_id) VALUES($1,$2)',[userId, appId]);
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, reward]);
    const bal=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    res.json({success:true, newBalance: bal.rows[0].balance});
  }catch(e){ res.json({success:false, message:e.message}); }
});
app.post('/api/withdraw', async (req,res)=>{
  const {userId, upiId, amount}=req.body;
  if(!upiId.includes('@')) return res.json({success:false, message:'Sahi UPI dalo'});
  const user=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  if(!user.rows.length || user.rows[0].balance < amount) return res.json({success:false, message:'Balance kam hai'});
  await pool.query('UPDATE users SET balance=balance-$1 WHERE id=$2',[amount, userId]);
  await pool.query('INSERT INTO withdrawals(user_id, amount, upi_id) VALUES($1,$2,$3)',[userId, amount, upiId]);
  res.json({success:true, message:'Request Sent!'});
});
app.get('/api/admin/withdrawals', async (req,res)=>{
  if(req.query.key!==ADMIN_KEY) return res.status(401).json({error:'Unauthorized'});
  const r=await pool.query('SELECT * FROM withdrawals ORDER BY id DESC'); res.json(r.rows);
});
app.post('/api/admin/update-status', async (req,res)=>{
  if(req.query.key!==ADMIN_KEY) return res.status(401).json({error:'Unauthorized'});
  await pool.query('UPDATE withdrawals SET status=$1 WHERE id=$2',[req.body.status, req.body.id]); res.json({success:true});
});
app.listen(process.env.PORT || 10000);
