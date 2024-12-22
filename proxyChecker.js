const axios = require('axios');
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const proxyListUrl = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt';
const liveProxiesFile = 'live.txt';

if (isMainThread) {
  // This block is executed in the main thread
  let liveProxies = [];

  // Function to start the worker
  function startWorker() {
    const worker = new Worker(__filename);
    
    worker.on('message', (message) => {
      if (message.type === 'updateProxies') {
        liveProxies = message.data;
        // Save live proxies to file
        fs.writeFileSync(liveProxiesFile, liveProxies.join('\n'));
        console.log('Live proxies updated and saved to live.txt:', liveProxies);
      }
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });
  }

  startWorker();

  module.exports = {
    getLiveProxies: () => liveProxies,
  };

} else {
  // This block is executed in the worker thread

  async function fetchProxyList() {
    try {
      const response = await axios.get(proxyListUrl);
      return response.data.split('\n').filter(proxy => proxy.trim() !== '');
    } catch (error) {
      console.error('Error fetching proxy list:', error);
      return [];
    }
  }

  async function checkProxy(proxy) {
    try {
      const response = await axios.get('http://www.google.com', {
        proxy: {
          host: proxy.split(':')[0],
          port: parseInt(proxy.split(':')[1]),
        },
        timeout: 5000,
      });

      if (response.status === 200) {
        return true;
      }
    } catch (error) {
      // Ignore errors
    }
    return false;
  }

  async function checkProxies() {
    const proxies = await fetchProxyList();
    const workingProxies = [];

    await Promise.all(proxies.map(async (proxy) => {
      const isWorking = await checkProxy(proxy);
      console.log(`Proxy ${proxy} is ${isWorking ? 'working' : 'not working'}`);
      if (isWorking) {
        workingProxies.push(proxy);
      }
    }));

    console.log('Sending updated proxies to app.js:', workingProxies);

    // Send updated proxies to the parent thread
    parentPort.postMessage({ type: 'updateProxies', data: workingProxies });
  }

  async function startChecking() {
    await checkProxies(); // Initial check
    setInterval(checkProxies, 300000); // Recheck every 5 minutes
  }

  startChecking();
}
