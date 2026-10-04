const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>... (upar wala pura html yahan paste karo) ...`);
});

app.listen(PORT, () => console.log('Server Live on '+PORT));
