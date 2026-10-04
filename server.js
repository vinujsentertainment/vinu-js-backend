const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// DB Tables
(async()=>{
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, wallet INT DEFAULT 45, total_earned INT DEFAULT 500)`);
    await pool.query(`INSERT INTO users (id, wallet, total_earned) VALUES (1,45,500) ON CONFLICT (id) DO NOTHING`);
    console.log('DB Ready');
  }catch(e){console.log(e.message)}
})();
