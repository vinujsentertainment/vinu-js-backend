const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });

// Table auto create
(async()=>{
 try{
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, balance INT DEFAULT 0, total_earned INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, description TEXT, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS claims(user_id TEXT, app_id INT, PRIMARY KEY(user_id, app_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals(id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'Pending', created_at TIMESTAMP DEFAULT NOW())`);
  console.log("Tables ready - SECURE V18");
 }catch(e){console.log(e)}
})();

app.get('/', (req,res)=> res.json({status:'Vinu JS Backend SECURE V18 Running'}));

app.get('/api/wallet/:userId', async(req,res)=>{
 try{
  let r = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.userId]);
  if(r.rows.length==0) return res.json({balance:0, total_earned:0});
  res.json({balance: r.rows[0].balance, total_earned: r.rows[0].total_earned});
 }catch(e){ res.json({balance:0, total_earned:0}); }
});

app.post('/api/tasks/verify-ad-secure', async(req,res)=>{
 const {userId, appId, custom_data} = req.body;
 try{
  if(!custom_data) return res.json({success:false, message:'No custom_data'});
  let check = await pool.query('SELECT * FROM transactions WHERE description LIKE $1 AND user_id=$2', ['%'+custom_data.substring(0,20)+'%', userId]);
  if(check.rows.length>0) return res.json({success:false, message:'Already claimed'});

  let reward = (appId <= 8)? 50 : (appId <= 20)? 15 : 10;
  if(appId>9000) reward = 5; // Spin, Daily etc

  await pool.query('INSERT INTO claims(user_id, app_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [userId, appId]);
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance = users.balance + $2, total_earned = users.total_earned + $2', [userId, reward]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)', [userId, reward, 'earning', `App ${appId} ₹${reward} txn:${custom_data.substring(0,20)}`]);

  let bal = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
  res.json({success:true, reward, transaction_id: custom_data.substring(0,20), newBalance: bal.rows[0].balance});
 }catch(e){ res.json({success:false, message:e.message}); }
});

app.get('/api/history/:userId', async(req,res)=>{
 let r = await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.params.userId]);
 res.json(r.rows);
});

app.post('/api/withdraw', async(req,res)=>{
 const {userId, amount, upiId} = req.body;
 try{
  let u = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
  if(!u.rows.length || u.rows[0].balance < amount) return res.json({success:false, message:'Balance kam hai'});
  await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [amount, userId]);
  await pool.query('INSERT INTO withdrawals(user_id,amount,upi_id,status) VALUES($1,$2,$3,$4)', [userId, amount, upiId, 'Pending']);
  res.json({success:true, message:`Withdrawal ₹${amount} Pending! Admin check karega`});
 }catch(e){ res.json({success:false, message:e.message}); }
});

app.get('/api/withdrawals/:userId', async(req,res)=>{
 let r = await pool.query('SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY id DESC', [req.params.userId]);
 res.json(r.rows);
});

app.listen(process.env.PORT||10000, ()=> console.log('SECURE V18 Backend Running'));
