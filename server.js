const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Table banao
pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS claims (user_id TEXT, app_id INT, claimed_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, app_id))`);

app.get('/api/wallet/:userId', async (req, res) => {
  const { userId } = req.params;
  let r = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
  if(r.rows.length==0){
    await pool.query('INSERT INTO users(id,balance) VALUES($1,0)', [userId]);
    return res.json({balance:0});
  }
  res.json({balance: r.rows[0].balance});
});

app.post('/api/tasks/verify-ad', async (req, res) => {
  const { userId, appId, adWatched } = req.body;
  if(!adWatched) return res.json({success:false, message:'Ad nahi dekha'});

  try{
    // Check kya pehle se claim kiya hai?
    let check = await pool.query('SELECT * FROM claims WHERE user_id=$1 AND app_id=$2', [userId, appId]);
    if(check.rows.length>0){
      return res.json({success:false, message:'Already Claimed!'});
    }

    // Naya claim - Paisa do
    const reward = 2; // Har app ka 2 Rs
    await pool.query('INSERT INTO claims(user_id, app_id) VALUES($1,$2)', [userId, appId]);
    await pool.query('INSERT INTO users(id,balance) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET balance = users.balance + $2', [userId, reward]);

    let bal = await pool.query('SELECT balance FROM users WHERE id=$1', [userId]);
    res.json({success:true, newBalance: bal.rows[0].balance});
  }catch(e){
    res.json({success:false, message:'Server Error '+e.message});
  }
});

app.get('/', (req,res)=> res.send('Vinu JS Backend Running'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Running on '+PORT));
