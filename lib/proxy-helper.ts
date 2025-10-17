// Simple proxy rotation helper
let proxyIndex = 0;

export function getNextProxy(): string | undefined {
  const proxyList = process.env.PROXY_LIST;
  
  if (!proxyList) {
    return undefined;
  }
  
  const proxies = proxyList.split(',').map(p => p.trim()).filter(Boolean);
  
  if (proxies.length === 0) {
    return undefined;
  }
  
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex++;
  
  return proxy;
}

export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
