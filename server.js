app.post('/api/claim', async (req,res)=>{
  const {userId, appId} = req.body;
  if(!userId) return res.json({error:"No user"});
  // 1 app = 1 baar = Rs.2 - duplicate block
  const key = `${userId}_${appId}`;
  if(global.claimed && global.claimed.has(key)) return res.json({error:"Already claimed"});
  if(!global.claimed) global.claimed = new Set();
  global.claimed.add(key);
  
  // Yaha DB me +2 karo
  res.json({success:true, added:2, bonus: req.body.isTenth ? 10 : 0});
});
