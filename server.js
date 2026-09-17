app.post('/api/earn/admoney', async(req,res)=>{
  const {userId, amount, type} = req.body;
  let check = await pool.query("SELECT id FROM transactions WHERE user_id=$1 AND description LIKE $2 AND created_at > NOW() - INTERVAL '2 minutes'",[userId, `%${type}% Ad`]);
  if(check.rows.length>0) return res.json({success:false, message:'2 min baad ad dekho!'});
  await pool.query('INSERT INTO users(id,balance,total_earned) VALUES($1,$2,$2) ON CONFLICT(id) DO UPDATE SET balance=users.balance+$2, total_earned=users.total_earned+$2',[userId, amount]);
  await pool.query('INSERT INTO transactions(user_id,amount,type,description) VALUES($1,$2,$3,$4)',[userId, amount, 'earning', `${type} AdMoney ₹${amount}`]);
  let b=await pool.query('SELECT balance FROM users WHERE id=$1',[userId]); res.json({success:true, reward:amount, newBalance:b.rows[0].balance});
});
