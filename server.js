// server.js - Main Logic

// 1. Earn Verify (Fake click nahi chalega)
app.post('/api/earn/verify', async (req,res) => {
  const { userId, taskId, adToken } = req.body;
  // yahan Adsterra ka callback / sponsor ka verify check hoga
  // agar token sahi hai tabhi ledger me entry
  await db.query(
    `INSERT INTO ledger (user_id, amount, type, source) 
     VALUES ($1, 5, 'CREDIT', $2)`, [userId, taskId]
  );
  res.json({ success: true, newBalance: await getBalance(userId) });
});

// 2. Wallet Balance = SUM(ledger) - Server se aayega, local se nahi
app.get('/api/wallet/:userId', async (req,res) => {
  const balance = await getBalance(req.params.userId);
  res.json({ balance });
});

// 3. Withdraw Request
app.post('/api/withdraw', async (req,res) => {
  const { userId, amount, upi } = req.body;
  const balance = await getBalance(userId);
  if(balance < amount) return res.status(400).json({ error: 'Low balance' });
  
  await db.query(
    `INSERT INTO withdrawals (user_id, amount, upi, status) 
     VALUES ($1,$2,$3,'PENDING')`, [userId, amount, upi]
  );
  // user ke ledger se debit nahi hoga abhi, approval ke baad hoga
  res.json({ status: 'PENDING_APPROVAL' });
});

// 4. Admin Approval (Aapka panel)
app.post('/api/admin/approve', async (req,res) => {
  const { withdrawalId } = req.body;
  // Yahan RazorpayX Payout call hoga
  // const payout = await razorpayX.payouts.create({ amount, upi })
  // if payout success -> ledger me DEBIT entry + withdrawal APPROVED
});
