const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let users = {}; // userId: { balance:0, apps:[] }

 // 1. Health Check
app.get('/api/health', (req,res)=> res.json({status:"ok", online:true}));

 // 2. 9 TARAH KI EARNING KA MAIN LOGIC
app.post('/api/reward', (req,res)=>{
  const { userId, appId, earningTypes } = req.body;
  if(!userId) return res.json({success:false, error:"No userId"});
  if(!users[userId]) users[userId] = { balance:0, apps:[], taskDone:false, adDone:false };

  // Ek app ek din me ek baar
  if(users[userId].apps.includes(appId)){
    return res.json({success:false, error:"Ye app aaj ho gaya"});
  }
  users[userId].apps.push(appId);

  // LEVEL 1 - Self Earning: 2 Rs
  users[userId].balance += 2;

  // LEVEL 2 - Direct Refer (jab koi aapke link se aaye - frontend se bhejoge)
  // LEVEL 3 - Level Income (7 level - admin dega)

  // LEVEL 4 - Daily Task (10 apps pura)
  if(users[userId].apps.length >= 10 &&!users[userId].taskDone){
    users[userId].balance += earningTypes?.task || 10;
    users[userId].taskDone = true;
  }
  // LEVEL 5 - Spin (random) - frontend se
  // LEVEL 6 - Team Bonus
  // LEVEL 7 - Rank
  // LEVEL 8 - Ad Bonus
  if(users[userId].apps.length >= 100 &&!users[userId].adDone){
    users[userId].balance += earningTypes?.adBonus || 20;
    users[userId].adDone = true;
  }
  // LEVEL 9 - Royalty (Admin dega)

  res.json({success:true, newBalance: users[userId].balance, apps: users[userId].apps.length});
});

// Purane frontend ke liye /api/claim bhi support
app.post('/api/claim', (req,res)=>{
  req.body.appId = req.body.appId || req.body.app || "app1";
  req.body.earningTypes = {task:10, adBonus:20};
  // same logic call
  const { userId, appId } = req.body;
  if(!users[userId]) users[userId] = { balance:0, apps:[], taskDone:false, adDone:false };
  if(users[userId].apps.includes(appId)) return res.json({success:false});
  users[userId].apps.push(appId);
  users[userId].balance += 2;
  if(users[userId].apps.length == 10) users[userId].balance += 10;
  res.json({success:true, added:2, newBalance: users[userId].balance});
});

 // 3. Wallet
app.get('/api/wallet/:id', (req,res)=>{
  const u = users[req.params.id] || {balance:0, apps:[]};
  res.json({balance: u.balance, count: u.apps.length});
});

app.get('/', (req,res)=> res.send('VINU JS BACKEND - 9 Level LIVE'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log("Live on "+PORT));
