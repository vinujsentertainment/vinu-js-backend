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

// Table banao agar nahi hai
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        balance INT DEFAULT 0,
        apps TEXT[] DEFAULT '{}',
        task_done BOOLEAN DEFAULT false,
        ad_done BOOLEAN DEFAULT false
      );
    `);
    console.log("DB Table Ready");
  } catch(e){ console.log(e.message) }
})();

app.get('/', (req,res)=> res.send('VINU JS BACKEND IS LIVE - PostgreSQL Connected'));
app.get('/api/health', async (req,res)=>{
  const r = await pool.query('SELECT COUNT(*) FROM users');
  res.json({status:"ok", total_users: r.rows[0].count});
});

app.post('/api/tasks/verify-ad', async (req,res)=>{
  const { userId, appId, adWatched } = req.body;
  if(!adWatched) return res.json({success:false, message:"Ad skip"});

  try{
    let u = await pool.query('SELECT * FROM users WHERE user_id=$1',[userId]);
    if(u.rows.length==0){
      await pool.query('INSERT INTO users(user_id, balance, apps) VALUES($1,0,$2)',[userId, []]);
      u = await pool.query('SELECT * FROM users WHERE user_id=$1',[userId]);
    }
    if(u.rows[0].apps.includes(appId)) return res.json({success:false, message:"Already done"});

    const newApps = [...u.rows[0].apps, appId];
    let newBal = u.rows[0].balance + 15; // Ad dekhne par 15 Rs

    if(newApps.length==10 &&!u.rows[0].task_done){ newBal+=20; }
    if(newApps.length==100 &&!u.rows[0].ad_done){ newBal+=50; }

    await pool.query('UPDATE users SET apps=$1, balance=$2, task_done=$3, ad_done=$4 WHERE user_id=$5',
      [newApps, newBal, newApps.length>=10, newApps.length>=100, userId]);

    res.json({success:true, newBalance:newBal});
  }catch(e){ res.json({success:false, error:e.message}); }
});

app.get('/api/wallet/:id', async (req,res)=>{
  try{
    const r = await pool.query('SELECT * FROM users WHERE user_id=$1',[req.params.id]);
    if(r.rows.length==0) return res.json({balance:0, count:0});
    res.json({balance:r.rows[0].balance, count:r.rows[0].apps.length});
  }catch(e){ res.json({balance:0}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', ()=> console.log("Live "+PORT));
