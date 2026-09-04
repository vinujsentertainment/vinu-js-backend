const express=require('express');const cors=require('cors');const {Pool}=require('pg');
const app=express();app.use(cors());app.use(express.json());
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
async function init(){
await pool.query(`CREATE TABLE IF NOT EXISTS users(mobile TEXT PRIMARY KEY, coins INT DEFAULT 50, created_at TIMESTAMP DEFAULT NOW())`);
await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals(id SERIAL PRIMARY KEY, mobile TEXT, amount FLOAT, upi TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT NOW())`);
console.log('DB Ready - Earning + Withdrawal Tables Created');
}init();
app.get('/',(req,res)=>res.send('VINU JS EARNING LIVE - 9685187704@ybl - WITHDRAWAL FIXED'));
app.post('/api/refer',async(req,res)=>{
let {mobile}=req.body;if(!mobile)return res.json({message:'Mobile nahi'});
try{let r=await pool.query('SELECT * FROM users WHERE mobile=$1',[mobile]);if(r.rows.length==0){await pool.query('INSERT INTO users(mobile,coins) VALUES($1,50)',[mobile]);return res.json({message:'Welcome Bonus +50 Coins! 🎉',coins:50});}else return res.json({message:'Already Registered - '+r.rows[0].coins+' Coins',coins:r.rows[0].coins});}catch(e){res.json({message:'DB Error '+e.message})}
});
app.post('/api/reward/daily',async(req,res)=>{
let {mobile}=req.body;await pool.query('UPDATE users SET coins=coins+10 WHERE mobile=$1',[mobile]);res.json({message:'Daily Reward +10 Coins Added ✅'});
});
app.post('/api/reward/watch',async(req,res)=>{
let {mobile}=req.body;await pool.query('UPDATE users SET coins=coins+5 WHERE mobile=$1',[mobile]);res.json({message:'Ad Watched +5 Coins ✅'});
});
app.get('/api/wallet/:mobile',async(req,res)=>{
let r=await pool.query('SELECT coins FROM users WHERE mobile=$1',[req.params.mobile]);res.json({coins:r.rows[0]?r.rows[0].coins:0});
});
// REAL WITHDRAWAL - Ab yahi se hoga
app.post('/api/withdraw',async(req,res)=>{
let {mobile,upi,amount}=req.body;
if(!mobile||!upi)return res.json({success:false,message:'Mobile/UPI missing'});
await pool.query('INSERT INTO withdrawals(mobile,amount,upi) VALUES($1,$2,$3)',[mobile,amount,upi]);
await pool.query('UPDATE users SET coins=0 WHERE mobile=$1',[mobile]); // withdraw ke baad 0
res.json({success:true,message:`Withdrawal Request ₹${amount} Received ✅ | UPI: ${upi} | 24 ghante me 60% = ₹${(amount*0.6).toFixed(2)} aapke account me ayega | 40% MD 9685187704@ybl`});
});
app.get('/api/withdrawals',async(req,res)=>{let r=await pool.query('SELECT * FROM withdrawals ORDER BY id DESC');res.json(r.rows);});
app.listen(10000,()=>console.log('Earning Server Running WITH WITHDRAWAL'));
