const express = require('express');

const app = express();
const port = 5000;

app.get('/connect', (req, res) => {
  res.send('Connected successfully!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});
