const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// ROOT - Ye sabse pehle hona chahiye
app.get('/', (req,res)=>{
  res.status(200).send('VINOD AVJS ROYAL KING SECURE API - MD VINOD BAIDORIYA - LIVE - '+new Date().toString());
});

app.get('/health', (req,res)=> res.json({status:'LIVE'}));

app.get('/api/admob/ssv', (req,res)=>{
  if(!req.query.transaction_id) return res.send('NO_TX');
  res.send('OK - SSV WORKING - TX:'+req.query.transaction_id);
});

app.get('/api/wallet/:id', (req,res)=> res.json({user_id:req.params.id, balance:0, referral_code:'RKTEST'}));

app.use((req,res)=> res.status(404).send('Not Found - But Server is LIVE - Route: '+req.path));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('ROYAL KING LIVE ON '+PORT));
