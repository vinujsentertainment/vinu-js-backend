const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get('/', (req, res) => {
  res.send('VINU J S ENTERTAINMENT - Backend is Running Successfully! 🚀');
});

// API Route Example
app.get('/api/movies', (req, res) => {
  res.json({
    success: true,
    message: "Welcome to VINU J S ENTERTAINMENT",
    movies: []
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
