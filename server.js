const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

let pool;
if(process.env.DATABASE_URL){
  pool = new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  (async()=>{
    await pool.query(`CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY, balance NUMERIC DEFAULT 0, total_earned NUMERIC DEFAULT 0, referral_code TEXT, referred_by TEXT, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, type TEXT, amount NUMERIC, description TEXT, transaction_id TEXT UNIQUE, verified BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());`);
    console.log('DB READY');
  })();
}

app.get('/', (req,res)=> res.send('VINOD AVJS ROYAL KING REAL EARNING API - LIVE - '+new Date().toISOString()));
app.get('/health', (req,res)=> res.json({live:true}));

// WALLET
app.get('/api/wallet/:uid', async (req,res)=>{
  if(!pool) return res.json({user_id:req.params.uid, balance:0, total_earned:0, referral_code:'RK'+req.params.uid.slice(0,4)});
  let r = await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
  if(r.rows.length==0){
    let code='RK'+Math.random().toString(36).toUpperCase().slice(2,6);
    await pool.query('INSERT INTO users(user_id,balance,total_earned,referral_code) VALUES($1,0,0,$2)',[req.params.uid,code]);
    r = await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
  }
  res.json(r.rows[0]);
});

// REAL ADMOB SSV - Yahi real earning hai
app.get('/api/admob/ssv', async (req,res)=>{
  const {user_id, transaction_id} = req.query;
  if(!transaction_id) return res.send('NO_TX');
  if(!user_id) return res.send('NO_USER');
  if(!pool){ return res.send('OK_NO_DB'); }
  try{
    let c = await pool.query('SELECT id FROM transactions WHERE transaction_id=$1',[transaction_id]);
    if(c.rows.length>0) return res.send('ALREADY_CREDITED');
    await pool.query('INSERT INTO transactions(user_id,type,amount,description,transaction_id,verified) VALUES($1,$2,$3,$4,$5,true)',[user_id,'admob',2,'AdMob SSV Verified',transaction_id]);
    await pool.query('UPDATE users SET balance=balance+2, total_earned=total_earned+2 WHERE user_id=$1',[user_id]);
    res.send('OK');
  }catch(e){ if(e.code=='23505') return res.send('ALREADY_CREDITED'); res.send('ERR '+e.message); }
});

app.post('/api/earn/:type', async (req,res)=>{
  const map={daily:2,spin:5};
  let amt=map[req.params.type]||0;
  if(!pool) return res.json({success:true, reward:amt});
  let uid=req.body.userId;
  if(req.params.type=='daily'){
    let t=await pool.query("SELECT id FROM transactions WHERE user_id=$1 AND type='daily' AND created_at::date=NOW()::date",[uid]);
    if(t.rows.length>0) return res.json({success:false,message:'Daily already done'});
  }
  await pool.query('INSERT INTO transactions(user_id,type,amount,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[uid,req.params.type,amt,req.params.type,'M_'+Date.now()]);
  await pool.query('UPDATE users SET balance=balance+$1,total_earned=total_earned+$1 WHERE user_id=$2',[amt,uid]);
  res.json({success:true,reward:amt});
});

app.get('/api/history/:uid', async (req,res)=>{
  if(!pool) return res.json({transactions:[]});
  let r=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.params.uid]);
  res.json({transactions:r.rows});
});

app.post('/api/withdraw', async (req,res)=>{
  if(!pool) return res.json({message:'DB not connected'});
  let {userId,amount,upiId}=req.body;
  let u=await pool.query('SELECT balance FROM users WHERE user_id=$1',[userId]);
  if(u.rows[0].balance < amount) return res.json({message:'Balance kam hai'});
  await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)',[userId,'withdraw',-amount,'Withdraw '+upiId]);
  await pool.query('UPDATE users SET balance=balance-$1 WHERE user_id=$2',[amount,userId]);
  res.json({message:'Withdraw request: ₹'+amount+' to '+upiId});
});

app.post('/api/referral/apply', async (req,res)=>{
  if(!pool) return res.json({message:'DB not connected'});
  let {userId,referralCode}=req.body;
  let o=await pool.query('SELECT user_id FROM users WHERE referral_code=$1',[referralCode]);
  if(o.rows.length==0) return res.json({message:'Invalid code'});
  await pool.query('UPDATE users SET referred_by=$1 WHERE user_id=$2',[referralCode,userId]);
  await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)',[o.rows[0].user_id,'referral',50,'Referral']);
  await pool.query('UPDATE users SET balance=balance+50,total_earned=total_earned+50 WHERE user_id=$1',[o.rows[0].user_id]);
  res.json({message:'Referral applied, owner got ₹50'});
});

app.listen(process.env.PORT||10000, ()=>console.log('ROYAL KING REAL LIVE'));
