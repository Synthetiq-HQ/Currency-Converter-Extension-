'use strict';
importScripts('currency.js', 'settings.js', 'rates.js');
const rates = QCRates.create({ fetch, storage: chrome.storage.local });
let registrations = Promise.resolve();

async function settings() { return QCSettings.clean(await chrome.storage.sync.get(null)); }
async function enabledSites() {
  const { enabledSites = [] } = await chrome.storage.local.get('enabledSites');
  return Array.isArray(enabledSites) ? enabledSites.filter(s => QCSettings.sitePattern(s) === s).slice(0, 100) : [];
}
function syncScripts() {
  registrations = registrations.catch(() => {}).then(async () => {
    const sites = await enabledSites();
    const allowed = [];
    for (const site of sites) if (await chrome.permissions.contains({ origins: [site] })) allowed.push(site);
    const scripts = await chrome.scripting.getRegisteredContentScripts();
    const ids = scripts.filter(s => s.id === 'qc-highlighting').map(s => s.id);
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
    if (allowed.length) await chrome.scripting.registerContentScripts([{
      id: 'qc-highlighting', matches: allowed, js: ['currency.js', 'settings.js', 'content.js'],
      allFrames: true, persistAcrossSessions: true, runAt: 'document_idle'
    }]);
    if (allowed.length !== sites.length) await chrome.storage.local.set({ enabledSites: allowed });
    for (const tab of await chrome.tabs.query({})) {
      chrome.tabs.sendMessage(tab.id, { action: 'sitesChanged' }).catch(() => {});
    }
  });
  return registrations;
}
async function readSelection(tabId, frameId) {
  const target = frameId !== undefined ? { tabId, frameIds: [frameId] } : { tabId };
  const results = await chrome.scripting.executeScript({ target, func: () => {
    const el = document.activeElement;
    if (el?.matches('input,textarea,[contenteditable]:not([contenteditable="false"])')) return '';
    return window.getSelection()?.toString().slice(0, 512) || '';
  } });
  return results.find(r => r.result)?.result || '';
}
async function activateGrantedSite(site, tabId) {
  if (QCSettings.sitePattern(site) !== site || !Number.isInteger(tabId)) throw new Error('Invalid website');
  if (!await chrome.permissions.contains({ origins: [site] })) throw new Error('Website permission is required');
  const tab = await chrome.tabs.get(tabId);
  if (QCSettings.sitePattern(tab.url) !== site) throw new Error('The page changed. Open QuickCurrency on the website again.');
  const sites = [...new Set([...await enabledSites(), site])];
  if (sites.length > 100) throw new Error('Remove a highlighting site in Settings before adding another.');
  await chrome.storage.local.set({ enabledSites: sites });
  await syncScripts();
  await chrome.scripting.executeScript({ target: { tabId }, files: ['currency.js', 'settings.js', 'content.js'] });
  await chrome.storage.local.remove('pendingHighlighting');
  return { success: true };
}
async function handle(message, sender) {
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL(''));
  if (message.action === 'convert') {
    return rates.convert({ from: message.from, to: message.to, amount: message.amount,
      refresh: message.refresh === true && extensionPage, settings: await settings() });
  }
  if (message.action === 'siteState') {
    const site = QCSettings.sitePattern(sender.url);
    return { enabled: site !== null && (await enabledSites()).includes(site) &&
      await chrome.permissions.contains({ origins: [site] }) };
  }
  if (!extensionPage) throw new Error('Unavailable action');
  if (message.action === 'prepareSite') {
    const tab = await chrome.tabs.get(message.tabId);
    if (!message.site || QCSettings.sitePattern(tab.url) !== message.site) throw new Error('Invalid website');
    // Dia may close its popup while its native permission dialog is open.
    // The worker can complete this specific user-requested activation afterwards.
    await chrome.storage.local.set({ pendingHighlighting: { site: message.site, tabId: message.tabId, expires: Date.now() + 60000 } });
    return { success: true };
  }
  if (message.action === 'cancelSite') { await chrome.storage.local.remove('pendingHighlighting'); return { success: true }; }
  if (message.action === 'enableSite') return activateGrantedSite(message.site, message.tabId);
  if (message.action === 'clearCache') { await rates.clear(); return { success: true }; }
  if (message.action === 'selection') return { text: await readSelection(message.tabId) };
  if (message.action === 'syncSites') { await syncScripts(); return { success: true }; }
  if (message.action === 'activateSite') {
    await syncScripts();
    const sites = await enabledSites();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && sites.includes(QCSettings.sitePattern(tab.url))) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['currency.js', 'settings.js', 'content.js'] });
    }
    return { success: true };
  }
  throw new Error('Unavailable action');
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  handle(message, sender).then(sendResponse, error => sendResponse({ error: error.message || 'Conversion unavailable' }));
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove('quickcurrency_rates');
  chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({
    id: 'qc_convert_selection', title: 'Convert with QuickCurrency', contexts: ['selection']
  }));
  syncScripts().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => syncScripts().catch(() => {}));
chrome.permissions.onRemoved.addListener(() => syncScripts().catch(() => {}));
chrome.permissions.onAdded.addListener(async () => {
  const { pendingHighlighting: pending } = await chrome.storage.local.get('pendingHighlighting');
  if (!pending || pending.expires < Date.now()) return;
  try { await activateGrantedSite(pending.site, pending.tabId); }
  catch { await chrome.storage.local.remove('pendingHighlighting'); }
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'qc_convert_selection' || !tab?.id) return;
  try {
    const config = await settings();
    if (!QC.parseCurrency(info.selectionText, config)) throw new Error('Select one amount with a currency, such as USD 100.');
    await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [info.frameId || 0] },
      files: ['currency.js', 'settings.js', 'content.js'] });
    await chrome.tabs.sendMessage(tab.id, { action: 'forceConvertSelection', text: info.selectionText }, { frameId: info.frameId || 0 });
  } catch (error) {
    await chrome.storage.session.set({ contextSelection: { text: info.selectionText?.slice(0, 512) || '', error: error.message } });
    await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?selection=1') });
  }
});
