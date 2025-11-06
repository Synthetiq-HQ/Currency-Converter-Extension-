/**
 * QuickCurrency Content Script
 * Detects currency in highlighted text and shows conversion tooltip
 */

// Production mode - set to false for debugging
const DEBUG = true; // Temporarily enabled for debugging

// State
let debounceTimer = null;
let currentTooltip = null;
let userSettings = { targetCurrency: 'GBP', precision: 2, cacheTTL: 15, useProxy: false, proxyURL: '', ambiguousYenDefault: 'JPY' };
let settingsLoaded = false;
let isProcessing = false; // Flag to prevent multiple simultaneous processing
let selectionPollInterval = null; // Polling interval for selection detection
let listenersSetup = false; // Flag to prevent duplicate listener setup

// Currency symbol mapping (default assumptions for ambiguous symbols)
// Note: ¥ default can be overridden by user setting ambiguousYenDefault
const SYMBOL_MAP_BASE = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '₽': 'RUB',
  '₩': 'KRW',
  'A$': 'AUD',
  'C$': 'CAD',
  'NZ$': 'NZD',
  'HK$': 'HKD',
  'S$': 'SGD',
  '￥': 'JPY', // Full-width yen (will be overridden by user setting)
  '元': 'CNY'  // Chinese yuan character
};

// Get symbol map with user preference for ambiguous symbols
function getSymbolMap() {
  const yenDefault = userSettings.ambiguousYenDefault || 'JPY';
  return {
    ...SYMBOL_MAP_BASE,
    '¥': yenDefault,  // User preference
    '￥': yenDefault  // Full-width yen (same preference)
  };
}

// Pre-compiled regex patterns for better performance
const ISO_PATTERN_BEFORE = /\b([A-Z]{3})\s+([0-9][0-9,\.\s]+)\b/;
const ISO_PATTERN_AFTER = /\b([0-9][0-9,\.\s]+)\s+([A-Z]{3})\b/;
const SYMBOL_PATTERN = /([A-Z]{0,2}[$€£¥₹₽₩])\s*([0-9][0-9,\.\s]+)/;
const SYMBOL_PATTERN_AFTER = /([0-9][0-9,\.\s]+)\s*([$€£¥₹₽₩])/;
// Pattern for country code + space + symbol (e.g., "CN ¥ 358.00", "HK $ 100")
// Made more flexible to handle various spacing and find anywhere in text
const COUNTRY_SYMBOL_PATTERN = /(?:^|[\s:])?([A-Z]{2})\s+([$€£¥₹₽₩])\s+([0-9][0-9,\.\s]+)/;
const MULTIPLIER_PATTERN = /([0-9,\.\s]+)\s*([KMB])/i;
const CLEAN_NUMBER_PATTERN = /[,\s]/g;

// Country code to currency mapping for patterns like "CN ¥"
const COUNTRY_CURRENCY_MAP = {
  'CN': 'CNY',
  'HK': 'HKD',
  'SG': 'SGD',
  'AU': 'AUD',
  'CA': 'CAD',
  'NZ': 'NZD',
  'US': 'USD',
  'GB': 'GBP',
  'UK': 'GBP',
  'EU': 'EUR',
  'JP': 'JPY',
  'IN': 'INR',
  'RU': 'RUB',
  'KR': 'KRW'
};

// Currency symbols for formatting
const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', JPY: '¥', CNY: '¥', INR: '₹', RUB: '₽', KRW: '₩' };

// Helper function for conditional logging
function log(...args) {
  if (DEBUG) console.log(...args);
}

function logError(...args) {
  console.error(...args);
}

// Load user settings from storage (ensure settings are loaded before use)
function loadSettings(callback) {
  try {
    if (!chrome.storage || !chrome.storage.sync) {
      logError('[QuickCurrency] Chrome storage API not available');
      // Use defaults if storage unavailable
      settingsLoaded = true;
      if (callback) callback();
      return;
    }
    
chrome.storage.sync.get(['targetCurrency', 'precision', 'cacheTTL', 'useProxy', 'proxyURL'], (result) => {
      if (chrome.runtime.lastError) {
        logError('[QuickCurrency] Error loading settings:', chrome.runtime.lastError);
        // Use defaults on error
        settingsLoaded = true;
        if (callback) callback();
        return;
      }
      
  userSettings = {
    targetCurrency: result.targetCurrency || 'GBP',
    precision: result.precision !== undefined ? result.precision : 2,
    cacheTTL: result.cacheTTL || 15,
    useProxy: result.useProxy || false,
        proxyURL: result.proxyURL || '',
        ambiguousYenDefault: result.ambiguousYenDefault || 'JPY'
      };
      settingsLoaded = true;
      log('[QuickCurrency] Loaded settings:', userSettings);
      if (callback) callback();
    });
  } catch (error) {
    logError('[QuickCurrency] Error in loadSettings:', error);
    // Use defaults on error
    settingsLoaded = true;
    if (callback) callback();
  }
}

