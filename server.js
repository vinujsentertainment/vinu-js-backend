const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Home
app.get('/', (req, res) => {
  res.send('<h1>VINU J S ENTERTAINMENT - Backend Running!</h1>');
});

// Movies API - Aapki Films - FIXED
app.get('/api/movies', (req, res) => {
  res.json([
    { 
      id: 1, 
      title: "VINU J S - The Beginning", 
      year: 2024,
      poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
    },
    { 
      id: 2, 
      title: "Entertainment King", 
      year: 2025,
      poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400",
      videoUrl: "https://www.w3schools.com/html/movie.mp4"
    },
    { 
      id: 3, 
      title: "Upcoming Blockbuster 2026", 
      year: 2026,
      poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963d?w=400",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4"
    }
  ]);
});

// Videos API
app.get('/api/videos', (req, res) => {
  res.json([
    { id: 1, title: "Official Trailer", youtube: "https://youtube.com" },
    { id: 2, title: "Behind The Scenes", youtube: "https://youtube.com" }
  ]);
});

// Contact API
app.post('/api/contact', (req, res) => {
  console.log(req.body);
  res.json({ success: true, message: "Message received!" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
