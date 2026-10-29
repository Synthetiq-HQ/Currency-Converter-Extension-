/* Event-driven selection overlay. Runs only on chosen sites or a right-click. */
(function () {
  'use strict';
  const key = '__quickCurrencyOverlayV2';
  if (globalThis[key]) { globalThis[key].refresh(); return; }
  let config = QCSettings.defaults;
  let enabled = false;
  let listeners;
  let overlay;
  let overlayEvents;
  let timer;
  let generation = 0;
  const selectionText = () => {
    const el = document.activeElement;
    if (el?.matches('input,textarea,[contenteditable]:not([contenteditable="false"])')) return '';
    const selection = window.getSelection();
    if (selection?.anchorNode?.parentElement?.closest('[contenteditable]:not([contenteditable="false"])')) return '';
    return selection?.toString() || '';
  };
  function hide() {
    generation++;
    clearTimeout(timer);
    overlay?.remove(); overlay = null;
    overlayEvents?.abort(); overlayEvents = null;
  }
  function show(rect, text) {
    overlay?.remove(); overlayEvents?.abort();
    overlayEvents = new AbortController();
    const host = document.createElement('div');
    host.setAttribute('data-quickcurrency', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;z-index:2147483647!important;display:block!important;max-width:calc(100vw - 16px)!important;';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{color-scheme:light dark}*{box-sizing:border-box}.card{font:14px/1.4 system-ui,sans-serif;background:#122b29;color:#f5fbfa;padding:12px 14px;border:1px solid #345650;border-radius:13px;box-shadow:0 8px 30px #0003;max-width:min(330px,calc(100vw - 16px));overflow-wrap:anywhere}.original{font-size:11px;color:#c3d7d3;margin-bottom:3px}.result{font-weight:650;display:inline}.copy{margin-left:12px;background:#234a44;color:white;border:1px solid #4a6f69;border-radius:6px;padding:4px 8px;cursor:pointer}.copy:focus-visible{outline:2px solid #9ce4c9}.note{font-size:10px;color:#c3d7d3;margin-top:5px}a{color:inherit}`;
    const card = document.createElement('div'); card.className = 'card'; card.setAttribute('role', 'status');
    const original = document.createElement('div'); original.className = 'original'; original.textContent = text;
    const result = document.createElement('span'); result.className = 'result'; result.textContent = 'Converting…';
    const copy = document.createElement('button'); copy.className = 'copy'; copy.textContent = 'Copy'; copy.hidden = true;
    copy.setAttribute('aria-label', 'Copy converted amount');
    copy.addEventListener('pointerdown', e => e.preventDefault());
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(result.textContent.replace(/^≈ /, '')); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Try popup'; }
    });
    const note = document.createElement('div'); note.className = 'note'; note.hidden = true;
    card.append(original, result, copy, note); shadow.append(style, card);
    (document.documentElement || document.body).append(host); overlay = host;
    function position() {
      if (!host.isConnected) return;
      const size = host.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - size.width / 2, innerWidth - size.width - 8));
      const preferred = rect.top - size.height - 8;
      const top = Math.max(8, Math.min(preferred >= 8 ? preferred : rect.bottom + 8, innerHeight - size.height - 8));
      host.style.setProperty('left', `${left}px`, 'important'); host.style.setProperty('top', `${top}px`, 'important');
    }
    position();
    const opts = { capture: true, signal: overlayEvents.signal };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, opts);
    document.addEventListener('pointerdown', e => { if (!e.composedPath().includes(host)) hide(); }, opts);
    document.addEventListener('scroll', hide, { ...opts, passive: true });
    window.addEventListener('resize', hide, opts);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); }, opts);
    return { result, copy, note, position };
  }
  async function convert(text, force = false) {
    const token = ++generation;
    const parsed = QC.parseCurrency(text, config);
    if (!parsed || (!force && parsed.currency === config.targetCurrency)) { hide(); return; }
    const selection = window.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : { left: 20, top: 70, bottom: 70, width: 0 };
    const ui = show(rect, QC.format(parsed.amount, parsed.currency, config.precision));
    try {
      const response = await chrome.runtime.sendMessage({ action: 'convert', from: parsed.currency, to: config.targetCurrency, amount: parsed.amount });
      if (token !== generation || !overlay?.isConnected) return;
      if (response.error) throw new Error(response.error);
      ui.result.textContent = `≈ ${QC.format(response.result, config.targetCurrency, config.precision)}`;
      ui.copy.hidden = false;
      if (response.provider === 'exchangerate-api') {
        const link = document.createElement('a'); link.href = 'https://www.exchangerate-api.com';
        link.textContent = 'Rates by ExchangeRate-API'; link.target = '_blank'; link.rel = 'noopener noreferrer';
        ui.note.append(link); ui.note.hidden = false;
      }
      ui.position();
    } catch (error) {
      if (token !== generation || !overlay?.isConnected) return;
      ui.result.textContent = error.message || 'Conversion unavailable. Open QuickCurrency to retry.';
      ui.position();
    }
  }
  function changed() {
    // A newer selection always supersedes an outstanding request.
    hide();
    if (!enabled || document.hidden) return;
    const text = selectionText();
    if (!text || text.length > 512) return;
    timer = setTimeout(() => convert(text), 300);
  }
  let refreshGeneration = 0;
  async function refresh() {
    const current = ++refreshGeneration;
    try {
      const [values, state] = await Promise.all([
        chrome.storage.sync.get(null), chrome.runtime.sendMessage({ action: 'siteState' })
      ]);
      if (current !== refreshGeneration) return;
      config = QCSettings.clean(values);
      enabled = state.enabled === true;
      listeners?.abort(); listeners = null; hide();
      if (enabled) {
        listeners = new AbortController();
        const options = { capture: true, signal: listeners.signal };
        document.addEventListener('selectionchange', changed, options);
        document.addEventListener('pointerup', changed, options);
      }
    } catch { enabled = false; listeners?.abort(); hide(); }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.action === 'sitesChanged') { refresh(); return false; }
    if (message.action === 'forceConvertSelection') {
      chrome.storage.sync.get(null).then(values => { config = QCSettings.clean(values); return convert(message.text, true); });
      respond({ success: true });
    }
    return false;
  });
  chrome.storage.onChanged.addListener((_changes, area) => { if (area === 'sync') refresh(); });
  globalThis[key] = { refresh };
  refresh();
})();
