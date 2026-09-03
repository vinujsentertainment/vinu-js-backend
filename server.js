const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL Connection - Render Auto De Ga
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL? { rejectUnauthorized: false } : false
});

// Tables Banao
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        mobile VARCHAR(20) UNIQUE,
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(20),
        coins INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS earnings (
        id SERIAL PRIMARY KEY,
        user_id INT,
        type VARCHAR(20),
        coins INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("DB Ready - Earning Tables Created");
  } catch (e) { console.log("DB Error", e.message); }
}
initDB();

// Movies Data
const movies = [
  { id: 1, title: "Pushpa 2 - The Rule", year: 2024, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", isPremium: false },
  { id: 2, title: "KGF Chapter 2", year: 2022, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: false },
  { id: 3, title: "Salaar", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", isPremium: true },
  { id: 4, title: "RRR", year: 2022, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: true },
  { id: 5, title: "Animal", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", isPremium: false },
  { id: 6, title: "Jawan", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: false },
  { id: 7, title: "Pathaan", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: true },
  { id: 8, title: "Gadar 2", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: false },
  { id: 9, title: "Baahubali 2", year: 2017, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4", isPremium: false },
  { id: 10, title: "Dangal", year: 2016, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4", isPremium: false }
];

app.get('/', (req, res) => res.send('VINU JS EARNING LIVE - 9685187704@ybl'));
app.get('/api/movies', (req, res) => res.json(movies));

// 1. REFER & EARN - 50 Coins
app.post('/api/refer', async (req, res) => {
  const { mobile, referralCode } = req.body;
  try {
    const myCode = 'VINU' + Math.floor(1000 + Math.random() * 9000);
    await pool.query(`INSERT INTO users(mobile, referral_code, referred_by, coins) VALUES($1,$2,$3, $4) ON CONFLICT (mobile) DO NOTHING`, [mobile, myCode, referralCode, 0]);
    if (referralCode) {
      await pool.query(`UPDATE users SET coins = coins + 50 WHERE referral_code = $1`, [referralCode]);
      await pool.query(`UPDATE users SET coins = coins + 25 WHERE mobile = $1`, [mobile]);
    }
    res.json({ success: true, myCode, message: "Refer Success - 50 Coins Added!" });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// 2. DAILY REWARD - 10 Coins
app.post('/api/reward/daily', async (req, res) => {
  const { mobile } = req.body;
  try {
    await pool.query(`UPDATE users SET coins = coins + 10 WHERE mobile = $1`, [mobile]);
    await pool.query(`INSERT INTO earnings(user_id, type, coins) SELECT id, 'daily', 10 FROM users WHERE mobile=$1`, [mobile]);
    res.json({ success: true, coins: 10, message: "Daily 10 Coins Added!" });
  } catch (e) { res.json({ success: false }); }
});

// 3. WATCH & EARN - 5 Coins per video
app.post('/api/reward/watch', async (req, res) => {
  const { mobile, movieId } = req.body;
  try {
    await pool.query(`UPDATE users SET coins = coins + 5 WHERE mobile = $1`, [mobile]);
    res.json({ success: true, coins: 5, message: "Watch & Earn 5 Coins!" });
  } catch (e) { res.json({ success: false }); }
});

// 4. WALLET BALANCE
app.get('/api/wallet/:mobile', async (req, res) => {
  try {
    const result = await pool.query(`SELECT coins, referral_code FROM users WHERE mobile=$1`, [req.params.mobile]);
    res.json(result.rows[0] || { coins: 0, referral_code: "NEW" });
  } catch (e) { res.json({ coins: 0 }); }
});

// 5. EARNINGS REPORT FOR ADMIN (AAPKE LIYE)
app.get('/api/admin/earnings', async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*) as total_users, SUM(coins) as total_coins FROM users`);
    res.json({...result.rows[0], payoutUPI: process.env.PAYOUT_UPI || "9685187704@ybl" });
  } catch (e) { res.json({ error: e.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Earning Server Running'));
