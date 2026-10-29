(function (root) {
  'use strict';
  const defaults = { targetCurrency: 'GBP', sourceCurrency: 'USD', precision: 2, cacheTTL: 15,
    numberFormat: 'auto', ambiguousDollarDefault: 'USD', ambiguousYenDefault: 'JPY',
    useProxy: false, proxyURL: '', favorites: ['GBP', 'USD', 'EUR', 'SAR'] };
  function clean(values = {}) {
    return { ...defaults,
      targetCurrency: root.QC.isCurrency(values.targetCurrency) ? values.targetCurrency.toUpperCase() : defaults.targetCurrency,
      sourceCurrency: root.QC.isCurrency(values.sourceCurrency) ? values.sourceCurrency.toUpperCase() : defaults.sourceCurrency,
      precision: values.precision === 0 ? 0 : 2,
      cacheTTL: Math.min(60, Math.max(5, Number(values.cacheTTL) || 15)),
      numberFormat: ['auto', 'dot', 'comma'].includes(values.numberFormat) ? values.numberFormat : 'auto',
      ambiguousDollarDefault: ['USD', 'AUD', 'CAD', 'NZD', 'HKD', 'SGD'].includes(values.ambiguousDollarDefault) ? values.ambiguousDollarDefault : 'USD',
      ambiguousYenDefault: values.ambiguousYenDefault === 'CNY' ? 'CNY' : 'JPY',
      useProxy: values.useProxy === true,
      proxyURL: typeof values.proxyURL === 'string' ? values.proxyURL.trim().slice(0, 2048) : '',
      favorites: Array.isArray(values.favorites) ? [...new Set(values.favorites.filter(root.QC.isCurrency))].slice(0, 8) : defaults.favorites
    };
  }
  function sitePattern(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      // Browser host permissions apply to all ports on the selected host.
      return `${parsed.protocol}//${parsed.hostname}/*`;
    } catch { return null; }
  }
  root.QCSettings = { defaults, clean, sitePattern };
  if (typeof module !== 'undefined') module.exports = root.QCSettings;
})(globalThis);
