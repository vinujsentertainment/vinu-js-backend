const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Home
app.get('/', (req, res) => {
  res.send('<h1>VINU J S ENTERTAINMENT - Backend LIVE! 🚀</h1><p>APIs: /api/movies | /api/videos | /api/contact</p>');
});

// Movies API - Aapki Films
app.get('/api/movies', (req, res) => {
  res.json([
    { id: 1, title: "VINU J S - The Beginning", year: 2024, category: "Action" },
    { id: 2, title: "Entertainment King", year: 2025, category: "Drama" },
    { id: 3, title: "Upcoming Blockbuster 2026", year: 2026, category: "Thriller" }
  ]);
});

// Videos API
app.get('/api/videos', (req, res) => {
  res.json([
    { id: 1, title: "Official Trailer", youtubeId: "dQw4w9WgXcQ" },
    { id: 2, title: "Behind The Scenes", youtubeId: "dQw4w9WgXcQ" }
  ]);
});

// Contact API
app.post('/api/contact', (req, res) => {
  console.log(req.body);
  res.json({ success: true, message: "Message Received by VINU J S Team!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
