const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const proxyCheckerPath = path.join(__dirname, 'proxyChecker.js');
const liveProxiesFile = 'live.txt';
const blacklistProxiesFile = 'blacklist.txt';
const MAX_RETRIES = 10;  // Jumlah maksimal percobaan ulang

// Jalankan proxyChecker.js di latar belakang
const proxyCheckerProcess = fork(proxyCheckerPath);

const app = express();
const port = 3000;

// Function to load live proxies from file
function loadLiveProxies() {
  if (fs.existsSync(liveProxiesFile)) {
    const proxies = JSON.parse(fs.readFileSync(liveProxiesFile, 'utf-8'));
    return proxies;
  }
  return [];
}

// Function to load blacklisted proxies from file
function loadBlacklistedProxies() {
  if (fs.existsSync(blacklistProxiesFile)) {
    const proxies = JSON.parse(fs.readFileSync(blacklistProxiesFile, 'utf-8'));
    return proxies;
  }
  return [];
}

// Function to fetch URL through proxy with retries
async function fetchUrlWithRetries(url, proxies, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    const proxyObj = proxies[Math.floor(Math.random() * proxies.length)];
    try {
      const response = await axios.get(url, {
        proxy: {
          host: proxyObj.proxy.split(':')[0],
          port: parseInt(proxyObj.proxy.split(':')[1]),
        },
        timeout: 1000,  // Perpanjang waktu timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false  // Abaikan kesalahan sertifikat
        }),
        baseURL: `${proxyObj.protocol}://${url}`
      });
      return response.data;  // Return the data if successful
    } catch (error) {
      console.error(`Attempt ${i + 1} failed with proxy ${proxyObj.protocol}://${proxyObj.proxy}:`, error.message);
      // Add problematic proxy to blacklist
      fs.appendFileSync(blacklistProxiesFile, JSON.stringify(proxyObj.proxy) + '\n');
      // Filter out problematic proxies
      proxies = proxies.filter(p => p.proxy !== proxyObj.proxy);
      if (proxies.length === 0) {
        throw new Error('No more proxies available');
      }
    }
  }
  throw new Error('All retries failed');  // Throw an error if all retries fail
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

  let liveProxies = loadLiveProxies(); // Load live proxies from file
  const blacklistedProxies = loadBlacklistedProxies(); // Load blacklisted proxies from file

  // Filter out blacklisted proxies from live proxies
  liveProxies = liveProxies.filter(proxyObj => !blacklistedProxies.includes(proxyObj.proxy));

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
