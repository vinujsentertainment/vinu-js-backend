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

// AUTO MIGRATION
(async()=>{
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned INT DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INT DEFAULT 0`);
    console.log("✅ V18 FINAL FIXED");
  }catch(e){ console.log(e.message); }
})();

app.get('/', (req,res)=> res.json({status:'V18 FINAL LIVE', wallet:'fixed'}));

app.get('/api/wallet/:userId', async(req,res)=>{
  try{ let r=await pool.query('SELECT * FROM users WHERE id=$1',[req.params.userId]);
  if(!r.rows.length) return res.json({balance:0,total_earned:0});
  res.json({balance:r.rows[0].balance||0, total_earned:r.rows[0].total_earned||0});
  }catch{ res.json({balance:0,total_earned:0}); }
});
app.get('/api/history/:userId', async(req,res)=>{
  try{ let r=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.params.userId]); res.json(r.rows); }catch{ res.json([]); }
});
app.get('/api/withdrawals/:userId', async(req,res)=>{
  try{ let r=await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC',[req.params.userId]); res.json(r.rows); }catch{ res.json([]); }
});

// MAIN APP EARN - 300 Apps
app.post('/api/tasks/verify-ad-secure', async(req,res)=>{
  const {userId, appId, custom_data}=req.body;
  try{
    let dup=await pool.query('SELECT id FROM transactions WHERE user_id=$1 AND description LIKE $2',[userId, '%App '+appId+'%']);
    if(dup.rows.length>0) return res.json({success:false, message:'Already claimed - dusri App try karo!'});
    let reward=appId<=8?50: (appId<=20?20:10);
    if(appId>9000) reward=5;
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, reward]);
    await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, reward, 'earning', `App ${appId} SSV ${custom_data?.substring(0,20)||'ok'}`]);
    let bal=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    res.json({success:true, reward, newBalance:bal.rows[0].balance});
  }catch(e){ res.json({success:false, message:e.message}); }
});

// 9 TARAH SE KAMAO - 6 REAL APIs
app.post('/api/earn/spin', async(req,res)=>{
  const {userId}=req.body; let reward=Math.floor(Math.random()*5)+1;
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, reward]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, reward, 'earning', `Spin Earn ₹${reward}`]);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  res.json({success:true, reward, newBalance:b.rows[0].balance});
});
app.post('/api/earn/daily', async(req,res)=>{
  const {userId}=req.body;
  let last=await pool.query("SELECT * FROM transactions WHERE user_id=$1 AND description='Daily Bonus' AND created_at > NOW() - INTERVAL '24 hours'",[userId]);
  if(last.rows.length>0) return res.json({success:false, message:'Aaj ka bonus le liya! Kal aana'});
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,2,2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+2, total_earned=users.total_earned+2',[userId]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,2,$2,$3)',[userId, 'earning', 'Daily Bonus']);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
  res.json({success:true, reward:2, newBalance:b.rows[0].balance});
});
app.post('/api/earn/scratch', async(req,res)=>{
  let r=3; await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[req.body.userId, r]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[req.body.userId, r, 'earning', 'Scratch Card']);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[req.body.userId]); res.json({success:true, reward:r, newBalance:b.rows[0].balance});
});
app.post('/api/earn/quiz', async(req,res)=>{
  let r=5; await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[req.body.userId, r]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[req.body.userId, r, 'earning', 'Quiz Win']);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[req.body.userId]); res.json({success:true, reward:r, newBalance:b.rows[0].balance});
});
app.post('/api/earn/survey', async(req,res)=>{
  let r=10; await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[req.body.userId, r]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[req.body.userId, r, 'earning', 'Survey Complete']);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[req.body.userId]); res.json({success:true, reward:r, newBalance:b.rows[0].balance});
});
app.post('/api/earn/refer', async(req,res)=>{
  res.json({success:true, message:`Aapka Refer Link:\n${req.headers.origin}?ref=${req.body.userId}\nShare karo ₹50 milega jab dost first earn karega!`});
});

app.post('/api/withdraw', async(req,res)=>{
  const {userId, amount, upiId}=req.body;
  try{
    let u=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]);
    if(!u.rows.length || u.rows[0].balance < amount) return res.json({success:false, message:'Balance kam hai! Min ₹100'});
    await pool.query('UPDATE users SET balance=balance-$1 WHERE id=$2',[amount, userId]);
    res.json({success:true, message:`Withdrawal ₹${amount} Pending - ${upiId}`});
  }catch(e){ res.json({success:false, message:e.message}); }
});

const PORT=process.env.PORT||10000;
app.listen(PORT, ()=> console.log('V18 LIVE '+PORT));
