# QuickCurrency · by Synthetiq

Highlight a price or paste an amount into the popup, choose a currency and convert. Plain JavaScript, Manifest V3, no account, tracking or AI service.

## Install in Dia

1. Download the latest validated ZIP from a GitHub Actions run, or clone this repository.
2. Extract the ZIP into a permanent folder.
3. In Dia open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Open **Extensions → QuickCurrency**. Pin it through Dia's **Extensions → Pin Extensions** menu if desired.

Keep that folder in place. To update an unpacked install, replace its runtime files and click **Reload** in the extension manager. Normal unpacked installs do not automatically update from GitHub.

## Use

- Type `1234.56`, paste `€1.234,56`, or highlight `USD 100` on a webpage and open the popup.
- Choose source and target currencies. Use **Swap**, favourite target shortcuts, **Copy** or **Copy number**.
- Right-click a selected price → **Convert with QuickCurrency** for a floating result.
- For automatic floating results, open the popup on a website and select **Enable highlighting on this site**. Approve that site's browser permission. Disable it in the popup or remove it in Settings.
- Open with **Alt+Shift+C** where the browser makes that shortcut available; shortcuts can be changed in the extension manager.

Automatic highlighting starts off. It runs only on approved HTTP(S) sites, uses events rather than continuous polling, and ignores text inputs and editors. Restricted pages such as browser settings and some PDF viewers cannot host an overlay; use manual popup input there. Reload existing tabs after updating the extension.

## Recognition and preferences

US/European decimal separators, spaces/apostrophes, Indian grouping, K/M/B suffixes, Arabic/Persian digits, common currency aliases, negative amounts and zero are supported. Select one price at a time. Codes are validated; ordinary words such as “Pay 100” are not currencies.

Bare `$` defaults to USD and `¥` to JPY; both can be changed. Automatic number formatting interprets a single separator with three following digits as grouping (`1,234` or `1.234`). For prices with three decimals, choose an explicit decimal format in Settings. An explicit code, such as CAD, takes priority over a bare symbol.

## Rates and privacy

Uses [Frankfurter v2](https://frankfurter.dev/) with [ExchangeRate-API open v6](https://www.exchangerate-api.com/docs/free) as fallback. Conversions are indicative daily reference values; they can differ from Google, card providers and bank quotes. **Refresh** bypasses the local pair cache; it does not create intraday data.

Currency codes are sent to the selected provider and the amount is multiplied locally. Webpage text, exact selected amounts and browsing history are not sent to public rate providers. Providers necessarily receive network requests; consult their privacy terms. ExchangeRate-API attribution appears when its rates are used. No conversion history or telemetry is stored.

Settings use browser sync storage; the bounded rate cache and enabled sites are local. No `tabs` permission or mandatory access to all webpages is requested. See [SECURITY.md](SECURITY.md) for permissions.

An optional conversion proxy remains available in Settings. Include `{FROM}`, `{TO}` and `{AMOUNT}` placeholders. The extension requests server permission and queries a unit amount of 1. It stops on proxy failure instead of silently sending requests to public providers.

## Development and packages

Node 22 and Python 3.12+; no package installation needed:

```sh
node --test tests/*.test.js
python3 scripts/package.py
```

The packaging script checks runtime references and icon dimensions, then creates `dist/QuickCurrency-1.2.0.zip` and a SHA-256 checksum. CI runs deterministic tests and uploads a package. Live provider tests are separate from deterministic tests.

Primary repository: [kas021/Currency-Converter-Extension-](https://github.com/kas021/Currency-Converter-Extension-). The organisation copy syncs from it. Current validation limits are recorded in [TEST_PLAN.md](TEST_PLAN.md); AI and library assistance is documented in [AI_CONTRIBUTIONS.md](AI_CONTRIBUTIONS.md). MIT license.
