const axios = require('axios');
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const proxyListUrl = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt';
const liveProxiesFile = 'live.txt';

if (isMainThread) {
  // Jumlah worker yang akan digunakan
  const numWorkers = 5;
  let liveProxies = [];

  // Function to start the workers
  function startWorkers(proxyList) {
    const chunkSize = Math.ceil(proxyList.length / numWorkers);

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: proxyList.slice(i * chunkSize, (i + 1) * chunkSize)
      });

      worker.on('message', (message) => {
        if (message.type === 'updateProxies') {
          liveProxies = liveProxies.concat(message.data);
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
  }

  async function fetchProxyList() {
    try {
      const response = await axios.get(proxyListUrl);
      const proxyList = response.data.split('\n').filter(proxy => proxy.trim() !== '');
      startWorkers(proxyList);
    } catch (error) {
      console.error('Error fetching proxy list:', error);
    }
  }

  fetchProxyList();

} else {
  // This block is executed in the worker thread
  const proxyList = workerData;

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
    const workingProxies = [];

    await Promise.all(proxyList.map(async (proxy) => {
      const isWorking = await checkProxy(proxy);
      console.log(`Proxy ${proxy} is ${isWorking ? 'working' : 'not working'}`);
      if (isWorking) {
        workingProxies.push(proxy);
      }
    }));

    // Send updated proxies to the parent thread
    parentPort.postMessage({ type: 'updateProxies', data: workingProxies });
  }

  checkProxies();
}
