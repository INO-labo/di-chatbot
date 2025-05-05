const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

app.get('/drugbank', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('Query missing');

  try {
    const url = `https://go.drugbank.com/unearth/q?searcher=drugs&query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).send('Error fetching DrugBank');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
