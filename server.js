const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const movies = [
  { id: 1, title: "Pushpa 2 - The Rule", year: 2024, poster: "https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 2, title: "KGF Chapter 2", year: 2022, poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 3, title: "Salaar", year: 2023, poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 4, title: "RRR", year: 2022, poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963d?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 5, title: "Animal", year: 2023, poster: "https://images.unsplash.com/photo-1509343256512-d77a5cb3791b?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 6, title: "Jawan", year: 2023, poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 7, title: "Pathaan", year: 2023, poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 8, title: "Gadar 2", year: 2023, poster: "https://images.unsplash.com/photo-1533928298208-27ff66555d77?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 9, title: "Baahubali 2", year: 2017, poster: "https://images.unsplash.com/photo-1515634928627-2a4b90cb6e1e?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 10, title: "Dangal", year: 2016, poster: "https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 11, title: "3 Idiots", year: 2009, poster: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400", videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4" },
  { id: 12, title: "Sholay", year: 1975, poster: "https://images.unsplash.com/photo-1596727147705-61a532a659bd?w=400", videoUrl: "https://www.w3schools.com/html/movie.mp4" },
  { id: 13, title: "Vinu J S - The Beginning", year: 2024, poster: "https://images.unsplash.com/photo-157
