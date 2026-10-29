/* Shared by the popup, page overlay and tests. No network or browser access. */
(function (root) {
  'use strict';
  const codes = ('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW').split(' ');
  const codeSet = new Set(codes);
  const aliases = {
    'USD $': 'USD', 'AUD $': 'AUD', 'CAD $': 'CAD', 'NZD $': 'NZD', 'HKD $': 'HKD', 'SGD $': 'SGD',
    'CNY ¥': 'CNY', 'JPY ¥': 'JPY', 'EUR €': 'EUR', 'GBP £': 'GBP',
    'US$': 'USD', 'US $': 'USD', 'AU$': 'AUD', 'AU $': 'AUD', 'A$': 'AUD',
    'CA$': 'CAD', 'CA $': 'CAD', 'C$': 'CAD', 'NZ$': 'NZD', 'NZ $': 'NZD',
    'HK$': 'HKD', 'HK $': 'HKD', 'SG$': 'SGD', 'SG $': 'SGD', 'S$': 'SGD',
    'CN ¥': 'CNY', 'CN¥': 'CNY', 'JP ¥': 'JPY', 'GB £': 'GBP', 'UK £': 'GBP',
    'RMB': 'CNY', yuan: 'CNY', renminbi: 'CNY', yen: 'JPY',
    pound: 'GBP', pounds: 'GBP', sterling: 'GBP', euro: 'EUR', euros: 'EUR',
    rupee: 'INR', rupees: 'INR', ruble: 'RUB', rubles: 'RUB', won: 'KRW',
    '€': 'EUR', '£': 'GBP', '₹': 'INR', '₽': 'RUB', '₩': 'KRW', '元': 'CNY',
    'ر.س': 'SAR', 'ر.س.': 'SAR', 'ريال سعودي': 'SAR', 'ريال': 'SAR',
    'د.إ': 'AED', 'درهم إماراتي': 'AED', '₨': 'PKR'
  };
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marker = [...codes, ...Object.keys(aliases), '$', '¥', '￥', 'dollar', 'dollars']
    .sort((a, b) => b.length - a.length).map(escape).join('|');
  const number = "[-+−]?\\s*[0-9]+(?:[.,٬٫'’ \\u00a0\\u202f][0-9]+)*(?:\\s*[kmb](?![\\p{L}]))?";
  function normalize(text) {
    return String(text ?? '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
      .replace(/[\u00a0\u202f]/g, ' ').replace(/−/g, '-').trim();
  }
  function isCurrency(code) { return typeof code === 'string' && codeSet.has(code.toUpperCase()); }
  function grouped(integer, separator) {
    const parts = integer.split(separator);
    if (parts.length === 1) return /^\d+$/.test(integer);
    return /^\d{1,3}$/.test(parts[0]) && /^\d{3}$/.test(parts.at(-1)) &&
      (parts.slice(1, -1).every(p => /^\d{3}$/.test(p)) ||
       parts.slice(1, -1).every(p => /^\d{2}$/.test(p)));
  }
  function parseAmount(input, numberFormat = 'auto') {
    let text = normalize(input).replace(/٬/g, ',').replace(/٫/g, '.');
    let sign = 1;
    if (/^\(.*\)$/.test(text)) { sign = -1; text = text.slice(1, -1).trim(); }
    if (/^[+-]/.test(text)) { if (text[0] === '-') sign *= -1; text = text.slice(1).trim(); }
    let multiplier = 1;
    const suffix = text.match(/\s*([kmb])$/i);
    if (suffix) { multiplier = { k: 1e3, m: 1e6, b: 1e9 }[suffix[1].toLowerCase()]; text = text.slice(0, suffix.index); }
    if (!/^[0-9]+(?:[.,'’ ][0-9]+)*$/.test(text)) return null;
    const dot = text.lastIndexOf('.'), comma = text.lastIndexOf(',');
    let decimal = null;
    if (dot >= 0 && comma >= 0) decimal = dot > comma ? '.' : ',';
    else if (dot >= 0 || comma >= 0) {
      const sep = dot >= 0 ? '.' : ',';
      const parts = text.split(sep);
      if (numberFormat === 'dot') decimal = sep === '.' ? '.' : null;
      else if (numberFormat === 'comma') decimal = sep === ',' ? ',' : null;
      else if (parts.length === 2 && (parts[1].length !== 3 || parts[0] === '0' || multiplier !== 1)) decimal = sep;
    }
    const pieces = decimal ? text.split(decimal) : [text];
    if (pieces.length > 2 || (decimal && !/^\d+$/.test(pieces[1]))) return null;
    let integer = pieces[0];
    const separators = [...new Set(integer.replace(/[0-9]/g, ''))];
    if (separators.length > 1 || (separators.length && !grouped(integer, separators[0]))) return null;
    integer = integer.replace(/[^0-9]/g, '');
    const result = Number(integer + (decimal ? '.' + pieces[1] : '')) * multiplier * sign;
    return Number.isFinite(result) && Math.abs(result) <= 1e15 ? result : null;
  }
  function parseCurrency(input, settings = {}) {
    const text = normalize(input);
    if (!text || text.length > 512) return null;
    const dollar = isCurrency(settings.ambiguousDollarDefault) ? settings.ambiguousDollarDefault.toUpperCase() : 'USD';
    const yen = settings.ambiguousYenDefault === 'CNY' ? 'CNY' : 'JPY';
    function resolve(token) {
      if (token === '$' || /^dollars?$/i.test(token)) return dollar;
      if (token === '¥' || token === '￥') return yen;
      if (isCurrency(token)) return token.toUpperCase();
      return Object.entries(aliases).find(([name]) => name.toLowerCase() === token.toLowerCase())?.[1] ?? null;
    }
    const before = new RegExp(`(?<![\\p{L}\\p{N}])([-+]?\\s*)(${marker})(?![\\p{L}])\\s*(${number})`, 'giu');
    const after = new RegExp(`(?<![\\p{L}\\p{N}])(${number})\\s*(${marker})(?![\\p{L}])`, 'giu');
    const found = [];
    for (const match of text.matchAll(before)) {
      const amount = parseAmount((match[1].trim() || '') + match[3], settings.numberFormat);
      if (amount !== null) found.push({ currency: resolve(match[2]), amount, start: match.index, end: match.index + match[0].length });
    }
    for (const match of text.matchAll(after)) {
      const amount = parseAmount(match[1], settings.numberFormat);
      if (amount !== null && !found.some(f => match.index < f.end && match.index + match[0].length > f.start)) {
        found.push({ currency: resolve(match[2]), amount, start: match.index, end: match.index + match[0].length });
      }
    }
    if (found.length !== 1 || !found[0].currency) return null;
    let { currency, amount } = found[0];
    if (/^\([^()]+\)$/.test(text)) amount = -Math.abs(amount);
    return { currency, amount };
  }
  function format(amount, currency, precision = 2) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency,
      minimumFractionDigits: precision, maximumFractionDigits: precision }).format(amount);
  }
  const api = { codes, isCurrency, normalize, parseAmount, parseCurrency, format };
  root.QC = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