// Load settings immediately
loadSettings();

// Listen for settings updates
try {
  if (chrome.storage && chrome.storage.onChanged) {
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.targetCurrency) userSettings.targetCurrency = changes.targetCurrency.newValue;
    if (changes.precision !== undefined) userSettings.precision = changes.precision.newValue;
    if (changes.cacheTTL) userSettings.cacheTTL = changes.cacheTTL.newValue;
    if (changes.useProxy !== undefined) userSettings.useProxy = changes.useProxy.newValue;
    if (changes.proxyURL) userSettings.proxyURL = changes.proxyURL.newValue;
        if (changes.ambiguousYenDefault) userSettings.ambiguousYenDefault = changes.ambiguousYenDefault.newValue;
  }
});
  }
} catch (error) {
  logError('[QuickCurrency] Error setting up storage listener:', error);
}

/**
 * Normalize selection text by stripping NBSP and collapsing whitespace
 * @param {string} text - Raw selection text
 * @returns {string} - Normalized text
 */
function normalizeSelectionText(text) {
  if (!text) return '';
  // Collapse whitespace, convert NBSP to space, trim
  return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

// Alias for compatibility
function normalizeText(s) {
  return normalizeSelectionText(s);
}

/**
 * Get current selection info (text and parsed currency)
 * Simplified version that works even in cross-origin frames
 * @returns {object|null} - {text: string, parsed: object|null} or null if no selection
 */
function getCurrentSelectionInfo() {
  try {
    const s = normalizeText(window.getSelection ? window.getSelection().toString() : '');
    if (!s) {
      log('[QuickCurrency] getCurrentSelectionInfo: No selection text');
      return { text: '', parsed: null };
    }
    const parsed = parseCurrency(s);
    log('[QuickCurrency] getCurrentSelectionInfo: Selection:', s, 'Parsed:', parsed);
    return { text: s, parsed: parsed || null };
  } catch (e) {
    log('[QuickCurrency] getCurrentSelectionInfo: Error:', String(e));
    return { text: '', parsed: null, error: String(e) };
  }
}

// Listen for messages from popup/background
try {
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === 'getSelection') {
        log('[QuickCurrency] Received getSelection message');
        const selectionInfo = getCurrentSelectionInfo();
        sendResponse({ ok: true, selectionInfo: selectionInfo });
        return true; // Indicate async response
      }
      
      if (message && message.action === 'forceConvertSelection' && message.text) {
        log('[QuickCurrency] Received forceConvertSelection message:', message.text);
        const sel = normalizeText(String(message.text));
        const parsed = parseCurrency(sel);
        
        // Get rect from current selection if available, else use default position
        let rect = { left: 100, top: 100, width: 0, height: 0 };
        const actualSel = window.getSelection();
        if (actualSel && actualSel.toString().trim().length) {
          try {
            if (actualSel.rangeCount > 0) {
              const range = actualSel.getRangeAt(0);
              rect = range.getBoundingClientRect();
            }
          } catch (e) {
            log('[QuickCurrency] Could not get selection rect:', e.message);
          }
        }
        
        if (parsed) {
          // Get target currency from settings
          chrome.storage.sync.get(['targetCurrency', 'precision'], (result) => {
            const targetCurrency = result.targetCurrency || 'GBP';
            const precision = result.precision !== undefined ? result.precision : 2;
            
            // Request conversion
            chrome.runtime.sendMessage({
              action: 'convert',
              from: parsed.currency,
              to: targetCurrency,
              amount: parsed.amount
            }, (resp) => {
              if (resp && resp.result !== undefined) {
                const formatted = formatCurrency(resp.result, targetCurrency, precision);
                const original = formatCurrency(parsed.amount, parsed.currency, precision);
                showTooltip(rect, `≈ ${formatted}`, original);
              } else {
                showTooltip(rect, 'Rate unavailable', sel);
              }
            });
          });
        } else {
          showTooltip(rect, 'No currency found', sel);
        }
        
        sendResponse({ ok: true });
        return true;
      }
      
      return false;
    });
    log('[QuickCurrency] Message listener registered for getSelection and forceConvertSelection');
  }
} catch (error) {
  logError('[QuickCurrency] Error setting up message listener:', error);
}

/**
 * Expand K/M/B suffixes to full numbers
 * @param {string} numStr - Number string with optional suffix
 * @returns {string} - Expanded number string
 */
function expandSuffix(numStr) {
  if (!numStr) return numStr;
  const m = numStr.match(/^([\d,.]+)\s*([KMBkmb])?$/);
  if (!m) return numStr;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return numStr;
  if (!m[2]) return String(n);
  const s = m[2].toUpperCase();
  if (s === 'K') return String(n * 1e3);
  if (s === 'M') return String(n * 1e6);
  if (s === 'B') return String(n * 1e9);
  return String(n);
}

