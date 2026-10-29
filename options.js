'use strict';
const $ = id => document.getElementById(id);
const names = new Intl.DisplayNames(undefined, { type: 'currency' });
let config;
for (const [id, codes] of [['target-currency', QC.codes], ['dollar', ['USD', 'AUD', 'CAD', 'NZD', 'HKD', 'SGD']]]) {
  for (const code of codes) { const option = document.createElement('option'); option.value = code; option.textContent = `${code} · ${names.of(code)}`; $(id).append(option); }
}
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function sites() {
  const { enabledSites = [] } = await chrome.storage.local.get('enabledSites');
  $('sites').replaceChildren(); $('no-sites').hidden = enabledSites.length !== 0;
  for (const site of enabledSites) {
    const li = document.createElement('li'), span = document.createElement('span'), button = document.createElement('button');
    span.textContent = site; button.textContent = 'Remove'; button.type = 'button';
    button.setAttribute('aria-label', `Remove ${site}`);
    button.addEventListener('click', async () => {
      try {
        const current = await chrome.storage.local.get('enabledSites');
        await chrome.storage.local.set({ enabledSites: (current.enabledSites || []).filter(s => s !== site) });
        if (!config.useProxy || QCSettings.sitePattern(config.proxyURL) !== site) await chrome.permissions.remove({ origins: [site] });
        const response = await chrome.runtime.sendMessage({ action: 'syncSites' });
        if (response.error) throw new Error(response.error);
        await sites(); status('Website removed.');
      } catch { status('Could not remove the website. Please try again.', true); }
    });
    li.append(span, button); $('sites').append(li);
  }
}
function proxyState() { $('proxy-url').disabled = !$('use-proxy').checked; }
$('use-proxy').addEventListener('change', proxyState);
$('settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const favorites = $('favorites').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (favorites.length > 8 || favorites.some(c => !QC.isCurrency(c))) throw new Error('Use up to eight supported currency codes.');
    const ttl = Number($('cache-ttl').value);
    if (!Number.isInteger(ttl) || ttl < 5 || ttl > 60) throw new Error('Cache duration must be 5–60 minutes.');
    const useProxy = $('use-proxy').checked, proxyURL = $('proxy-url').value.trim();
    let permission = Promise.resolve(true);
    if (useProxy) {
      const url = new URL(proxyURL.replaceAll('{FROM}', 'USD').replaceAll('{TO}', 'GBP').replaceAll('{AMOUNT}', '1'));
      const origin = QCSettings.sitePattern(url.href);
      if (!origin || url.username || url.password || !['{FROM}', '{TO}', '{AMOUNT}'].every(p => proxyURL.includes(p))) throw new Error('Use an HTTP(S) proxy URL with all three placeholders and no embedded password.');
      permission = chrome.permissions.request({ origins: [origin] });
    }
    if (!await permission) throw new Error('Proxy access was declined. Your previous settings are unchanged.');
    config = QCSettings.clean({ ...config, targetCurrency: $('target-currency').value, precision: Number($('precision').value),
      numberFormat: $('number-format').value, ambiguousDollarDefault: $('dollar').value,
      ambiguousYenDefault: $('yen').value, cacheTTL: ttl, useProxy, proxyURL, favorites });
    await chrome.storage.sync.set(config); status('Settings saved.');
  } catch (error) { status(error.message || 'Could not save settings.', true); }
});
$('clear-cache').addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'clearCache' });
    if (response.error) throw new Error(response.error); status('Rate cache cleared.');
  } catch { status('Could not clear the cache. Please try again.', true); }
});
async function init() {
  config = QCSettings.clean(await chrome.storage.sync.get(null));
  $('target-currency').value = config.targetCurrency; $('precision').value = String(config.precision);
  $('number-format').value = config.numberFormat; $('dollar').value = config.ambiguousDollarDefault;
  $('yen').value = config.ambiguousYenDefault; $('cache-ttl').value = String(config.cacheTTL);
  $('use-proxy').checked = config.useProxy; $('proxy-url').value = config.proxyURL; $('favorites').value = config.favorites.join(', ');
  proxyState(); await sites();
}
init().catch(() => status('Could not load settings. Please reload this page.', true));
