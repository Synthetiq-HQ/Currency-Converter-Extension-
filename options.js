/**
 * QuickCurrency Options Page Script
 */

const form = document.getElementById('settings-form');
const statusDiv = document.getElementById('status');
const clearCacheBtn = document.getElementById('clear-cache');

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get(
    ['targetCurrency', 'precision', 'cacheTTL', 'useProxy', 'proxyURL', 'ambiguousYenDefault'],
    (result) => {
      document.getElementById('target-currency').value = result.targetCurrency || 'GBP';
      document.getElementById('precision').value = result.precision !== undefined ? result.precision : 2;
      document.getElementById('cache-ttl').value = result.cacheTTL || 15;
      document.getElementById('use-proxy').checked = result.useProxy || false;
      document.getElementById('proxy-url').value = result.proxyURL || '';
      const ambiguousYen = result.ambiguousYenDefault || 'JPY';
      document.getElementById('ambiguous-yen').value = ambiguousYen;
      ambiguousYenDefaultLocal = ambiguousYen; // Update local variable for parser

      // Enable/disable proxy URL input based on checkbox
      toggleProxyInput();
    }
  );
}

// Toggle proxy URL input
function toggleProxyInput() {
  const useProxy = document.getElementById('use-proxy').checked;
  const proxyURL = document.getElementById('proxy-url');
  proxyURL.disabled = !useProxy;
  proxyURL.style.opacity = useProxy ? '1' : '0.5';
}

// Show status message
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + (isError ? 'error' : 'success');

  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

// Save settings
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const settings = {
    targetCurrency: document.getElementById('target-currency').value,
    precision: parseInt(document.getElementById('precision').value),
    cacheTTL: parseInt(document.getElementById('cache-ttl').value),
    useProxy: document.getElementById('use-proxy').checked,
    proxyURL: document.getElementById('proxy-url').value.trim(),
    ambiguousYenDefault: document.getElementById('ambiguous-yen').value
  };

  // Validate cache TTL
  if (settings.cacheTTL < 5 || settings.cacheTTL > 60) {
    showStatus('Cache duration must be between 5 and 60 minutes', true);
    return;
  }

  // Validate proxy URL if enabled
  if (settings.useProxy && !settings.proxyURL) {
    showStatus('Please enter a proxy URL or disable the proxy option', true);
    return;
  }

  // Save to storage
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving settings: ' + chrome.runtime.lastError.message, true);
    } else {
      showStatus('Settings saved successfully! ✓');
      console.log('[QuickCurrency] Settings saved:', settings);
    }
  });
});

// Clear cache
clearCacheBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
    if (chrome.runtime.lastError) {
      showStatus('Error clearing cache: ' + chrome.runtime.lastError.message, true);
    } else if (response && response.success) {
      showStatus('Cache cleared successfully! ✓');
    }
  });
});

// Toggle proxy input when checkbox changes
document.getElementById('use-proxy').addEventListener('change', toggleProxyInput);

// Conversion display elements
const conversionSection = document.getElementById('conversion-section');
const conversionLoading = document.getElementById('conversion-loading');
const conversionResult = document.getElementById('conversion-result');
const conversionError = document.getElementById('conversion-error');
const conversionOriginal = document.getElementById('conversion-original');
const conversionConverted = document.getElementById('conversion-converted');
const closeConversionBtn = document.getElementById('close-conversion');

// Close conversion section
closeConversionBtn.addEventListener('click', () => {
  conversionSection.style.display = 'none';
});

// Simple currency parsing function for fallback (matches content.js priority-based parser)
// Note: This is a simplified fallback - main parsing happens in content.js
let ambiguousYenDefaultLocal = 'JPY'; // Will be updated when settings load

// Load ambiguous yen default setting
chrome.storage.sync.get(['ambiguousYenDefault'], (result) => {
  if (result.ambiguousYenDefault) {
    ambiguousYenDefaultLocal = result.ambiguousYenDefault;
  }
});

