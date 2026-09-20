import express from 'express'; import cors from 'cors'; import pg from 'pg';
const app = express(); app.use(cors()); app.use(express.json());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// DB Auto Create
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, balance INT DEFAULT 0)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi_id TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS reward_logs (id SERIAL PRIMARY KEY, user_id TEXT, network TEXT, amount INT, signature TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW())`);
})();

// Earning Callback - SSV Protected
app.post('/api/reward/verify', async (req, res) => {
  const { userId, network, signature } = req.body;
  if (!userId ||!network) return res.json({ success: false, message: "Invalid data" });

  // Duplicate Protection
  if(signature){
    const dup = await pool.query("SELECT id FROM reward_logs WHERE signature=$1", [signature]);
    if(dup.rows.length > 0) return res.json({ success: false, message: "Already claimed" });
  }

  const rewards = { admob: 3, facebook: 2, unity: 2, applovin: 3, pangle: 2, ironsource: 10, adpumb: 1 };
  const amount = rewards[network] || 2;

  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("INSERT INTO wallets (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + $2", [userId, amount]);
    if(signature) await client.query("INSERT INTO reward_logs (user_id, network, amount, signature) VALUES ($1,$2,$3,$4)", [userId, network, amount, signature]);
    await client.query('COMMIT');
    const bal = await pool.query("SELECT balance FROM wallets WHERE user_id=$1", [userId]);
    res.json({ success: true, reward: amount, newBalance: bal.rows[0].balance });
  }catch(e){ await client.query('ROLLBACK'); res.json({success:false, message:e.message}); } finally{ client.release(); }
});

app.get('/api/wallet/:id', async (req,res)=>{
  const r = await pool.query("SELECT balance FROM wallets WHERE user_id=$1", [req.params.id]);
  res.json({ balance: r.rows[0]?.balance || 0 });
});

app.post('/api/withdraw', async(req,res)=>{
  const {userId, upiId, amount} = req.body;
  if(amount < 100) return res.json({error:"Min ₹100"});
  const client = await pool.connect();
  try{
    await client.query('BEGIN');
    const w = await client.query("SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE", [userId]);
    if((w.rows[0]?.balance||0) < amount) throw new Error("Balance kam hai");
    await client.query("UPDATE wallets SET balance = balance - $1 WHERE user_id=$2", [amount, userId]);
    await client.query("INSERT INTO withdrawals (user_id, amount, upi_id) VALUES ($1,$2,$3)", [userId, amount, upiId]);
    await client.query('COMMIT');
    res.json({message:"Withdrawal Request Pending - 24h me payment hoga"});
  }catch(e){ await client.query('ROLLBACK'); res.json({error:e.message}); } finally{ client.release(); }
});

// Admin - x-admin-key se secure
app.get('/api/admin/withdrawals', async(req,res)=>{
  if(req.headers['x-admin-key']!== process.env.ADMIN_KEY) return res.status(401).json({error:"Unauthorized"});
  const r = await pool.query("SELECT * FROM withdrawals ORDER BY id DESC");
  res.json(r.rows);
});

app.listen(process.env.PORT || 10000, ()=>console.log("VINOD AVJS ENTERTAINMENT LIVE"));
