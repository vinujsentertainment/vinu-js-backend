const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async()=>{
 try{
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS claims (user_id TEXT, app_id INT, claimed_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, app_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'Pending', created_at TIMESTAMP DEFAULT NOW())`);
  console.log("VINOD AVJS DB Ready - Earning + Withdrawal + History");
 }catch(e){console.log(e.message);}
})();

app.get('/api/wallet/:userId', async (req,res)=>{
 let r=await pool.query('SELECT * FROM users WHERE id=$1',[req.params.userId]);
 if(r.rows.length==0){ await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,0,0)',[req.params.userId]); return res.json({balance:0,total_earned:0}); }
 res.json(r.rows[0]);
});
app.get('/api/history/:userId', async (req,res)=>{
 let r=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.params.userId]);
 res.json(r.rows);
});
app.get('/api/withdrawals/:userId', async (req,res)=>{
 let r=await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.params.userId]);
 res.json(r.rows);
});
app.post('/api/tasks/verify-ad', async (req,res)=>{
 const {userId, appId, adWatched, reward}=req.body;
 const finalReward=parseInt(reward)||2;
 if(!adWatched) return res.json({success:false,message:'Ad nahi dekha'});
 try{
  let c=await pool.query('SELECT * FROM claims WHERE user_id=$1 AND app_id=$2',[userId, appId]);
  if(c.rows.length>0) return res.json({success:false,message:'Already Claimed!'});
  await pool.query('INSERT INTO claims(user_id, app_id) VALUES($1,$2)',[userId, appId]);
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance = users.balance + $2, total_earned = users.total_earned + $2',[userId, finalReward]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, finalReward, 'earning', `App ${appId} - ₹${finalReward}`]);
  let bal=await pool.query('SELECT * FROM users WHERE id=$1',[userId]);
  res.json({success:true,newBalance:bal.rows[0].balance});
 }catch(e){ res.json({success:false,message:'Error '+e.message}); }
});
app.post('/api/withdraw', async (req,res)=>{
 const {userId, amount, upiId}=req.body;
 const amt=parseInt(amount);
 if(!amt || amt<100) return res.json({success:false,message:'Minimum ₹100'});
 if(!upiId) return res.json({success:false,message:'UPI ID daalo'});
 try{
  let u=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  if(u.rows.length==0 || u.rows[0].balance < amt) return res.json({success:false,message:'Balance kam hai'});
  await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2',[amt,userId]);
  await pool.query('INSERT INTO withdrawals(user_id,amount,upi_id) VALUES($1,$2,$3)',[userId,amt,upiId]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, -amt, 'withdrawal', `Withdrawal ₹${amt} to ${upiId}`]);
  let bal=await pool.query('SELECT * FROM users WHERE id=$1',[userId]);
  res.json({success:true,newBalance:bal.rows[0].balance,message:'Withdrawal Sent! 24h me ayega'});
 }catch(e){ res.json({success:false,message:e.message}); }
});
app.get('/', (req,res)=>res.send('VINOD AVJS Backend Ready'));
app.listen(process.env.PORT||10000, ()=>console.log('Running'));