function parseCurrencyLocal(text) {
  if (!text) return null;
  
  // Normalize: strip NBSP and collapse whitespace
  const normalized = text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  
  console.log('[QuickCurrency] parseCurrencyLocal: Parsing:', normalized);
  
  const SYMBOL_MAP_BASE = {'$':'USD','€':'EUR','£':'GBP','₹':'INR','₽':'RUB','₩':'KRW','￥':'JPY','元':'CNY'};
  const SYMBOL_MAP = {...SYMBOL_MAP_BASE, '¥': ambiguousYenDefaultLocal, '￥': ambiguousYenDefaultLocal};
  const COUNTRY_MAP = { CN:'CNY', GB:'GBP', UK:'GBP', US:'USD', AU:'AUD', CA:'CAD', NZ:'NZD', HK:'HKD', SG:'SGD' };
  const lowerText = normalized.toLowerCase();
  
  function expandSuffix(numStr) {
    if (!numStr) return numStr;
    const m = numStr.match(/^([\d,.]+)\s*([KMBkmb])?$/);
    if (!m) return numStr;
    let n = parseFloat(m[1].replace(/,/g,''));
    if (isNaN(n)) return numStr;
    if (!m[2]) return String(n);
    const s = m[2].toUpperCase();
    if (s === 'K') return String(n * 1e3);
    if (s === 'M') return String(n * 1e6);
    if (s === 'B') return String(n * 1e9);
    return String(n);
  }
  
  // PRIORITY 1: ISO code pattern
  let iso = normalized.match(/\b([A-Z]{3})\b[\s:]*([0-9][0-9,.\sKMkmbB]*)/i);
  if (!iso) iso = normalized.match(/([0-9][0-9,.\sKMkmbB]*)\s*\b([A-Z]{3})\b/i);
  if (iso) {
    const code = iso[1] && iso[1].match(/[A-Z]{3}/i) ? iso[1].toUpperCase() : iso[2].toUpperCase();
    const amountRaw = iso[2] && iso[2].match(/[0-9]/) ? iso[2] : iso[1];
    const amount = parseFloat(expandSuffix(String(amountRaw).replace(/[,\s]/g,'')));
    if (!isNaN(amount) && amount > 0) return { currency: code, amount };
  }
  
  // PRIORITY 2: Country prefix + symbol (CN ¥ 35.00)
  const countryRe = /(?:\b([A-Z]{2,3})\b[\s:]*)([¥$€£₹₽₩￥元]|A\$|C\$|NZ\$|HK\$|S\$)\s*([0-9][0-9,.\sKMkmbB]*)/ug;
  let m;
  while ((m = countryRe.exec(normalized)) !== null) {
    const country = m[1].toUpperCase();
    const symbol = m[2];
    let amtStr = expandSuffix(m[3].replace(/[,\s]/g,''));
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) continue;
    
    // Country prefix takes priority
    if (COUNTRY_MAP[country]) {
      return { currency: COUNTRY_MAP[country], amount };
    }
  }
  
  // PRIORITY 3: Currency words
  const currencyWords = {
    'yuan': 'CNY', 'renminbi': 'CNY', 'rmb': 'CNY',
    'yen': 'JPY',
    'pound': 'GBP', 'sterling': 'GBP',
    'euro': 'EUR',
    'dollar': 'USD',
    'rupee': 'INR',
    'ruble': 'RUB', 'rouble': 'RUB',
    'won': 'KRW'
  };
  
  for (const [word, currency] of Object.entries(currencyWords)) {
    if (lowerText.includes(word)) {
      const wordIndex = lowerText.indexOf(word);
      const context = normalized.substring(Math.max(0, wordIndex - 50), Math.min(normalized.length, wordIndex + 50));
      const numMatch = context.match(/([0-9][0-9,.\sKMkmbB]*)/);
      if (numMatch) {
        const amount = parseFloat(expandSuffix(numMatch[1].replace(/[,\s]/g,'')));
        if (!isNaN(amount) && amount > 0) return { currency, amount };
      }
    }
  }
  
  // PRIORITY 4: Symbol patterns
  const symbolRe = /([¥￥$€£₹₽₩元]|A\$|C\$|NZ\$|HK\$|S\$)\s*([0-9][0-9,.\sKMkmbB]*)/ug;
  while ((m = symbolRe.exec(normalized)) !== null) {
    const symbol = m[1];
    let amtStr = expandSuffix(m[2].replace(/[,\s]/g,''));
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) continue;
    
    let code = SYMBOL_MAP[symbol] || SYMBOL_MAP[symbol.toUpperCase()] || null;
    
    // Special handling for ¥ - check context
    if ((symbol === '¥' || symbol === '￥') && !code) {
      const contextCheck = normalized.substring(Math.max(0, m.index - 20), Math.min(normalized.length, m.index + 50));
      const contextLower = contextCheck.toLowerCase();
      if (contextLower.includes('cn') || contextLower.includes('cny') || 
          contextLower.includes('yuan') || contextLower.includes('rmb') || 
          contextLower.includes('renminbi') || contextLower.includes('china') || 
          contextLower.includes('chinese')) {
        code = 'CNY';
      } else {
        code = ambiguousYenDefaultLocal;
      }
    }
    
    if (symbol === '元') code = 'CNY';
    if (!code) code = 'USD';
    
    if (code) return { currency: code, amount };
  }
  
  return null;
}

