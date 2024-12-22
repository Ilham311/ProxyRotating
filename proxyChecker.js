const axios = require('axios');

const proxyListUrl = 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt';
let liveProxies = [];

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

  // Parallel checking of proxies
  await Promise.all(proxies.map(async (proxy) => {
    const isWorking = await checkProxy(proxy);
    console.log(`Proxy ${proxy} is ${isWorking ? 'working' : 'not working'}`);
    if (isWorking) {
      workingProxies.push(proxy);
    }
  }));

  liveProxies = workingProxies;
  console.log('Live proxies updated:', liveProxies);
}

async function startChecking() {
  await checkProxies(); // Initial check
  setInterval(checkProxies, 300000); // Recheck every 5 minutes
}

startChecking();

module.exports = {
  getLiveProxies: () => liveProxies,
};
