const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let users = {}; // { userId: { balance:0, team:0, direct:0, level:1 } }

// 1. Health Check
app.get('/api/health', (req,res)=> res.json({status:"Online", time:new Date()}) );

// 2. 9 TARAH KI EARNING KA MAIN LOGIC
app.post('/api/reward', (req,res)=>{
  const { userId, appId, earningTypes } = req.body;
  if(!users[userId]) users[userId] = { balance:0, team:0, apps:[] };

  // Ek app ek din me ek baar
  if(users[userId].apps.includes(appId)){
    return res.json({success:false, error:"Ye app aaj ho chuka"});
  }
  users[userId].apps.push(appId);

  // LEVEL 1 - Self Earning: 2 Rs
  users[userId].balance += 2;

  // LEVEL 2 - Direct Refer (jab koi aapke link se aaye)
  // LEVEL 3 - Level Income (7 level)
  // LEVEL 4 - Daily Task (10 apps pura)
  if(users[userId].apps.length >= 10){
    users[userId].balance += earningTypes.task; // 10 Rs bonus
  }
  // LEVEL 5 - Spin (random)
  // LEVEL 6 - Team Bonus
  // LEVEL 7 - Rank
  // LEVEL 8 - Ad Bonus
  if(users[userId].apps.length >= 100){
    users[userId].balance += earningTypes.adBonus;
  }
  // LEVEL 9 - Royalty (Admin dega)

  res.json({success:true, newBalance: users[userId].balance});
});

// 3. Wallet
app.get('/api/wallet/:id', (req,res)=>{
  const u = users[req.params.id] || {balance:0};
  res.json({balance: u.balance});
});

app.get('/', (req,res)=> res.send('VINU JS BACKEND LIVE - 9 Earning Ready'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log("Live on " + PORT));
