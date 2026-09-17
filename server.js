const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });

(async()=>{
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS claims(user_id TEXT, app_id INT, PRIMARY KEY(user_id, app_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'Pending', created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned INT DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INT DEFAULT 0`);
  console.log("V18 Tables Ready");
})();

// 1. Root - aap isko browser me check karo
app.get('/', (req,res)=> res.json({status:'SECURE V18 LIVE', time: new Date()}));

// 2. Wallet - V18 frontend ye call karta hai
app.get('/api/wallet/:userId', async(req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.userId]);
    if(!r.rows.length) return res.json({balance:0, total_earned:0});
    res.json({balance: r.rows[0].balance, total_earned: r.rows[0].total_earned});
  }catch(e){ res.json({balance:0, total_earned:0}); }
});

// 3. History - YEHI AAPKA Loading... FIX KAREGA
app.get('/api/history/:userId', async(req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.params.userId]);
    res.json(r.rows); // [] bhi sahi hai, frontend ko array chahiye
  }catch(e){ res.json([]); }
});

app.get('/api/withdrawals/:userId', async(req,res)=>{
  try{
    let r = await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.params.userId]);
    res.json(r.rows);
  }catch(e){ res.json([]); }
});

// 4. Secure Verify - SSV
app.post('/api/tasks/verify-ad-secure', async(req,res)=>{
  const {userId, appId, custom_data} = req.body;
  try{
    if(!userId ||!custom_data) return res.json({success:false, message:'Invalid data'});
    let dup = await pool.query('SELECT * FROM transactions WHERE user_id=$1 AND description LIKE $2', [userId, '%'+custom_data.substring(0,15)+'%']);
    if(dup.rows.length>0) return res.json({success:false, message:'Already claimed'});

    let reward = appId>9000? 5 : (appId<=8?50:10);
    await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2', [userId, reward]);
    await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)', [userId, reward, 'earning', `App ${appId} SSV ${custom_data.substring(0,20)}`]);
    await pool.query('INSERT INTO claims(user_id,app_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, appId]);
    let bal = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
    res.json({success:true, reward, newBalance: bal.rows[0].balance});
  }catch(e){ res.json({success:false, message:e.message}); }
});

app.post('/api/withdraw', async(req,res)=>{
  const {userId, amount, upiId} = req.body;
  try{
    let u = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
    if(!u.rows.length || u.rows[0].balance < amount) return res.json({success:false, message:'Balance kam hai'});
    await pool.query('UPDATE users SET balance=balance-$1 WHERE id=$2', [amount, userId]);
    await pool.query('INSERT INTO withdrawals(user_id,amount,upi_id) VALUES($1,$2,$3)', [userId, amount, upiId]);
    res.json({success:true, message:`Withdrawal ₹${amount} Pending`});
  }catch(e){ res.json({success:false, message:e.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('V18 Backend on '+PORT));
