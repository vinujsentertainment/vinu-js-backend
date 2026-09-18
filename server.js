const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

const pool = new Pool({connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});

// Services
const walletService = {
  credit: async (user_id, amount, coins, type, desc, tx_id) => {
    let check = await pool.query('SELECT id FROM wallet_transactions WHERE transaction_id=$1', [tx_id]);
    if(check.rows.length>0) return {already:true};
    await pool.query('BEGIN');
    await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,coins,description,transaction_id,verified) VALUES($1,$2,$3,$4,$5,$6,true)', [user_id,type,amount,coins,desc,tx_id]);
    await pool.query('UPDATE wallets SET balance=balance+$1, coins=coins+$2, total_earned=total_earned+$1 WHERE user_id=$3', [amount,coins,user_id]);
    await pool.query('COMMIT');
    return {success:true};
  }
};

// Routes
app.get('/', (req,res)=> res.send('VINOD AVJS ROYAL KING PRODUCTION API - LIVE - '+new Date().toISOString()));

// Content API
app.get('/api/content', async (req,res)=>{
  let r = await pool.query('SELECT * FROM content');
  if(r.rows.length==0){
    // Seed original content - Tum apna licensed content yahan dalo
    const seed = [
      {id:'c1',title:'Royal King Ki Kahani',type:'audio',category:'Motivation',thumb:'👑',coins_required:5,is_trending:true},
      {id:'c2',title:'Aron Ka Raja - Web Story',type:'video',category:'Drama',thumb:'🎬',coins_required:10,is_trending:true},
      {id:'c3',title:'Business Mindset',type:'audio',category:'Business',thumb:'💎',coins_required:5,is_trending:false}
    ];
    for(let s of seed){ await pool.query('INSERT INTO content VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', [s.id,s.title,s.type,s.category,s.thumb,s.coins_required,s.is_trending]); }
    r = await pool.query('SELECT * FROM content');
  }
  res.json(r.rows);
});

// Wallet API - Server decides balance
app.get('/api/wallet/:uid', async (req,res)=>{
  let u = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.params.uid]);
  if(u.rows.length==0){
    let code='RK'+Math.random().toString(36).toUpperCase().slice(2,6);
    await pool.query('INSERT INTO users(user_id,referral_code) VALUES($1,$2)', [req.params.uid, code]);
    await pool.query('INSERT INTO wallets(user_id,balance,coins) VALUES($1,0,100)', [req.params.uid]);
    u = await pool.query('SELECT * FROM users WHERE user_id=$1', [req.params.uid]);
  }
  let w = await pool.query('SELECT * FROM wallets WHERE user_id=$1', [req.params.uid]);
  res.json({...u.rows[0],...w.rows[0]});
});

// Earning API + AdMob SSV - Verified Event -> Ledger
app.get('/api/admob/ssv', async (req,res)=>{
  const {user_id, transaction_id} = req.query;
  if(!transaction_id) return res.status(400).send('NO_TX');
  // TODO: Real me Google public key se signature verify karo
  try{
    await walletService.credit(user_id, 2, 20, 'ad_reward', 'Rewarded Ad Verified', transaction_id);
    res.send('OK');
  }catch(e){ res.send('ALREADY_CREDITED'); }
});

app.post('/api/earn/:type', async (req,res)=>{
  const map={daily:{amt:2,coins:10}, spin:{amt:5,coins:25}, quiz:{amt:5,coins:15}};
  let rwd=map[req.params.type]; if(!rwd) return res.json({success:false});
  let uid=req.body.userId;
  // Fraud Check: Daily duplicate
  if(req.params.type=='daily'){
    let d=await pool.query("SELECT id FROM wallet_transactions WHERE user_id=$1 AND type='daily' AND created_at::date=NOW()::date",[uid]);
    if(d.rows.length>0) return res.json({success:false, message:'Daily already claimed'});
  }
  let tx='M_'+Date.now()+'_'+uid+'_'+req.params.type;
  await walletService.credit(uid, rwd.amt, rwd.coins, req.params.type, req.params.type+' reward', tx);
  res.json({success:true, reward:rwd.amt, coins:rwd.coins});
});

// Referral + Withdrawal
app.post('/api/referral/apply', async (req,res)=>{
  let {userId, referralCode}=req.body;
  let owner=await pool.query('SELECT user_id FROM users WHERE referral_code=$1',[referralCode]);
  if(owner.rows.length==0) return res.json({message:'Invalid code'});
  await pool.query('INSERT INTO referrals(referrer_id,referred_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [owner.rows[0].user_id, userId]);
  await walletService.credit(owner.rows[0].user_id, 50, 100, 'referral', 'Referral bonus', 'REF_'+userId);
  res.json({message:'Referral applied'});
});

app.post('/api/withdrawal', async (req,res)=>{
  let {userId, amount, upiId}=req.body;
  let w=await pool.query('SELECT balance FROM wallets WHERE user_id=$1',[userId]);
  if(w.rows[0].balance < amount) return res.json({message:'Insufficient balance'});
  await pool.query('INSERT INTO withdrawals(user_id,amount,upi_id) VALUES($1,$2,$3)',[userId,amount,upiId]);
  await pool.query('INSERT INTO wallet_transactions(user_id,type,amount,description,transaction_id) VALUES($1,$2,$3,$4,$5)',[userId,'withdraw',-amount,'Withdraw request','WD_'+Date.now()]);
  await pool.query('UPDATE wallets SET balance=balance-$1, total_withdrawn=total_withdrawn+$1 WHERE user_id=$2',[amount,userId]);
  res.json({message:'Withdrawal request pending admin review'});
});

app.get('/api/history/:uid', async (req,res)=>{
  let r=await pool.query('SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT 100',[req.params.uid]);
  res.json({transactions:r.rows});
});

app.listen(process.env.PORT||10000, ()=>console.log('ROYAL KING PRODUCTION LIVE'));
