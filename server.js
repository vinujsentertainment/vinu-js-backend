const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

let usePG=false; let pool=null;
if(process.env.DATABASE_URL){
  try{
    const {Pool}=require('pg');
    pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
    usePG=true;
    (async()=>{
      await pool.query(`CREATE TABLE IF NOT EXISTS ledger (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, type TEXT, source TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id TEXT, amount INT, upi TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMP DEFAULT NOW())`);
      console.log('PG Ready');
    })();
  }catch(e){usePG=false;}
}

let ledgerMem=[]; let withdrawalsMem=[];
async function getBalance(userId){
  if(usePG && pool){
    const r=await pool.query(`SELECT COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE -amount END),0) as bal FROM ledger WHERE user_id=$1`,[userId]);
    return parseInt(r.rows[0].bal||0);
  } else {
    return ledgerMem.filter(l=>l.userId==userId).reduce((s,x)=>s+(x.type=='CREDIT'?x.amount:-x.amount),0);
  }
}

app.get('/',(req,res)=>res.json({status:'VINOD AVJS Backend Live', mode: usePG?'POSTGRES_REAL':'MEMORY_TEMP', time: new Date()}));
app.get('/api/wallet/:userId', async (req,res)=>{ const bal=await getBalance(req.params.userId); res.json({balance:bal, mode:usePG?'PG':'MEM'}); });
app.post('/api/earn/verify', async (req,res)=>{
  const {userId='vinod_default', amount=5, source='task'}=req.body;
  if(usePG && pool){ await pool.query(`INSERT INTO ledger (user_id, amount, type, source) VALUES ($1,$2,'CREDIT',$3)`,[userId,amount,source]); }
  else { ledgerMem.push({userId, amount, type:'CREDIT', source}); }
  const bal=await getBalance(userId); res.json({success:true, balance:bal});
});
app.post('/api/withdraw', async (req,res)=>{
  const {userId, amount, upi}=req.body;
  const bal=await getBalance(userId);
  if(bal<amount) return res.status(400).json({error:'Low balance', balance:bal});
  if(usePG && pool){
    const r=await pool.query(`INSERT INTO withdrawals (user_id, amount, upi, status) VALUES ($1,$2,$3,'PENDING') RETURNING id`,[userId,amount,upi]);
    res.json({status:'PENDING_APPROVAL', id:r.rows[0].id});
  } else {
    const id=Date.now(); withdrawalsMem.push({id,userId,amount,upi,status:'PENDING'}); res.json({status:'PENDING_APPROVAL', id});
  }
});
app.get('/api/admin/pending', async (req,res)=>{
  if(req.headers['x-admin-secret']!==(process.env.ADMIN_SECRET||'vinod123')) return res.status(401).json({error:'Unauthorized'});
  if(usePG && pool){ const r=await pool.query(`SELECT * FROM withdrawals WHERE status='PENDING'`); res.json(r.rows); }
  else { res.json(withdrawalsMem.filter(w=>w.status=='PENDING')); }
});
app.post('/api/admin/approve', async (req,res)=>{
  if(req.headers['x-admin-secret']!==(process.env.ADMIN_SECRET||'vinod123')) return res.status(401).json({error:'Unauthorized'});
  const {id}=req.body;
  if(usePG && pool){
    const w=await pool.query(`SELECT * FROM withdrawals WHERE id=$1`,[id]);
    await pool.query(`UPDATE withdrawals SET status='APPROVED' WHERE id=$1`,[id]);
    await pool.query(`INSERT INTO ledger (user_id, amount, type, source) VALUES ($1,$2,'DEBIT','withdrawal')`,[w.rows[0].user_id, w.rows[0].amount]);
    res.json({success:true, withdrawal:w.rows[0]});
  } else {
    const w=withdrawalsMem.find(x=>x.id==id); w.status='APPROVED'; ledgerMem.push({userId:w.userId, amount:w.amount, type:'DEBIT'}); res.json({success:true, withdrawal:w});
  }
});
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
