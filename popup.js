'use strict';
const $ = id => document.getElementById(id);
let config, activeTab, pattern, siteEnabled = false, lastResult, timer, version = 0;
const currencyNames = new Intl.DisplayNames(undefined, { type: 'currency' });
for (const id of ['from', 'to']) for (const code of QC.codes) {
  const option = document.createElement('option'); option.value = code;
  option.textContent = `${code} · ${currencyNames.of(code)}`; $(id).append(option);
}
function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function invalidate() {
  version++; lastResult = null; $('result').textContent = '—'; $('original').textContent = 'Your conversion';
  for (const id of ['copy', 'copy-number', 'refresh']) $(id).disabled = true;
  $('attribution').hidden = true;
}
function favorites() {
  $('favorites').replaceChildren();
  for (const code of config.favorites) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = code;
    button.setAttribute('aria-pressed', String($('to').value === code));
    button.addEventListener('click', () => { $('to').value = code; edited(); }); $('favorites').append(button);
  }
}
function parsedInput() {
  const text = $('amount').value.trim();
  const parsed = QC.parseCurrency(text, config);
  if (parsed) return parsed;
  const amount = QC.parseAmount(text, config.numberFormat);
  return amount === null ? null : { currency: $('from').value, amount };
}
function editableAmount(amount) {
  return amount.toFixed(config.precision).replace('.', config.numberFormat === 'comma' ? ',' : '.');
}
async function convert(refresh = false) {
  clearTimeout(timer);
  const token = ++version;
  const parsed = parsedInput();
  if (!parsed) { invalidate(); status('Enter one price, such as USD 100 or €1.234,56.', true); return; }
  $('from').value = parsed.currency;
  const target = $('to').value;
  status('Converting…');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'convert', from: parsed.currency, to: target, amount: parsed.amount, refresh });
    if (token !== version) return;
    if (response.error) throw new Error(response.error);
    lastResult = { amount: response.result, currency: target };
    $('original').textContent = `${QC.format(parsed.amount, parsed.currency, config.precision)} → ${target}`;
    $('result').textContent = QC.format(response.result, target, config.precision);
    for (const id of ['copy', 'copy-number', 'refresh']) $(id).disabled = false;
    $('attribution').hidden = response.provider !== 'exchangerate-api';
    status('');
    config.sourceCurrency = parsed.currency; config.targetCurrency = target;
    await chrome.storage.sync.set({ sourceCurrency: parsed.currency, targetCurrency: target });
    favorites();
  } catch (error) { if (token === version) { invalidate(); status(error.message || 'Conversion unavailable', true); } }
}
function edited() {
  clearTimeout(timer); invalidate(); favorites();
  if ($('amount').value.trim()) timer = setTimeout(() => convert(), 350);
  else status('Highlight a price on a page, or type one here.');
}
$('amount').addEventListener('input', edited);
$('from').addEventListener('change', () => {
  const parsed = parsedInput(); if (parsed) $('amount').value = editableAmount(parsed.amount);
  edited();
});
$('to').addEventListener('change', edited);
$('converter').addEventListener('submit', e => { e.preventDefault(); convert(); });
$('refresh').addEventListener('click', () => convert(true));
$('swap').addEventListener('click', () => {
  const parsed = parsedInput();
  const oldFrom = parsed?.currency || $('from').value;
  const oldTarget = $('to').value;
  $('amount').value = lastResult ? editableAmount(lastResult.amount) : parsed ? editableAmount(parsed.amount) : '';
  $('from').value = oldTarget; $('to').value = oldFrom; edited();
});
for (const [id, numeric] of [['copy', false], ['copy-number', true]]) $(id).addEventListener('click', async () => {
  if (!lastResult) return;
  const value = numeric ? lastResult.amount.toFixed(config.precision) : QC.format(lastResult.amount, lastResult.currency, config.precision);
  try { await navigator.clipboard.writeText(value); status('Copied to clipboard.'); }
  catch { status('Copy unavailable. Select and copy the result instead.', true); }
});
$('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
async function updateSite() {
  const { enabledSites = [] } = await chrome.storage.local.get('enabledSites');
  siteEnabled = pattern && enabledSites.includes(pattern) && await chrome.permissions.contains({ origins: [pattern] });
  $('site-label').textContent = pattern ? `Automatic highlighting: ${new URL(activeTab.url).hostname}` : 'Manual conversion works here. This page cannot use highlighting.';
  $('toggle-site').textContent = siteEnabled ? 'Disable highlighting on this site' : 'Enable highlighting on this site';
  $('toggle-site').disabled = !pattern;
}
$('toggle-site').addEventListener('click', async () => {
  if (!pattern) return;
  try {
    const prepared = siteEnabled ? Promise.resolve({}) : chrome.runtime.sendMessage({ action: 'prepareSite', site: pattern, tabId: activeTab.id });
    // Request synchronously from the click handler, before any await.
    const grant = siteEnabled ? Promise.resolve(true) : chrome.permissions.request({ origins: [pattern] });
    const preparation = await prepared;
    if (preparation.error) throw new Error(preparation.error);
    if (!await grant) {
      await chrome.runtime.sendMessage({ action: 'cancelSite' });
      status('Highlighting stays off. You can still use the converter.'); return;
    }
    if (!siteEnabled) {
      const enabled = await chrome.runtime.sendMessage({ action: 'enableSite', site: pattern, tabId: activeTab.id });
      if (enabled.error) throw new Error(enabled.error);
      await updateSite(); status('Highlight a price on this website to convert it.'); return;
    }
    const { enabledSites = [] } = await chrome.storage.local.get('enabledSites');
    const sites = siteEnabled ? enabledSites.filter(s => s !== pattern) : [...new Set([...enabledSites, pattern])];
    if (sites.length > 100) throw new Error('Remove a highlighting site in Settings before adding another.');
    await chrome.storage.local.set({ enabledSites: sites });
    if (siteEnabled && (!config.useProxy || QCSettings.sitePattern(config.proxyURL) !== pattern)) {
      await chrome.permissions.remove({ origins: [pattern] });
    }
    const response = await chrome.runtime.sendMessage({ action: 'activateSite' });
    if (response.error) throw new Error(response.error);
    await updateSite(); status(siteEnabled ? 'Highlight a price on this website to convert it.' : 'Automatic highlighting is off on this site.');
  } catch (error) { status(error.message || 'Could not change site highlighting.', true); }
});
async function init() {
  config = QCSettings.clean(await chrome.storage.sync.get(null));
  $('from').value = config.sourceCurrency; $('to').value = config.targetCurrency; favorites();
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pattern = QCSettings.sitePattern(activeTab?.url); await updateSite();
  try {
    let text;
    if (new URLSearchParams(location.search).has('selection')) {
      const { contextSelection } = await chrome.storage.session.get('contextSelection'); text = contextSelection?.text;
    } else if (activeTab?.id) {
      const selected = await chrome.runtime.sendMessage({ action: 'selection', tabId: activeTab.id }); text = selected.text;
    }
    if (text && QC.parseCurrency(text, config)) { $('amount').value = text; await convert(); }
  } catch { /* Manual entry is available on restricted pages. */ }
  $('amount').focus();
}
init().catch(() => status('Could not load settings. Close and reopen QuickCurrency.', true));
