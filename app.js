const express = require('express');
const axios = require('axios');
const path = require('path');
const { fork } = require('child_process');

const proxyCheckerPath = path.join(__dirname, 'proxyChecker.js');
const MAX_RETRIES = 5;  // Jumlah maksimal percobaan ulang

// Jalankan proxyChecker.js di latar belakang
const proxyCheckerProcess = fork(proxyCheckerPath);

let liveProxies = [];
let blacklistProxies = [];

// Function to load live proxies from proxyChecker.js
proxyCheckerProcess.on('message', (message) => {
  if (message.type === 'updateProxies') {
    liveProxies = message.data;
    console.log('Live proxies updated in app.js:', liveProxies);
  }
});

// Function to fetch URL through proxy with retries
async function fetchUrlWithRetries(url, proxies, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    const proxyObj = proxies[Math.floor(Math.random() * proxies.length)];
    if (blacklistProxies.includes(proxyObj)) {
      continue;  // Skip blacklisted proxies
    }

    try {
      const response = await axios.get(url, {
        proxy: {
          host: proxyObj.split(':')[0],
          port: parseInt(proxyObj.split(':')[1]),
        },
        timeout: 10000,  // Perpanjang waktu timeout
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false  // Abaikan kesalahan sertifikat
        })
      });
      return response.data;  // Return the data if successful
    } catch (error) {
      console.error(`Attempt ${i + 1} failed with proxy ${proxyObj}:`, error.message);
      // Add problematic proxy to blacklist
      blacklistProxies.push(proxyObj);
    }
  }
  throw new Error('All retries failed');  // Throw an error if all retries fail
}

// Inisialisasi aplikasi Express
const app = express();
const port = 3000;

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

  // Filter out blacklisted proxies from live proxies
  const validProxies = liveProxies.filter(proxy => !blacklistProxies.includes(proxy));

  if (validProxies.length === 0) {
    return res.status(503).send('No live proxies available');
  }

  try {
    const data = await fetchUrlWithRetries(url, validProxies);
    res.send(data);
  } catch (error) {
    res.status(500).send('Unable to fetch URL through proxy after multiple attempts');
  }
});

app.listen(port, () => {
  console.log(`Proxy API listening at http://localhost:${port}`);
});
