/**
 * QuickCurrency Background Service Worker
 * Handles currency conversion API calls and caching
 */

// Production mode - set to false for debugging
const DEBUG = false;

// Cache structure: { "USD:GBP": { rate: 0.79, timestamp: 1699... }, ... }
const CACHE_KEY = 'quickcurrency_rates';
const DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

// API endpoints
const FRANKFURTER_API = 'https://api.frankfurter.dev/latest';
const EXCHANGERATE_HOST_API = 'https://api.exchangerate.host/convert';
const EXCHANGERATE_API_IO = 'https://api.exchangerate-api.com/v4/latest';

// Helper function for conditional logging
function log(...args) {
  if (DEBUG) console.log(...args);
}

function logError(...args) {
  console.error(...args);
}

function logWarn(...args) {
  if (DEBUG) console.warn(...args);
}

/**
 * Get cached rate if valid
 * @param {string} from - Source currency
 * @param {string} to - Target currency
 * @param {number} ttl - Time to live in minutes
 * @returns {Promise<number|null>}
 */
async function getCachedRate(from, to, ttl) {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      const cache = result[CACHE_KEY] || {};
      const key = `${from}:${to}`;
      const entry = cache[key];

      if (entry) {
        const age = Date.now() - entry.timestamp;
        const ttlMs = ttl * 60 * 1000;

        if (age < ttlMs) {
          log(`[QuickCurrency] Cache hit: ${key} (age: ${Math.round(age/1000)}s)`);
          resolve(entry.rate);
          return;
        } else {
          log(`[QuickCurrency] Cache expired: ${key}`);
        }
      }

      resolve(null);
    });
  });
}

/**
 * Store rate in cache
 * @param {string} from
 * @param {string} to
 * @param {number} rate
 */
async function cacheRate(from, to, rate) {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      const cache = result[CACHE_KEY] || {};
      const key = `${from}:${to}`;

      cache[key] = {
        rate: rate,
        timestamp: Date.now()
      };

      chrome.storage.local.set({ [CACHE_KEY]: cache }, () => {
        log(`[QuickCurrency] Cached rate: ${key} = ${rate}`);
        resolve();
      });
    });
  });
}

/**
 * Fetch with timeout wrapper
 * @param {string} url
 * @param {object} options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Fetch rate from Frankfurter API (primary, free, no key)
 * @param {string} from
 * @param {string} to
 * @returns {Promise<number|null>}
 */