/**
 * Robust parseCurrency with STRICT PRIORITY ORDER
 * Priority: 1) ISO code > 2) Country prefix > 3) Currency words > 4) Symbol (with user override) > 5) Fallback
 * Handles: CN ¥ 35.00, Total Amount:CN ¥ 80.00, $1.2M, USD 1,234, etc.
 * @param {string} selectionText - Selected text
 * @returns {object|null} - {currency, amount} or null
 */
function parseCurrency(selectionText) {
  const text = normalizeText(selectionText);
  if (!text) {
    log('[QuickCurrency] parseCurrency: Empty text after normalization');
    return null;
  }

  log('[QuickCurrency] parseCurrency: Parsing normalized text:', text);
  const symbolMap = getSymbolMap();
  const lowerText = text.toLowerCase();

  // PRIORITY 1: ISO code pattern (USD 1234 or 1234 USD)
  // Must be 3-letter code followed by number or number followed by 3-letter code
  let iso = text.match(/\b([A-Z]{3})\b[\s:]*([0-9][0-9,.\sKMkmbB]*)/i);
  if (!iso) iso = text.match(/([0-9][0-9,.\sKMkmbB]*)\s*\b([A-Z]{3})\b/i);
  if (iso) {
    const code = iso[1] && iso[1].match(/[A-Z]{3}/i) ? iso[1].toUpperCase() : iso[2].toUpperCase();
    const amountRaw = iso[2] && iso[2].match(/[0-9]/) ? iso[2] : iso[1];
    const amount = parseFloat(expandSuffix(String(amountRaw).replace(/[,\s]/g, '')));
    if (!isNaN(amount) && amount > 0) {
      log('[QuickCurrency] parseCurrency: PRIORITY 1 - Matched ISO code:', { code, amount });
      return { currency: code, amount };
    }
  }

  // PRIORITY 2: Country prefix + symbol (CN ¥ 35.00, GB £ 100, US $ 50)
  // Pattern: 2-3 letter country code immediately before symbol
  const countrySymbolRe = /(?:\b([A-Z]{2,3})\b[\s:]*)([¥$€£₹₽₩￥元]|A\$|C\$|NZ\$|HK\$|S\$)\s*([0-9][0-9,.\sKMkmbB]*)/ug;
  let m;
  const countryMatches = [];
  while ((m = countrySymbolRe.exec(text)) !== null) {
    const country = m[1].toUpperCase();
    const symbol = m[2];
    let amtStr = expandSuffix(m[3].replace(/[,\s]/g, ''));
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) continue;
    
    // Map by country code (highest priority for this pattern)
    if (COUNTRY_CURRENCY_MAP[country]) {
      log('[QuickCurrency] parseCurrency: PRIORITY 2 - Matched country prefix:', { country, symbol, currency: COUNTRY_CURRENCY_MAP[country], amount });
      return { currency: COUNTRY_CURRENCY_MAP[country], amount };
    }
    
    // Store for later if country not in map but symbol is valid
    countryMatches.push({ country, symbol, amount, position: m.index });
  }

  // PRIORITY 3: Currency words (yuan, yen, rmb, renminbi, pound, euro, dollar, rupee)
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
      // Find number near the currency word
      const wordIndex = lowerText.indexOf(word);
      const beforeWord = text.substring(Math.max(0, wordIndex - 50), wordIndex);
      const afterWord = text.substring(wordIndex, Math.min(text.length, wordIndex + 50));
      const context = beforeWord + afterWord;
      
      // Look for number in context
      const numMatch = context.match(/([0-9][0-9,.\sKMkmbB]*)/);
      if (numMatch) {
        const amount = parseFloat(expandSuffix(numMatch[1].replace(/[,\s]/g, '')));
        if (!isNaN(amount) && amount > 0) {
          log('[QuickCurrency] parseCurrency: PRIORITY 3 - Matched currency word:', { word, currency, amount });
      return { currency, amount };
        }
      }
    }
  }

  // PRIORITY 4: Symbol patterns (with user override for ambiguous symbols)
  // Check for symbol + number patterns (including Unicode variants)
  // Pattern 1: Symbol before number
  const symbolBeforeRe = /([¥￥$€£₹₽₩元]|A\$|C\$|NZ\$|HK\$|S\$)\s*([0-9][0-9,.\sKMkmbB]*)/ug;
  let symbolMatch;
  while ((symbolMatch = symbolBeforeRe.exec(text)) !== null) {
    const symbol = symbolMatch[1];
    const amountRaw = symbolMatch[2];
    
    let amtStr = expandSuffix(amountRaw.replace(/[,\s]/g, ''));
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) continue;
    
    // Map symbol to currency (respects user preference for ¥)
    let code = symbolMap[symbol] || symbolMap[symbol.toUpperCase()] || null;
    
    // Special handling for ¥ - check context for CNY indicators
    if ((symbol === '¥' || symbol === '￥') && !code) {
      // Check if context suggests CNY (CN, CNY, yuan, rmb, renminbi, china, chinese)
      const contextCheck = text.substring(Math.max(0, symbolMatch.index - 20), Math.min(text.length, symbolMatch.index + 50));
      const contextLower = contextCheck.toLowerCase();
      if (contextLower.includes('cn') || contextLower.includes('cny') || 
          contextLower.includes('yuan') || contextLower.includes('rmb') || 
          contextLower.includes('renminbi') || contextLower.includes('china') || 
          contextLower.includes('chinese')) {
        code = 'CNY';
        log('[QuickCurrency] parseCurrency: PRIORITY 4 - ¥ detected as CNY from context');
      } else {
        // Use user preference
        code = userSettings.ambiguousYenDefault || 'JPY';
        log('[QuickCurrency] parseCurrency: PRIORITY 4 - ¥ using user preference:', code);
      }
    }
    
    // Handle 元 (Chinese yuan character)
    if (symbol === '元') {
      code = 'CNY';
    }
    
    if (!code) {
      // Try to extract base symbol
      const baseSymbol = symbol.replace(/[A-Z]/g, '').replace(/\$/g, '$');
      code = symbolMap[baseSymbol] || 'USD';
    }
    
    if (code) {
      log('[QuickCurrency] parseCurrency: PRIORITY 4 - Matched symbol pattern (before):', { symbol, code, amount });
      return { currency: code, amount };
    }
  }
  
  // Pattern 2: Symbol after number
  const symbolAfterRe = /([0-9][0-9,.\sKMkmbB]*)\s*([¥￥$€£₹₽₩元]|A\$|C\$|NZ\$|HK\$|S\$)/ug;
  while ((symbolMatch = symbolAfterRe.exec(text)) !== null) {
    const amountRaw = symbolMatch[1];
    const symbol = symbolMatch[2];
    
    let amtStr = expandSuffix(amountRaw.replace(/[,\s]/g, ''));
    const amount = parseFloat(amtStr);
    if (isNaN(amount) || amount <= 0) continue;
    
    // Map symbol to currency (respects user preference for ¥)
    let code = symbolMap[symbol] || symbolMap[symbol.toUpperCase()] || null;
    
    // Special handling for ¥ - check context for CNY indicators
    if ((symbol === '¥' || symbol === '￥') && !code) {
      const contextCheck = text.substring(Math.max(0, symbolMatch.index - 20), Math.min(text.length, symbolMatch.index + 50));
      const contextLower = contextCheck.toLowerCase();
      if (contextLower.includes('cn') || contextLower.includes('cny') || 
          contextLower.includes('yuan') || contextLower.includes('rmb') || 
          contextLower.includes('renminbi') || contextLower.includes('china') || 
          contextLower.includes('chinese')) {
        code = 'CNY';
        log('[QuickCurrency] parseCurrency: PRIORITY 4 - ¥ detected as CNY from context (after)');
      } else {
        code = userSettings.ambiguousYenDefault || 'JPY';
        log('[QuickCurrency] parseCurrency: PRIORITY 4 - ¥ using user preference (after):', code);
      }
    }
    
    // Handle 元 (Chinese yuan character)
    if (symbol === '元') {
      code = 'CNY';
    }
    
    if (!code) {
      const baseSymbol = symbol.replace(/[A-Z]/g, '').replace(/\$/g, '$');
      code = symbolMap[baseSymbol] || 'USD';
    }
    
    if (code) {
      log('[QuickCurrency] parseCurrency: PRIORITY 4 - Matched symbol pattern (after):', { symbol, code, amount });
      return { currency: code, amount };
    }
  }

  // PRIORITY 5: Fallback - try Unicode property escapes for any currency symbol
  try {
    const generic = text.match(/([\p{Sc}])\s*([0-9][0-9,.\sKMkmbB]*)/u);
    if (generic) {
      const symbol = generic[1];
      const amt = parseFloat(expandSuffix(generic[2].replace(/[,\s]/g, '')));
      const code = symbolMap[symbol] || 'USD';
      if (!isNaN(amt) && amt > 0) {
        log('[QuickCurrency] parseCurrency: PRIORITY 5 - Matched Unicode symbol:', { symbol, code, amount: amt });
        return { currency: code, amount: amt };
      }
    }
  } catch (e) {
    // Unicode property escapes not supported, skip
  }

  log('[QuickCurrency] parseCurrency: No pattern matched for text:', text);
  return null;
}

