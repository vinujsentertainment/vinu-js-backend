<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VINOD AVJS - REAL EARNING LIVE</title>
<script>
// IMPORTANT: Backend URL
const BACKEND_URL = "https://vinu-js-backend.onrender.com";
// Adsterra Direct Link - Real Earning
const ADSTERRA_DIRECT = "https://www.profitableratecpmnetwork.com/fjqx7bku6?key=aafc520549b009c41172af26f14180a3";
</script>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui, -apple-system, Segoe UI, Roboto;background:#f5f0ff;color:#2d0066}
.header{background:linear-gradient(90deg,#6a00ff,#9d00ff);color:#fff;padding:16px;text-align:center;font-weight:800;letter-spacing:.5px}
.wallet{margin:14px;background:#fff;border-radius:18px;padding:16px;box-shadow:0 8px 20px rgba(106,0,255,.15)}
.task-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px}
.task{background:linear-gradient(135deg,#6a00ff,#8a2eff);color:#fff;border:none;border-radius:14px;padding:18px 10px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(106,0,255,.3)}
.task:disabled{opacity:.5}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #d8c6ff;outline:none}
.btn-green{width:100%;margin-top:10px;background:#00c853;color:#fff;padding:14px;border:none;border-radius:12px;font-weight:800;cursor:pointer}
.small{font-size:12px;color:#666;text-align:center;margin:8px}
</style>
</head>
<body>
<div class="header">VINOD PAY - REAL EARNING LIVE</div>

<div class="wallet">
<div style="font-size:12px;opacity:.7">Available Balance</div>
<h2 id="bal" style="margin:6px 0">₹ 0.00</h2>
<input id="userId" placeholder="Your ID likho - e.g. vinod123" value="vinod_default">
<button onclick="loadWallet()" style="margin-top:8px;padding:8px 14px;border-radius:8px;border:none;background:#6a00ff;color:#fff;font-weight:bold">Load Wallet</button>
<div id="mode" class="small"></div>
</div>

<div class="task-grid">
<button class="task" onclick="doEarn(this,'whatsapp')">Whatsapp<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'facebook')">Facebook<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'instagram')">Instagram<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'youtube')">YouTube<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'phonepe')">PhonePe<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'paytm')">Paytm<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'amazon')">Amazon<br>Earn ₹5</button>
<button class="task" onclick="doEarn(this,'flipkart')">Flipkart<br>Earn ₹5</button>
</div>

<div class="wallet">
<h3 style="margin:0 0 10px 0">Withdraw (Real)</h3>
<input id="upi" placeholder="UPI ID - e.g. 9685187704@ybl">
<input id="amt" type="number" placeholder="Amount (Min 100)" style="margin-top:8px">
<button class="btn-green" onclick="withdraw()">Withdraw Request</button>
<p id="msg" class="small"></p>
</div>

<p class="small">Har task pe Ad khulega - Adsterra se real earning hogi. Fake auto-credit nahi.</p>

<script>
async function loadWallet(){
  const uid = document.getElementById('userId').value.trim();
  if(!uid) return alert('ID likho');
  try{
    const r = await fetch(`${BACKEND_URL}/api/wallet/${uid}`);
    const j = await r.json();
    document.getElementById('bal').innerText = `₹ ${j.balance}.00`;
    document.getElementById('mode').innerText = `Mode: ${j.mode} | Server is source of truth`;
  }catch(e){
    document.getElementById('bal').innerText = 'Backend Starting... 50 sec wait (Render free)';
  }
}

async function doEarn(btn, source){
  const uid = document.getElementById('userId').value.trim();
  if(!uid) return alert('Pehle ID likho');
  btn.disabled = true;
  btn.innerText = 'Opening Ad...';

  // 1. Real earning ke liye Ad open
  window.open(ADSTERRA_DIRECT, '_blank');

  // 2. 3 sec baad backend me credit verify
  setTimeout(async()=>{
    try{
      const r = await fetch(`${BACKEND_URL}/api/earn/verify`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId: uid, amount: 5, source })
      });
      const j = await r.json();
      document.getElementById('bal').innerText = `₹ ${j.balance}.00`;
      alert(`✅ ₹5 Credited from ${source}! New Balance: ₹${j.balance}`);
    }catch(e){
      alert('Backend sleep mode me hai, 50 sec baad fir try karo (Render free)');
    }
    btn.disabled = false;
    btn.innerHTML = `${source}<br>Earn ₹5`;
  }, 3000);
}

async function withdraw(){
  const uid = document.getElementById('userId').value.trim();
  const upi = document.getElementById('upi').value.trim();
  const amount = parseInt(document.getElementById('amt').value);
  if(!upi ||!amount) return alert('UPI aur Amount likho');
  if(amount < 100) return alert('Min 100 hai');
  try{
    const r = await fetch(`${BACKEND_URL}/api/withdraw`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userId: uid, amount, upi })
    });
    const j = await r.json();
    document.getElementById('msg').innerText = JSON.stringify(j);
    if(j.status === 'PENDING_APPROVAL'){
      alert('✅ Withdraw PENDING - Admin approve karega, fir RazorpayX se UPI pe jayega');
    } else {
      alert(JSON.stringify(j));
    }
    loadWallet();
  }catch(e){
    alert('Error: '+e.message);
  }
}

loadWallet();
</script>
</body>
</html>
