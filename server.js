const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const app = express();
app.use(cors()); app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });

pool.query(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0, is_premium BOOLEAN DEFAULT false);
CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, transaction_id TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW());`);

app.get('/api/wallet/:uid', async(req,res)=>{
  let r = await pool.query('SELECT * FROM users WHERE id=$1',[req.params.uid]);
  if(!r.rows[0]) return res.json({balance:0,total_earned:0,is_premium:false});
  res.json(r.rows[0]);
});

app.post('/api/tasks/verify-ad-secure', async(req,res)=>{
  const {userId, appId, transaction_id} = req.body;
  const tid = transaction_id || `${userId}_${appId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  let ex = await pool.query('SELECT id FROM transactions WHERE transaction_id=$1',[tid]);
  if(ex.rows.length>0) return res.json({success:false,message:'Already Done'});
  let dup = await pool.query('SELECT id FROM transactions WHERE user_id=$1 AND description=$2',[userId,`App #${appId}`]);
  if(dup.rows.length>0) return res.json({success:false,message:'Ye App Ho Gaya!'});
  let reward = appId<=60?50:appId<=130?20:5;
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId,reward]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[userId,reward,'task',`App #${appId}`,tid]);
  let b = await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  res.json({success:true,reward,newBalance:b.rows[0].balance});
});

const REWARDS = {spin:5,daily:2,quiz:5,scratch:3,survey:10,admob:2,fb:2,rigi:3,refer:50};
app.post('/api/earn/:type', async(req,res)=>{
  const type=req.params.type; const {userId}=req.body;
  if(!REWARDS[type]) return res.json({success:false,message:'Invalid'});
  let interval = type==='spin'?'1 hour':'24 hours';
  if(['admob','fb','rigi'].includes(type)) interval='2 minutes';
  let check = await pool.query(`SELECT id FROM transactions WHERE user_id=$1 AND description ILIKE $2 AND created_at > NOW() - INTERVAL '${interval}'`,[userId,`%${type}%`]);
  if(check.rows.length>0 && type!=='refer') return res.json({success:false,message:`${type} ${interval} me 1 baar milega!`});
  let reward=REWARDS[type];
  if(type==='refer') return res.json({success:true,message:`Refer Link: https://vinu-js-frontend.vercel.app?ref=${userId}`});
  let tid=`${userId}_${type}_${Date.now()}`;
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId,reward]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[userId,reward,'earning',`${type} ₹${reward}`,tid]);
  let b = await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  res.json({success:true,reward,newBalance:b.rows[0].balance});
});

app.get('/api/history/:uid', async(req,res)=>{
  let r=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.params.uid]); res.json(r.rows);
});
app.post('/api/withdraw', async(req,res)=>{
  const {userId,amount,upiId}=req.body;
  let u=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  if(!u.rows[0]||u.rows[0].balance<100) return res.json({success:false,message:'Min ₹100 chahiye'});
  await pool.query('UPDATE users SET balance=balance-$1 WHERE id=$2',[amount,userId]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId,-amount,'withdraw',`Withdraw ${amount} to ${upiId}`]);
  res.json({success:true,message:`Withdrawal ₹${amount} to ${upiId} - VINOD AVJS ENTERTAINMENT 24h me bhejega`});
});
app.post('/api/premium/verify', async(req,res)=>{
  await pool.query('UPDATE users SET is_premium=true WHERE id=$1',[req.body.userId]);
  res.json({success:true,message:'Premium Active - Ad Band!'});
});
app.get('/',(req,res)=>res.send('VINOD AVJS ENTERTAINMENT SECURE V21 LIVE - MD VINOD BAIDORIYA'));
app.listen(process.env.PORT||10000);
