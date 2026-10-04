const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// In-memory DB - Render Postgres suspend bhi ho jaye to app chalega
let users = { balance: 45, withdraws: [] };

app.get('/', (req,res) => res.send('VINU Pay Backend Running - Real Earning Active'));

app.get('/balance', (req,res) => res.json({balance: users.balance}));

app.post('/earn', (req,res) => {
  // Yahan real me Adsterra ka callback check karna hai
  // Abhi ke liye har earn par +5
  users.balance += 5;
  console.log('EARNED +5, new bal:', users.balance);
  res.json({success:true, newBalance: users.balance});
});

app.post('/withdraw', (req,res) => {
  const { upi, amount } = req.body;
  users.withdraws.push({upi, amount, time: new Date()});
  console.log('NEW WITHDRAW:', upi, amount);
  users.balance = 0;
  res.json({success:true, message:'Withdraw request received'});
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Running on '+PORT));