async function fetchFromFrankfurter(from, to) {
  try {
    const url = `${FRANKFURTER_API}?from=${from}&to=${to}`;
    log(`[QuickCurrency] Fetching from Frankfurter: ${url}`);

    const response = await fetchWithTimeout(url, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 5000);

    log(`[QuickCurrency] Frankfurter response status: ${response.status}`);

    if (!response.ok) {
      logWarn(`[QuickCurrency] Frankfurter failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    log(`[QuickCurrency] Frankfurter response data:`, data);

    if (data.rates && data.rates[to]) {
      const rate = data.rates[to];
      log(`[QuickCurrency] Frankfurter success: ${rate}`);
      return rate;
    }

    logWarn(`[QuickCurrency] Frankfurter: Rate for ${to} not found in response`);
    return null;
  } catch (error) {
    logError('[QuickCurrency] Frankfurter error:', error);
    return null;
  }
}

/**
 * Fetch rate from ExchangeRate.host API (fallback)
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @returns {Promise<number|null>}
 */
async function fetchFromExchangeRateHost(from, to, amount) {
  try {
    const url = `${EXCHANGERATE_HOST_API}?from=${from}&to=${to}&amount=${amount}`;
    log(`[QuickCurrency] Fetching from ExchangeRate.host: ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 5000);

    log(`[QuickCurrency] ExchangeRate.host response status: ${response.status}`);

    if (!response.ok) {
      logWarn(`[QuickCurrency] ExchangeRate.host failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    log(`[QuickCurrency] ExchangeRate.host response data:`, data);

    if (data.result !== undefined && data.result !== null) {
      const rate = amount > 0 ? data.result / amount : 0;
      log(`[QuickCurrency] ExchangeRate.host success: rate=${rate}`);
      return rate;
    }

    logWarn(`[QuickCurrency] ExchangeRate.host: No result in response`);
    return null;
  } catch (error) {
    logError('[QuickCurrency] ExchangeRate.host error:', error);
    return null;
  }
}

/**
 * Fetch rate from ExchangeRate-API.io (alternative free API)
 * @param {string} from
 * @param {string} to
 * @returns {Promise<number|null>}
 */
async function fetchFromExchangeRateIO(from, to) {
  try {
    const url = `${EXCHANGERATE_API_IO}/${from}`;
    log(`[QuickCurrency] Fetching from ExchangeRate-API.io: ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 5000);

    log(`[QuickCurrency] ExchangeRate-API.io response status: ${response.status}`);

    if (!response.ok) {
      logWarn(`[QuickCurrency] ExchangeRate-API.io failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    log(`[QuickCurrency] ExchangeRate-API.io response data:`, data);

    if (data.rates && data.rates[to]) {
      const rate = data.rates[to];
      log(`[QuickCurrency] ExchangeRate-API.io success: rate=${rate}`);
      return rate;
    }

    logWarn(`[QuickCurrency] ExchangeRate-API.io: Rate for ${to} not found`);
    return null;
  } catch (error) {
    logError('[QuickCurrency] ExchangeRate-API.io error:', error);
    return null;
  }
}

/**
 * Fetch rate from user's proxy
 * @param {string} proxyURL
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @returns {Promise<number|null>}
 */
async function fetchFromProxy(proxyURL, from, to, amount) {
  try {
    // Replace placeholders in proxy URL
    let url = proxyURL
      .replace('{FROM}', from)
      .replace('{TO}', to)
      .replace('{AMOUNT}', amount);

    log(`[QuickCurrency] Fetching from proxy: ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 8000); // Longer timeout for proxy

    if (!response.ok) {
      logWarn(`[QuickCurrency] Proxy failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.result !== undefined) {
      const rate = amount > 0 ? data.result / amount : 0;
      log(`[QuickCurrency] Proxy success: rate=${rate}`);
      return rate;
    }

    return null;
  } catch (error) {
    logError('[QuickCurrency] Proxy error:', error);
    return null;
  }
}

/**
 * Convert currency
 * @param {string} from
 * @param {string} to
 * @param {number} amount
 * @param {boolean} useProxy
 * @param {string} proxyURL
 * @param {number} cacheTTL
 * @returns {Promise<object>}
 */
async function convertCurrency(from, to, amount, useProxy = false, proxyURL = '', cacheTTL = 15) {
  // Check cache first
  const cachedRate = await getCachedRate(from, to, cacheTTL);

  if (cachedRate !== null) {
    return {
      result: cachedRate * amount,
      cached: true
    };
  }

  // Fetch fresh rate
  let rate = null;

  if (useProxy && proxyURL) {
    // Use proxy
    rate = await fetchFromProxy(proxyURL, from, to, amount);
    if (rate !== null) {
      await cacheRate(from, to, rate);
      return { result: rate * amount, cached: false };
    }
  }

  // Try Frankfurter first (primary API)
  rate = await fetchFromFrankfurter(from, to);

  if (rate !== null) {
    await cacheRate(from, to, rate);
    return { result: rate * amount, cached: false };
  }

  // Fallback to ExchangeRate.host
  rate = await fetchFromExchangeRateHost(from, to, amount);

  if (rate !== null) {
    await cacheRate(from, to, rate);
    return { result: rate * amount, cached: false };
  }

  // Fallback to ExchangeRate-API.io
  rate = await fetchFromExchangeRateIO(from, to);

  if (rate !== null) {
    await cacheRate(from, to, rate);
    return { result: rate * amount, cached: false };
  }

  // All failed
  logError('[QuickCurrency] All APIs failed for conversion:', { from, to, amount });
  return { error: 'Could not fetch exchange rate from any API' };
}

/**
 * Message handler with guaranteed response
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'convert') {
    const { from, to, amount, useProxy, proxyURL } = message;

    // Validate message parameters
    if (!from || !to || !amount || isNaN(amount) || amount <= 0) {
      sendResponse({ error: 'Invalid conversion parameters' });
      return false;
    }

    // Get cache TTL from storage with timeout
    let responded = false;
    const responseTimeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        logError('[QuickCurrency] Settings fetch timeout');
        // Use default cache TTL
        handleConversion(from, to, amount, useProxy, proxyURL, 15, sendResponse, () => { responded = true; });
      }
    }, 1000);

    try {
      chrome.storage.sync.get(['cacheTTL'], async (result) => {
        clearTimeout(responseTimeout);
        if (responded) return;
        
        const cacheTTL = result.cacheTTL || 15;
        await handleConversion(from, to, amount, useProxy, proxyURL, cacheTTL, sendResponse, () => { responded = true; });
      });
    } catch (error) {
      clearTimeout(responseTimeout);
      if (!responded) {
        responded = true;
        logError('[QuickCurrency] Error getting cache TTL:', error);
        // Use default cache TTL
        handleConversion(from, to, amount, useProxy, proxyURL, 15, sendResponse, () => {});
      }
    }

    // Return true to indicate async response
    return true;
  }

  if (message.action === 'clearCache') {
    try {
      chrome.storage.local.remove([CACHE_KEY], () => {
        if (chrome.runtime.lastError) {
          logError('[QuickCurrency] Error clearing cache:', chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          log('[QuickCurrency] Cache cleared');
          sendResponse({ success: true });
        }
      });
    } catch (error) {
      logError('[QuickCurrency] Error in clearCache:', error);
      sendResponse({ error: error.message });
    }
    return true;
  }

  // Unknown action
  sendResponse({ error: 'Unknown action' });
  return false;
});

/**
 * Handle currency conversion with guaranteed response
 */
async function handleConversion(from, to, amount, useProxy, proxyURL, cacheTTL, sendResponse, markResponded) {
  let responseSent = false;
  
  try {
    // Add timeout for conversion (10 seconds total)
    const conversionPromise = convertCurrency(from, to, amount, useProxy, proxyURL, cacheTTL);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Conversion timeout')), 10000);
    });

    const response = await Promise.race([conversionPromise, timeoutPromise]);
    
    if (!responseSent) {
      responseSent = true;
      markResponded();
      sendResponse(response);
    }
  } catch (error) {
    if (!responseSent) {
      responseSent = true;
      markResponded();
      logError('[QuickCurrency] Conversion error:', error);
      const errorMsg = error && error.message ? error.message : 'Conversion failed';
      sendResponse({ error: errorMsg });
    }
  }
}

// Create context menu on install/startup
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menu item if it exists
  chrome.contextMenus.removeAll(() => {
    // Create context menu item for selection conversion
    chrome.contextMenus.create({
      id: 'qc_convert_selection',
      title: 'QuickCurrency: Convert selection',
      contexts: ['selection']
    }, () => {
      if (chrome.runtime.lastError) {
        logError('[QuickCurrency] Error creating context menu:', chrome.runtime.lastError);
      } else {
        log('[QuickCurrency] Context menu created');
      }
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'qc_convert_selection' && info.selectionText) {
    log('[QuickCurrency] Context menu clicked, selection:', info.selectionText);
    
    // Try to send message to content script first
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'forceConvertSelection',
        text: info.selectionText
      }, (resp) => {
        // If content script responds, it will handle the conversion
        if (chrome.runtime.lastError) {
          log('[QuickCurrency] Content script not available, converting in background');
          // Fallback: parse and convert in background, then notify user
          // For now, just log - could open popup or show notification
        } else {
          log('[QuickCurrency] Context menu conversion handled by content script');
        }
      });
    }
  }
});

// Log startup
log('[QuickCurrency] Background service worker started');
