const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let users = {}; // userId: { balance:0, apps:[] }

app.get('/api/health', (req,res)=> res.json({status:"ok"}));

app.post('/api/reward', (req,res)=>{
  const { userId, appId, earningTypes } = req.body;
  if(!userId) return res.json({success:false, error:"no userId"});
  if(!users[userId]) users[userId] = { balance:0, apps:[], taskDone:false, adDone:false };

  if(users[userId].apps.includes(appId)){
    return res.json({success:false, error:"Ye app pehle ho chuka hai"});
  }
  users[userId].apps.push(appId);
  users[userId].balance += 2; // LEVEL 1 - Self Earning: 2 Rs

  // LEVEL 4 - Daily Task (10 apps pura)
  if(users[userId].apps.length >= 10 &&!users[userId].taskDone){
    users[userId].balance += earningTypes?.task||20;
    users[userId].taskDone = true;
  }
  // LEVEL 8 - Ad Bonus
  if(users[userId].apps.length >= 100 &&!users[userId].adDone){
    users[userId].balance += earningTypes?.adBonus||50;
    users[userId].adDone = true;
  }

  res.json({success:true, newBalance: users[userId].balance});
});

app.post('/api/claim', (req,res)=>{
  const { userId, appId, earningTypes } = req.body;
  if(!users[userId]) users[userId] = { balance:0, apps:[] };
  if(users[userId].apps.includes(appId)) return res.json({success:false});
  users[userId].apps.push(appId);
  if(users[userId].apps.length <= 10) users[userId].balance += 2;
  res.json({success:true, added:2, newBalance: users[userId].balance});
});

app.get('/api/wallet/:id', (req,res)=>{
  const u = users[req.params.id] || {balance:0, apps:[]};
  res.json({balance: u.balance, count: u.apps.length});
});

app.get('/', (req,res)=> res.send('VINU JS BACKEND IS LIVE'));

// === ADMOB REWARD - REAL EARNING ===
app.post('/api/tasks/verify-ad', (req, res) => {
  const { userId, appId, adWatched } = req.body;
  if (!adWatched) {
    return res.json({ success: false, message: "Ad nahi dekha" });
  }
  if(!users[userId]) users[userId] = { balance:0, apps:[] };
  if(users[userId].apps.includes(appId)){
    return res.json({success:false, message:"Already done"});
  }
  users[userId].apps.push(appId);
  users[userId].balance += 15; // Ad dekhne ke baad hi 15 Rs

  res.json({ success: true, message: "15 Rs credited after Ad", newBalance: users[userId].balance });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log("Live on "+PORT));
