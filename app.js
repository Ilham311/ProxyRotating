const express = require('express');
const axios = require('axios');
const { fork } = require('child_process');
const path = require('path');

const proxyCheckerPath = path.join(__dirname, 'proxyChecker.js');

// Jalankan proxyChecker.js di latar belakang
const proxyCheckerProcess = fork(proxyCheckerPath);

let liveProxies = [];

proxyCheckerProcess.on('message', (message) => {
  if (message.type === 'updateProxies') {
    liveProxies = message.data;
  }
});

const app = express();
const port = 3000;

app.get('/api', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  if (liveProxies.length === 0) {
    return res.status(503).send('No live proxies available');
  }

  // Rotate proxies
  const proxy = liveProxies[Math.floor(Math.random() * liveProxies.length)];

  try {
    const response = await axios.get(url, {
      proxy: {
        host: proxy.split(':')[0],
        port: parseInt(proxy.split(':')[1]),
      },
      timeout: 5000,
    });
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Failed to fetch URL through proxy');
  }
});

app.listen(port, () => {
  console.log(`Proxy API listening at http://localhost:${port}`);
});
