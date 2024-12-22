const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const config = require('./config');

const proxyCheckerPath = path.join(__dirname, 'proxyChecker.js');
const liveProxiesFile = 'live.txt';

// Jalankan proxyChecker.js di latar belakang
const proxyCheckerProcess = fork(proxyCheckerPath);

const app = express();
const port = config.PORT;

// Function to load live proxies from file
function loadLiveProxies() {
  if (fs.existsSync(liveProxiesFile)) {
    const proxies = fs.readFileSync(liveProxiesFile, 'utf-8').split('\n').filter(proxy => proxy.trim() !== '');
    return proxies;
  }
  return [];
}

// Function to fetch URL through proxy with retries
async function fetchUrlWithRetries(url, proxies, retries = config.MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    try {
      const response = await axios.get(url, {
        proxy: {
          host: proxy.split(':')[0],
          port: parseInt(proxy.split(':')[1]),
        },
        timeout: config.TIMEOUT,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false,
        }),
      });
      return response.data;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed with proxy ${proxy}: ${error.message}`);
      proxies = proxies.filter(p => p !== proxy);
      if (proxies.length === 0) {
        throw new Error('No more proxies available');
      }
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000)); // Exponential backoff
      }
    }
  }
  throw new Error('All retries failed');
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

  let liveProxies = loadLiveProxies();

  if (liveProxies.length === 0) {
    return res.status(503).send('No live proxies available');
  }

  try {
    const data = await fetchUrlWithRetries(url, liveProxies);
    res.send(data);
  } catch (error) {
    res.status(500).send('Unable to fetch URL through proxy after multiple attempts');
  }
});

app.listen(port, () => {
  console.log(`Proxy API listening at http://localhost:${port}`);
});
