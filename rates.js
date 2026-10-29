/* Provider fetching and a bounded, provider-specific cache. */
(function (root) {
  'use strict';
  const CACHE_KEY = 'quickcurrency_rates_v2';
  function create({ fetch: fetcher, storage, now = Date.now, timeout = 4500 }) {
    const inFlight = new Map();
    const cache = {};
    let loaded;
    let writes = Promise.resolve();
    async function load() {
      loaded ??= storage.get(CACHE_KEY).then(data => Object.assign(cache, data[CACHE_KEY] || {}));
      await loaded;
    }
    async function persist() {
      const newest = Object.entries(cache).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, 100);
      for (const key of Object.keys(cache)) delete cache[key];
      Object.assign(cache, Object.fromEntries(newest));
      const snapshot = structuredClone(cache);
      writes = writes.catch(() => {}).then(() => storage.set({ [CACHE_KEY]: snapshot }));
      await writes;
    }
    async function json(url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Provider unavailable');
        return await response.json();
      } finally { clearTimeout(timer); }
    }
    function checked(rate, date, provider) {
      const timestamp = Date.parse(date);
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 ||
          !Number.isFinite(timestamp) || timestamp > now() + 86400000 || now() - timestamp > 7 * 86400000) {
        throw new Error('Provider returned an invalid or outdated rate');
      }
      return { rate, date, provider, fetchedAt: now() };
    }
    async function request(from, to, settings) {
      if (settings.useProxy) {
        const url = new URL(settings.proxyURL.replaceAll('{FROM}', from).replaceAll('{TO}', to).replaceAll('{AMOUNT}', '1'));
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid proxy URL');
        const data = await json(url.href);
        // Custom proxy responses may omit their source date. They are cached briefly.
        return checked(data.result, data.date || new Date(now()).toISOString().slice(0, 10), 'proxy');
      }
      try {
        const data = await json(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);
        if (data.base?.toUpperCase() !== from || data.quote?.toUpperCase() !== to) throw new Error('Currency mismatch');
        return checked(data.rate, data.date, 'frankfurter');
      } catch {
        const data = await json(`https://open.er-api.com/v6/latest/${from}`);
        if (data.result !== 'success' || data.base_code !== from) throw new Error('No exchange rate available');
        return checked(data.rates?.[to], new Date(data.time_last_update_unix * 1000).toISOString(), 'exchangerate-api');
      }
    }
    async function convert({ from, to, amount, settings = {}, refresh = false }) {
      if (!root.QC.isCurrency(from) || !root.QC.isCurrency(to) || typeof amount !== 'number' ||
          !Number.isFinite(amount) || Math.abs(amount) > 1e15) throw new Error('Enter a valid amount and currency');
      from = from.toUpperCase(); to = to.toUpperCase();
      if (from === to || amount === 0) return { result: amount, rate: 1, provider: 'identity', cached: false };
      await load();
      const key = `${settings.useProxy ? settings.proxyURL : 'public-v2'}|${from}:${to}`;
      const ttl = Math.min(60, Math.max(5, Number(settings.cacheTTL) || 15)) * 60000;
      const entry = cache[key];
      if (!refresh && entry && typeof entry.rate === 'number' && Number.isFinite(entry.rate) && entry.rate > 0 &&
          now() >= entry.fetchedAt && now() - entry.fetchedAt < ttl &&
          now() - Date.parse(entry.date) <= 7 * 86400000) return { ...entry, result: entry.rate * amount, cached: true };
      if (!inFlight.has(key)) {
        // All amounts for the same pair share a single rate request.
        if (inFlight.size >= 8) throw new Error('Please wait for the current conversions');
        const promise = request(from, to, settings).then(async rate => {
          cache[key] = rate;
          await persist();
          return rate;
        }).finally(() => inFlight.delete(key));
        inFlight.set(key, promise);
      }
      try {
        const rate = await inFlight.get(key);
        return { ...rate, result: rate.rate * amount, cached: false };
      } catch {
        throw new Error(settings.useProxy ? 'Your proxy is unavailable. Check its address and site permission.' : 'Could not get a current rate. Check your connection and try again.');
      }
    }
    async function clear() {
      await load();
      await Promise.allSettled([...inFlight.values()]);
      for (const key of Object.keys(cache)) delete cache[key];
      await persist();
    }
    return { convert, clear };
  }
  root.QCRates = { create };
  if (typeof module !== 'undefined') module.exports = { create };
})(globalThis);
