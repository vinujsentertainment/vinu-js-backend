const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const movies = [
  { id: 1, title: "Pushpa 2 - The Rule", year: 2024, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 2, title: "KGF Chapter 2", year: 2022, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 3, title: "Salaar", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 4, title: "RRR", year: 2022, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 5, title: "Animal", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 6, title: "Jawan", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 7, title: "Pathaan", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 8, title: "Gadar 2", year: 2023, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 9, title: "Baahubali 2", year: 2017, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 10, title: "Dangal", year: 2016, poster: "https://i.imgur.com/8Km9tLL.jpg", videoUrl: "https://www.w3schools.com/html/movie.mp4" }
];

app.get('/', (req, res) => res.send('Vinu JS LIVE'));
app.get('/api/movies', (req, res) => res.json(movies));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Running'));