// Get selected text from active tab and convert
async function checkSelectionAndConvert() {
  try {
    console.log('[QuickCurrency] checkSelectionAndConvert: Starting...');
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      console.log('[QuickCurrency] checkSelectionAndConvert: No active tab');
      conversionSection.style.display = 'none';
      return;
    }

    console.log('[QuickCurrency] checkSelectionAndConvert: Active tab ID:', tab.id);

    let selectionInfo = null;
    let selectedText = null;
    let parsed = null;

    // Method 1: Try to get selection via sendMessage (content script)
    try {
      console.log('[QuickCurrency] checkSelectionAndConvert: Attempting sendMessage to content script...');
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('[QuickCurrency] checkSelectionAndConvert: sendMessage failed:', chrome.runtime.lastError.message);
            reject(chrome.runtime.lastError);
          } else {
            console.log('[QuickCurrency] checkSelectionAndConvert: sendMessage success:', response);
            resolve(response);
          }
        });
      });
      
      if (response && response.ok && response.selectionInfo) {
        selectionInfo = response.selectionInfo;
        selectedText = selectionInfo.text || selectionInfo.selection;
        parsed = selectionInfo.parsed;
        console.log('[QuickCurrency] checkSelectionAndConvert: Got selection from content script:', selectedText, parsed);
      }
    } catch (error) {
      console.log('[QuickCurrency] checkSelectionAndConvert: sendMessage failed, trying fallback:', error.message);
      
      // Method 2: Fallback to executeScript (content script not injected or failed)
      try {
        console.log('[QuickCurrency] checkSelectionAndConvert: Attempting executeScript fallback...');
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const text = selection.toString();
                // Normalize: strip NBSP and collapse whitespace
                const normalized = text.replace(/\u00A0/g, ' ').replace(/[\s\u2000-\u200B\u202F\u205F\u3000]+/g, ' ').trim();
                return normalized || null;
              }
              return null;
            } catch (e) {
              // Cross-origin or other error
              return null;
            }
          }
        });

        if (results && results[0] && results[0].result) {
          selectedText = results[0].result;
          console.log('[QuickCurrency] checkSelectionAndConvert: Got selection from executeScript:', selectedText);
          
          // Parse locally
          parsed = parseCurrencyLocal(selectedText);
          console.log('[QuickCurrency] checkSelectionAndConvert: Parsed locally:', parsed);
        }
      } catch (scriptError) {
        console.error('[QuickCurrency] checkSelectionAndConvert: executeScript also failed:', scriptError);
        conversionSection.style.display = 'none';
        return;
      }
    }
    
    if (!selectedText) {
      // No selection, hide conversion section
      console.log('[QuickCurrency] checkSelectionAndConvert: No selection found');
      conversionSection.style.display = 'none';
      return;
    }

    // Show conversion section
    conversionSection.style.display = 'block';
    conversionLoading.style.display = 'block';
    conversionResult.style.display = 'none';
    conversionError.style.display = 'none';

    // Get settings
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['targetCurrency', 'precision', 'useProxy', 'proxyURL'], (result) => {
        resolve({
          targetCurrency: result.targetCurrency || 'GBP',
          precision: result.precision !== undefined ? result.precision : 2,
          useProxy: result.useProxy || false,
          proxyURL: result.proxyURL || ''
        });
      });
    });

    // Use parsed result from content script, or parse locally if not available
    if (!parsed) {
      parsed = parseCurrencyLocal(selectedText);
    }

    if (!parsed) {
      throw new Error('No currency found in selection');
    }

    console.log('[QuickCurrency] checkSelectionAndConvert: Converting:', parsed, 'to', settings.targetCurrency);

    // Convert currency
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'convert',
        from: parsed.currency,
        to: settings.targetCurrency,
        amount: parsed.amount,
        useProxy: settings.useProxy,
        proxyURL: settings.proxyURL
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });

    if (response && response.result !== undefined) {
      displayConversion(selectedText, parsed.currency, parsed.amount, settings.targetCurrency, response.result, settings.precision);
    } else {
      throw new Error('Invalid conversion response');
    }
  } catch (error) {
    console.error('[QuickCurrency] checkSelectionAndConvert: Error:', error);
    // Show error message
    conversionLoading.style.display = 'none';
    conversionResult.style.display = 'none';
    conversionError.style.display = 'block';
    conversionError.textContent = error.message || 'Failed to convert currency';
    // Keep conversion section visible to show error
  }
}

// Display conversion result
function displayConversion(originalText, fromCurrency, fromAmount, toCurrency, toAmount, precision) {
  const currencySymbols = {
    GBP: '£', USD: '$', EUR: '€', JPY: '¥', CNY: '¥', INR: '₹', RUB: '₽', KRW: '₩'
  };

  const fromSymbol = currencySymbols[fromCurrency] || fromCurrency + ' ';
  const toSymbol = currencySymbols[toCurrency] || toCurrency + ' ';
  
  const formattedFrom = fromSymbol + fromAmount.toLocaleString('en-GB', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
  
  const formattedTo = toSymbol + toAmount.toLocaleString('en-GB', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });

  conversionOriginal.textContent = formattedFrom;
  conversionConverted.textContent = `≈ ${formattedTo}`;
  
  conversionLoading.style.display = 'none';
  conversionResult.style.display = 'block';
  conversionError.style.display = 'none';
  
  console.log('[QuickCurrency] displayConversion: Displayed conversion:', formattedFrom, '->', formattedTo);
}

// Load settings on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  // Check for selection and convert when popup opens
  checkSelectionAndConvert();
});
