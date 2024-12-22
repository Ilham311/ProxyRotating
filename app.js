const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const proxyCheckerPath = path.join(__dirname, 'proxyChecker.js');
const liveProxiesFile = 'live.txt';

// Jalankan proxyChecker.js di latar belakang
const proxyCheckerProcess = fork(proxyCheckerPath);

const app = express();
const port = 3000;

// Function to load live proxies from file
function loadLiveProxies() {
  if (fs.existsSync(liveProxiesFile)) {
    const proxies = fs.readFileSync(liveProxiesFile, 'utf-8').split('\n').filter(proxy => proxy.trim() !== '');
    return proxies;
  }
  return [];
}

// Endpoint health check
app.get('/health', (req, res) => {
  res.status(200).send('Health check OK');
});

// Halaman web sederhana pada path /
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Proxy API</title>
      </head>
      <body>
        <h1>Welcome to Proxy API</h1>
        <p>Use the endpoint <code>/api?url=</code> to access URLs through a proxy.</p>
      </body>
    </html>
  `);
});

// Endpoint API untuk mengakses URL melalui proxy yang hidup
app.get('/api', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  const liveProxies = loadLiveProxies(); // Load live proxies from file
  console.log('Current live proxies:', liveProxies); // Logging tambahan untuk debug

  if (liveProxies.length === 0) {
    return res.status(503).send('No live proxies available');
  }

  // Rotate proxies
  const proxy = liveProxies[Math.floor(Math.random() * liveProxies.length)];
  console.log('Selected proxy:', proxy); // Logging tambahan untuk debug

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
    console.error('Error using proxy:', error); // Logging tambahan untuk debug
    res.status(500).send('Failed to fetch URL through proxy');
  }
});

app.listen(port, () => {
  console.log(`Proxy API listening at http://localhost:${port}`);
});
