const express = require('express');
const path = require('path');
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

// API Route
app.get('/api', (req,res) => res.send('Backend Live'));

// HTML Frontend Route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Vinu JS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: Arial; text-align:center; padding:50px; background:#0f0f0f; color:white; }
            h1 { color:#00ff88; }
            button { padding:12px 25px; font-size:16px; background:#00ff88; border:none; border-radius:8px; cursor:pointer; }
        </style>
    </head>
    <body>
        <h1>Vinu JS Backend 🚀</h1>
        <p>Your server is Live on Render + Neon DB Connected</p>
        <button onclick="check()">Check API Health</button>
        <p id="status"></p>
        <script>
            async function check(){
                document.getElementById('status').innerText = 'Checking...';
                const res = await fetch('/api');
                const text = await res.text();
                document.getElementById('status').innerText = text;
            }
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log('Server on ' + PORT));
