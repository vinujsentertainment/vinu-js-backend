const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

let pool = null;
try{
  if(process.env.DATABASE_URL){
    const { Pool } = require('pg');
    pool = new Pool({connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
    pool.query(`CREATE TABLE IF NOT EXISTS users(user_id TEXT PRIMARY KEY, referral_code TEXT);
    CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY, balance INT DEFAULT 0, coins INT DEFAULT 0);
    CREATE TABLE IF NOT EXISTS wallet_transactions(id SERIAL PRIMARY KEY, user_id TEXT, type TEXT, amount INT, coins INT, description TEXT, transaction_id TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW())`).then(()=>console.log('TABLES READY')).catch(e=>console.log('DB ERR',e.message));
  }
}catch(e){ console.log('DB INIT SKIP', e.message); }

app.get('/', (req,res)=> res.send('VINOD AVJS ROYAL KING PRODUCTION API - LIVE - '+new Date().toISOString()));
app.get('/api/content', (req,res)=> res.json([{id:'c1',title:'Royal King Ki Kahani',type:'audio',category:'Motivation',thumb:'👑',coins_required:5,is_trending:true}]));

app.get('/api/wallet/:uid', async (req,res)=>{
  if(!pool) return res.json({user_id:req.params.uid, balance:0, coins:100, referral_code:'RK'+req.params.uid.slice(0,4)});
  try{
    let u = await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
    if(u.rows.length==0){
      let code='RK'+Math.random().toString(36).toUpperCase().slice(2,6);
      await pool.query('INSERT INTO users(user_id,referral_code) VALUES($1,$2)',[req.params.uid,code]);
      await pool.query('INSERT INTO wallets(user_id,balance,coins) VALUES($1,0,100) ON CONFLICT DO NOTHING',[req.params.uid]);
    }
    let w = await pool.query('SELECT * FROM wallets WHERE user_id=$1',[req.params.uid]);
    let user = await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.uid]);
    res.json({...user.rows[0],...w.rows[0]});
  }catch(e){ res.json({user_id:req.params.uid, balance:0, coins:100, referral_code:'RKTEST'}); }
});

app.get('/api/admob/ssv', async (req,res)=>{
  const {user_id, transaction_id} = req.query;
  if(!transaction_id) return res.send('NO_TX');
  if(!pool) return res.send('OK_NO_DB');
  try{
    let c=await pool.query('SELECT id FROM wallet_transactions WHERE transaction_id=$1',[transaction_id]);
    if(c.rows.length>0) return res.send('ALREADY_CREDITED');
    await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,coins,description,transaction_id) VALUES($1,$2,$3,$4,$5,$6)',[user_id,'ad_reward',2,20,'Ad Verified',transaction_id]);
    await pool.query('UPDATE wallets SET balance=balance+2, coins=coins+20 WHERE user_id=$1',[user_id]);
    res.send('OK');
  }catch(e){ res.send('ALREADY_CREDITED'); }
});

app.get('/api/history/:uid', async (req,res)=>{
  if(!pool) return res.json({transactions:[]});
  let r=await pool.query('SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 50',[req.params.uid]);
  res.json({transactions:r.rows});
});

app.post('/api/earn/:type', async (req,res)=>{
  res.json({success:true, reward:2, coins:10});
});

app.listen(process.env.PORT||10000, ()=>console.log('ROYAL KING PRODUCTION LIVE ON '+(process.env.PORT||10000)));