/**
 * Create and show tooltip above selection (optimized with validation)
 * @param {object} rect - Selection bounding rect
 * @param {string} convertedText - Formatted conversion result
 * @param {string} originalText - Original currency text
 */
function showTooltip(rect, convertedText, originalText) {
  try {
    // Validate inputs
    if (!rect || !convertedText || !originalText) {
      if (DEBUG) {
        logError('[QuickCurrency] Invalid parameters for showTooltip:', { rect, convertedText, originalText });
      }
      return;
    }

    // Verify DOM is ready
    if (!document.body) {
      if (DEBUG) {
        logError('[QuickCurrency] Document body not available');
      }
      return;
    }

  // Remove existing tooltip
  hideTooltip();

    // Create tooltip element with optimized DOM creation
  const tooltip = document.createElement('div');
  tooltip.className = 'quickcurrency-tooltip';
    
    // Create tooltip with Synthetiq branding
    tooltip.innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;min-width:140px;">
    <img src="${chrome.runtime.getURL('assets/synthetiq-logo-24.png')}" alt="S" style="width:20px;height:20px;border-radius:4px;flex:0 0 20px;background:transparent"/>
    <div style="flex:1;line-height:1.05;">
      <div style="font-weight:700;color:#8cffb1;">${convertedText}</div>
      <div style="font-size:11px;opacity:0.85;color:#ddd;">${originalText}</div>
    </div>
    <button id="qc-copy" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px">📋</button>
  </div>
`;

  // Position above selection
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    let left = (rect.left || 0) + scrollX + (rect.width || 0) / 2;
    let top = (rect.top || 0) + scrollY - 10;

    // Temporarily add to DOM to measure tooltip size
    tooltip.style.visibility = 'hidden';
    tooltip.style.position = 'absolute';
    tooltip.style.top = '-9999px'; // Position off-screen for measurement
    document.body.appendChild(tooltip);
    
    // Get tooltip dimensions
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipHeight = tooltipRect.height || 40; // Fallback height
    const tooltipWidth = tooltipRect.width || 200; // Fallback width
    
    // Adjust position if tooltip would go off-screen
    if (top - tooltipHeight - 10 < scrollY) {
      top = (rect.bottom || rect.top || 0) + scrollY + 10;
      tooltip.classList.add('quickcurrency-below');
    }
    
    if (left - tooltipWidth / 2 < scrollX) {
      left = scrollX + tooltipWidth / 2 + 10;
    }
    
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800;
    if (left + tooltipWidth / 2 > scrollX + viewportWidth) {
      left = scrollX + viewportWidth - tooltipWidth / 2 - 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.visibility = 'visible';
  currentTooltip = tooltip;

  // Add copy functionality
  const copyBtn = tooltip.querySelector('#qc-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const textToCopy = convertedText.replace('≈ ', '').replace(/[^0-9.,£$€¥₹]/g, '');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          copyBtn.textContent = '✓';
          setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
        }).catch(() => {
          // Silently fail in production
          if (DEBUG) logError('[QuickCurrency] Failed to copy');
        });
      }
    });
  }

  // Fade in
    requestAnimationFrame(() => {
      if (tooltip && tooltip.parentNode) {
    tooltip.classList.add('quickcurrency-visible');
      }
    });
  } catch (error) {
    if (DEBUG) {
      logError('[QuickCurrency] Error in showTooltip:', error);
    }
    hideTooltip();
  }
}

/**
 * Hide and remove tooltip
 */
function hideTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}

/**
 * Check if extension context is valid
 * @returns {boolean}
 */
function isExtensionContextValid() {
  try {
    // Check if chrome object exists
    if (typeof chrome === 'undefined' || !chrome) {
      return false;
    }
    
    // Check if runtime exists
    if (typeof chrome.runtime === 'undefined' || !chrome.runtime) {
      return false;
    }
    
    // Try to access id - this will throw if context is invalidated
    try {
      const id = chrome.runtime.id;
      return typeof id !== 'undefined' && id !== null && id !== '';
    } catch (idError) {
      // Context invalidated - return false
      return false;
    }
  } catch (e) {
    // Any error means context is invalid
    return false;
  }
}

/**
 * Send message to background script with timeout
 * @param {object} message - Message to send
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<object>}
 */
function sendMessageWithTimeout(message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    // Check context before sending
    if (!isExtensionContextValid()) {
      reject(new Error('Extension context invalidated'));
      return;
    }

    let responded = false;
    const timeout = setTimeout(() => {
      if (!responded) {
        responded = true;
        reject(new Error('Request timeout'));
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';
          if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
            reject(new Error('Extension context invalidated'));
          } else {
            reject(new Error(chrome.runtime.lastError.message || 'Runtime error'));
          }
          return;
        }

        resolve(response || {});
      });
    } catch (error) {
      if (!responded) {
        responded = true;
        clearTimeout(timeout);
        reject(error);
      }
    }
  });
}

/**
 * Handle selection change with debounce (optimized - reduced to 400ms)
 */
function handleSelection() {
  // Early exit if already processing or context invalid
  if (isProcessing) {
    return;
  }

  // Check extension context validity FIRST - before any operations
  if (!isExtensionContextValid()) {
    // Extension context invalidated - silently return
    // Don't log errors for this - it's expected when extension reloads
    return;
  }

  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    // Wrap entire handler in try-catch to catch any unexpected errors
    try {
      // Set processing flag
      isProcessing = true;

      // Phase 1: Check extension context validity FIRST (double-check)
      if (!isExtensionContextValid()) {
        // Extension context invalidated - silently return
        isProcessing = false;
        return;
      }

      // Phase 3: Ensure settings are loaded
      if (!settingsLoaded) {
        // Wait for settings to load (with timeout)
        await new Promise((resolve) => {
          const checkSettings = () => {
            if (settingsLoaded) {
              resolve();
            } else {
              setTimeout(checkSettings, 50);
            }
          };
          checkSettings();
          // Timeout after 1 second
          setTimeout(resolve, 1000);
        });
      }

      // Get selection
    const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        hideTooltip();
        return;
      }

      const rawText = selection.toString();
      const text = normalizeSelectionText(rawText);
      log('[QuickCurrency] Selection changed, text:', text, 'length:', text.length);

    if (!text || text.length === 0) {
        log('[QuickCurrency] Empty selection, hiding tooltip');
      hideTooltip();
      return;
    }

      // Parse currency (parseCurrency now normalizes internally, but we already normalized)
    const parsed = parseCurrency(text);
      log('[QuickCurrency] Parsed currency result:', parsed);
      
      if (parsed) {
        log('[QuickCurrency] Successfully parsed:', { currency: parsed.currency, amount: parsed.amount });
      } else {
        log('[QuickCurrency] Failed to parse currency from text:', text);
      }
      
    if (!parsed) {
      hideTooltip();
      return;
    }

    // Don't convert if already in target currency
    if (parsed.currency === userSettings.targetCurrency) {
      hideTooltip();
      return;
    }

      // Capture selection rect data IMMEDIATELY before any async operations
      // Store all data in closure to avoid context dependency
      let rectData = null;
      let parsedData = { ...parsed };
      let settingsData = { ...userSettings };

      // Capture rect synchronously - no Chrome API calls here
      try {
        // Double-check extension context is still valid
        if (!isExtensionContextValid()) {
          return;
        }

        // Double-check selection is still valid
        if (!selection || !selection.rangeCount || selection.rangeCount === 0) {
          hideTooltip();
          return;
        }

        // Get range - wrap in try-catch to handle any DOM errors
        let range;
        try {
          range = selection.getRangeAt(0);
        } catch (rangeError) {
          // Selection might have changed - silently return
          hideTooltip();
          return;
        }

        if (!range) {
          hideTooltip();
          return;
        }

        // Get bounding rect - wrap in try-catch
        let rect;
        try {
          rect = range.getBoundingClientRect();
        } catch (rectError) {
          // Range might be invalid - silently return
          hideTooltip();
          return;
        }

        if (!rect) {
          hideTooltip();
          return;
        }

        // Validate rect (check if selection is visible)
        if (rect.width === 0 && rect.height === 0) {
          hideTooltip();
          return;
        }

        // Store rect data immediately for use in callback
        rectData = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right || (rect.left + rect.width)
        };
      } catch (error) {
        // Any unexpected error - check if it's context invalidation
        const errorMsg = error && error.message ? error.message : String(error);
        const errorStr = String(error).toLowerCase();
        
        // Silently handle context invalidation - it's expected when extension reloads
        if (errorMsg.includes('Extension context invalidated') || 
            errorMsg.includes('context invalidated') ||
            errorStr.includes('extension context') ||
            errorStr.includes('context invalidated')) {
          return;
        }
        
        // Only log other errors in debug mode
        if (DEBUG) {
          logError('[QuickCurrency] Error getting selection range:', error);
        }
        hideTooltip();
        return;
      }

      // Double-check extension context before sending message
      if (!isExtensionContextValid()) {
        return;
      }

      // Phase 2: Send conversion request with timeout
      log('[QuickCurrency] Sending conversion request:', {
        from: parsedData.currency,
        to: settingsData.targetCurrency,
        amount: parsedData.amount
      });

      try {
        const response = await sendMessageWithTimeout({
          action: 'convert',
          from: parsedData.currency,
          to: settingsData.targetCurrency,
          amount: parsedData.amount,
          useProxy: settingsData.useProxy,
          proxyURL: settingsData.proxyURL
        }, 5000); // 5 second timeout

        log('[QuickCurrency] Received response:', response);

        // Phase 6: Validate response
        if (!response || typeof response !== 'object') {
          if (DEBUG) {
            logError('[QuickCurrency] Invalid response:', response);
          }
          hideTooltip();
          return;
        }

        if (response.error) {
          if (DEBUG) {
            logError('[QuickCurrency] Conversion error:', response.error);
          }
          hideTooltip();
          return;
        }

        if (response.result === undefined || response.result === null) {
          if (DEBUG) {
            logError('[QuickCurrency] No result in response:', response);
          }
          hideTooltip();
          return;
        }

        // Verify rectData was captured successfully
        if (!rectData) {
          if (DEBUG) {
            logError('[QuickCurrency] Rect data not available');
          }
          hideTooltip();
          return;
        }

        // Reconstruct rect object from stored data
        const rectObj = {
          left: rectData.left,
          top: rectData.top,
          width: rectData.width,
          height: rectData.height,
          bottom: rectData.bottom,
          right: rectData.right,
          getBoundingClientRect: () => rectObj
        };

        // Phase 5: Show tooltip with validation
        try {
          const formatted = formatCurrency(response.result, settingsData.targetCurrency, settingsData.precision);
          const original = formatCurrency(parsedData.amount, parsedData.currency, settingsData.precision);
          log('[QuickCurrency] Showing tooltip:', formatted);
          showTooltip(rectObj, `≈ ${formatted}`, original);
        } catch (error) {
          if (DEBUG) {
            logError('[QuickCurrency] Error showing tooltip:', error);
          }
          hideTooltip();
        }

      } catch (error) {
        // Handle timeout or other errors
        const errorMsg = error && error.message ? error.message : String(error);
        const errorStr = String(error).toLowerCase();
        
        // Silently handle context invalidation
        if (errorMsg.includes('Extension context invalidated') || 
            errorMsg.includes('context invalidated') ||
            errorStr.includes('extension context') ||
            errorStr.includes('context invalidated')) {
          // Extension was reloaded - silently fail
          isProcessing = false;
          return;
        }
        if (errorMsg.includes('timeout')) {
          if (DEBUG) {
            logError('[QuickCurrency] Conversion request timed out');
          }
        } else {
          if (DEBUG) {
            logError('[QuickCurrency] Error sending message:', error);
          }
        }
        hideTooltip();
      }

    } catch (error) {
      // Catch any unexpected errors in the handler
      const errorMsg = error && error.message ? error.message : String(error);
      const errorStr = String(error).toLowerCase();
      
      // Silently handle context invalidation - it's expected when extension reloads
      if (errorMsg.includes('Extension context invalidated') || 
          errorMsg.includes('context invalidated') ||
          errorStr.includes('extension context') ||
          errorStr.includes('context invalidated')) {
        // Extension was reloaded - silently fail
        isProcessing = false;
        return;
      }
      // Only log unexpected errors in debug mode
      if (DEBUG) {
        logError('[QuickCurrency] Unexpected error in handleSelection:', error);
      }
      hideTooltip();
    } finally {
      // Always reset processing flag
      isProcessing = false;
    }

  }, 400); // Reduced debounce from 700ms to 400ms for faster response
}

/**
 * Format number as currency
 * @param {number} amount
 * @param {string} currency
 * @param {number} precision
 * @returns {string}
 */
function formatCurrency(amount, currency, precision) {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const formatted = amount.toLocaleString('en-GB', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
  return symbol + formatted;
}

// Optimized event handlers
function handleEscapeKey(e) {
  if (e.key === 'Escape') hideTooltip();
}

function handleClickOutside(e) {
  if (currentTooltip && !currentTooltip.contains(e.target)) {
    hideTooltip();
  }
}

// Track last selection to avoid duplicate processing
let lastSelectionText = '';
let lastSelectionTime = 0;

function handleMouseUp(e) {
  // Use setTimeout to allow selection to complete
  setTimeout(() => {
    try {
    const selection = window.getSelection();
      if (!selection || !selection.toString().trim()) {
      hideTooltip();
        lastSelectionText = '';
        return;
      }
      
      const text = selection.toString().trim();
      const now = Date.now();
      
      // Avoid processing same selection multiple times
      if (text === lastSelectionText && (now - lastSelectionTime) < 500) {
        return;
      }
      
      lastSelectionText = text;
      lastSelectionTime = now;
      
      // Trigger selection handler
      handleSelection();
    } catch (error) {
      if (DEBUG) {
        logError('[QuickCurrency] Error in handleMouseUp:', error);
      }
    }
  }, 150);
}

function handleMouseDown(e) {
  // Clear last selection on new mouse down to allow re-selection
  lastSelectionText = '';
}

function handleKeyUp(e) {
  // Handle keyboard selections (Shift+Arrow keys, Ctrl+A, etc.)
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    setTimeout(() => {
      try {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          const text = selection.toString().trim();
          const now = Date.now();
          
          // Avoid processing same selection multiple times
          if (text === lastSelectionText && (now - lastSelectionTime) < 500) {
            return;
          }
          
          lastSelectionText = text;
          lastSelectionTime = now;
          
          // Trigger selection handler
          handleSelection();
        } else {
          hideTooltip();
          lastSelectionText = '';
        }
      } catch (error) {
        if (DEBUG) {
          logError('[QuickCurrency] Error in handleKeyUp:', error);
        }
    }
  }, 100);
  }
}

// Wait for DOM to be ready before setting up event listeners
function initializeExtension() {
  // Check if extension context is valid
  if (!isExtensionContextValid()) {
    // Retry initialization after a delay (for dynamic sites)
    setTimeout(() => {
      if (isExtensionContextValid() && !listenersSetup) {
        initializeExtension();
      }
    }, 1000);
    return;
  }

  // Ensure settings are loaded before initializing
  if (!settingsLoaded) {
    loadSettings(() => {
      setupEventListeners();
    });
  } else {
    setupEventListeners();
  }
}

/**
 * Polling mechanism for sites that block or don't fire selectionchange events
 * This is a fallback that checks for selections periodically
 */
function startSelectionPolling() {
  // Only start polling if not already running
  if (selectionPollInterval) {
    return;
  }
  
  let lastPolledText = '';
  let lastPolledTime = 0;
  
  selectionPollInterval = setInterval(() => {
    try {
      // Skip if already processing
      if (isProcessing) {
        return;
      }
      
      // Skip if context is invalid
      if (!isExtensionContextValid()) {
        return;
      }
      
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        if (lastPolledText) {
          lastPolledText = '';
          hideTooltip();
        }
        return;
      }
      
      const text = selection.toString().trim();
      const now = Date.now();
      
      // Only process if selection changed and enough time has passed
      if (text && text !== lastPolledText && (now - lastPolledTime) > 300) {
        lastPolledText = text;
        lastPolledTime = now;
        
        // Check if this is a currency value
        const parsed = parseCurrency(text);
        if (parsed) {
          handleSelection();
        }
      } else if (!text && lastPolledText) {
        // Selection cleared
        lastPolledText = '';
        hideTooltip();
      }
    } catch (error) {
      // Silently handle errors in polling
      if (DEBUG) {
        logError('[QuickCurrency] Error in selection polling:', error);
      }
    }
  }, 500); // Check every 500ms
}

function setupEventListeners() {
  // Prevent duplicate setup
  if (listenersSetup) {
    log('[QuickCurrency] Event listeners already setup, skipping');
    return;
  }
  listenersSetup = true;
  
  log('[QuickCurrency] Setting up event listeners...');
  
  // Primary: Listen for selection changes (works on most sites)
  document.addEventListener('selectionchange', handleSelection, true);
  log('[QuickCurrency] Added selectionchange listener');
  
  // Fallback 1: Mouse up event (catches mouse selections)
  document.addEventListener('mouseup', handleMouseUp, true);
  document.addEventListener('mousedown', handleMouseDown, true);
  log('[QuickCurrency] Added mouseup/mousedown listeners');
  
  // Fallback 2: Keyboard events (catches keyboard selections)
  document.addEventListener('keyup', handleKeyUp, true);
  log('[QuickCurrency] Added keyup listener');
  
  // Fallback 3: Polling mechanism for sites that block selectionchange
  startSelectionPolling();
  log('[QuickCurrency] Started selection polling');
  
  // Hide tooltip on Escape key
  document.addEventListener('keydown', handleEscapeKey, true);
  
  // Hide tooltip on click outside
  document.addEventListener('click', handleClickOutside, true);

  log('[QuickCurrency] Content script loaded and initialized on:', window.location.href);
}

// Multiple initialization strategies for maximum compatibility
function tryInitialize() {
  // Skip if already initialized
  if (listenersSetup) {
    return;
  }
  
  // Strategy 1: If DOM is already ready, initialize immediately
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeExtension();
    return;
  }
  
  // Strategy 2: Wait for DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension, { once: true });
  }
  
  // Strategy 3: Fallback for sites that don't fire DOMContentLoaded (e.g., SPAs)
  // Also handle dynamic content loading
  let initAttempts = 0;
  const maxAttempts = 10;
  const initInterval = setInterval(() => {
    initAttempts++;
    
    // Skip if already initialized
    if (listenersSetup) {
      clearInterval(initInterval);
      return;
    }
    
    // Try to initialize if context is valid
    if (isExtensionContextValid()) {
      initializeExtension();
    }
    
    // Stop trying after max attempts
    if (initAttempts >= maxAttempts) {
      clearInterval(initInterval);
    }
  }, 500);
  
  // Strategy 4: Initialize on window load as final fallback
  window.addEventListener('load', () => {
    if (!listenersSetup && isExtensionContextValid()) {
      initializeExtension();
    }
  }, { once: true });
}

// Start initialization immediately
tryInitialize();

// Also try to initialize after a short delay (for very dynamic sites)
setTimeout(() => {
  if (!listenersSetup && isExtensionContextValid()) {
    tryInitialize();
  }
}, 100);
