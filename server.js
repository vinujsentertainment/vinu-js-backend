const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

const pool = process.env.DATABASE_URL? new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}}) : null;
if(pool){
  (async()=>{
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY, balance INT DEFAULT 0, coins INT DEFAULT 0, total_earned INT DEFAULT 0, referral_code TEXT, referred_by TEXT, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS transactions(id SERIAL PRIMARY KEY, user_id TEXT, type TEXT, amount INT, coins INT, description TEXT, transaction_id TEXT UNIQUE, verified BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS user_library(user_id TEXT, story_id TEXT, liked BOOLEAN DEFAULT false, saved BOOLEAN DEFAULT false, progress INT DEFAULT 0, PRIMARY KEY(user_id, story_id));
    `);
    console.log('ROYAL KING TABLES READY');
  })();
}

// DUMMY ORIGINAL STORIES - Tum apna licensed content yahan daalna
const STORIES = [
  {id:'s1', title:'Royal King Ki Kahani', type:'audio', category:'Motivation', duration:'12:05', thumb:'👑', episodes:12, coins:5, trending:true},
  {id:'s2', title:'Aron Ka Raja', type:'video', category:'Drama', duration:'8:32', thumb:'🎬', episodes:8, coins:10, trending:true},
  {id:'s3', title:'Madhya Pradesh Ke Rahasya', type:'audio', category:'History', duration:'15:20', thumb:'🏰', episodes:20, coins:5, new:true},
  {id:'s4', title:'Shorts - Motivation Reels', type:'short', category:'Shorts', duration:'0:45', thumb:'🔥', episodes:50, coins:2, trending:true},
  {id:'s5', title:'Business Mindset', type:'audio', category:'Business', duration:'10:10', thumb:'💎', episodes:15, coins:5, popular:true},
  {id:'s6', title:'Bhakti Kahaniya', type:'audio', category:'Bhakti', duration:'18:00', thumb:'🙏', episodes:25, coins:5, popular:true},
];

app.get('/', (req,res)=> res.send('VINOD AVJS ROYAL KING - STORY/VIDEO ORIGINAL API - LIVE '+new Date().toISOString()));
app.get('/api/stories', (req,res)=> res.json(STORIES));
app.get('/api/trending', (req,res)=> res.json(STORIES.filter(s=>s.trending)));
app.get('/api/wallet/:uid', async (req,res)=>{
  if(!pool) return res.json({user_id:req.params.uid, balance:0, coins:0, referral_code:'RK'+req.params.uid.slice(0,4)});
  let r=await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
  if(r.rows.length==0){
    let code='RK'+Math.random().toString(36).toUpperCase().slice(2,6);
    await pool.query('INSERT INTO users(user_id,balance,coins,total_earned,referral_code) VALUES($1,0,100,0,$2)',[req.params.uid,code]);
    r=await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
  }
  res.json(r.rows[0]);
});

// REAL EARNING - ADMOB SSV - Server hi coin dega
app.get('/api/admob/ssv', async (req,res)=>{
  const {user_id, transaction_id} = req.query;
  if(!transaction_id) return res.send('NO_TX');
  if(!pool) return res.send('OK_NO_DB');
  try{
    let c=await pool.query('SELECT id FROM transactions WHERE transaction_id=$1',[transaction_id]);
    if(c.rows.length>0) return res.send('ALREADY_CREDITED');
    await pool.query('INSERT INTO transactions(user_id,type,amount,coins,description,transaction_id,verified) VALUES($1,$2,$3,$4,$5,$6,true)',[user_id,'ad_reward',2,20,'Rewarded Ad Verified',transaction_id]);
    await pool.query('UPDATE users SET balance=balance+2, coins=coins+20, total_earned=total_earned+2 WHERE user_id=$1',[user_id]);
    res.send('OK');
  }catch(e){ res.send('ALREADY_CREDITED'); }
});

app.post('/api/earn/:type', async (req,res)=>{
  const rewards={daily:{amt:2,coins:10}, spin:{amt:5,coins:25}};
  let rwd=rewards[req.params.type]; if(!rwd) return res.json({success:false});
  if(!pool) return res.json({success:true, reward:rwd.amt, coins:rwd.coins});
  let uid=req.body.userId;
  if(req.params.type=='daily'){
    let t=await pool.query("SELECT id FROM transactions WHERE user_id=$1 AND type='daily' AND created_at::date=NOW()::date",[uid]);
    if(t.rows.length>0) return res.json({success:false, message:'Daily done'});
  }
  await pool.query('INSERT INTO transactions(user_id,type,amount,coins,description,transaction_id) VALUES($1,$2,$3,$4,$5,$6)',[uid,req.params.type,rwd.amt,rwd.coins,req.params.type,'M_'+Date.now()]);
  await pool.query('UPDATE users SET balance=balance+$1, coins=coins+$2, total_earned=total_earned+$1 WHERE user_id=$3',[rwd.amt,rwd.coins,uid]);
  res.json({success:true, reward:rwd.amt, coins:rwd.coins});
});

app.get('/api/history/:uid', async (req,res)=>{
  if(!pool) return res.json({transactions:[]});
  let r=await pool.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.params.uid]);
  res.json({transactions:r.rows});
});

app.post('/api/withdraw', async (req,res)=>{
  let {userId, amount, upiId}=req.body;
  if(!pool) return res.json({message:'DB not connected'});
  let u=await pool.query('SELECT balance FROM users WHERE user_id=$1',[userId]);
  if(u.rows[0].balance < amount) return res.json({message:'Min ₹100 needed'});
  await pool.query('INSERT INTO transactions(user_id,type,amount,description) VALUES($1,$2,$3,$4)',[userId,'withdraw',-amount,'Withdraw to '+upiId]);
  await pool.query('UPDATE users SET balance=balance-$1 WHERE user_id=$2',[amount,userId]);
  res.json({message:'Withdraw request: ₹'+amount});
});

app.post('/api/referral/apply', async (req,res)=>{
  let {userId, referralCode}=req.body;
  if(!pool) return res.json({message:'Applied'});
  let o=await pool.query('SELECT user_id FROM users WHERE referral_code=$1',[referralCode]);
  if(o.rows.length==0) return res.json({message:'Invalid code'});
  await pool.query('UPDATE users SET referred_by=$1 WHERE user_id=$2',[referralCode,userId]);
  await pool.query('INSERT INTO transactions(user_id,type,amount,coins,description) VALUES($1,$2,$3,$4,$5)',[o.rows[0].user_id,'referral',50,100,'Referral bonus']);
  await pool.query('UPDATE users SET balance=balance+50, coins=coins+100 WHERE user_id=$1',[o.rows[0].user_id]);
  res.json({message:'Referral applied - owner got ₹50 + 100 coins'});
});

app.listen(process.env.PORT||10000, ()=>console.log('ROYAL KING STORY APP LIVE'));
