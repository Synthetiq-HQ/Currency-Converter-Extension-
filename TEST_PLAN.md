# 1.2.0 validation · 29 October 2026

## Automated results
- 101 JavaScript checks passed with Node's built-in test runner.
- Five optional proxy-helper checks passed using mocked Flask/requests, without installing or deploying a server.
- Every runtime JavaScript file passed node --check; git diff --check passed.
- Package validator checked 15 runtime files, page references and icon dimensions, and generated the ZIP and SHA-256 checksum.

Coverage includes US/European grouping, Indian grouping, Unicode digits, aliases, zero/negative amounts, invalid/multiple prices; provider failover, timeouts and stale/malformed data; cache separation/restart/concurrency; site registration/removal, restricted-page recovery, popup closure during permission grants, late selection/input cancellation, manual popup/swap/copy and settings migration.

## Actual Dia checks
- Reloaded the existing unpacked extension and visibly verified version 1.2.0 enabled.
- Manual conversion works from the popup while the underlying page is chrome://extensions (a restricted page).
- `$1,234.56` converted successfully. `€1.234,56` was recognised as EUR 1,234.56.
- Browser requests successfully used the documented fallback when the primary did not complete; required attribution was displayed.
- Enabled automatic highlighting for a loopback test page. Selecting the dollar price produced a visible floating GBP conversion and Copy button.
- Opening the popup picked up that selected price.
- Swap visibly changed GBP/USD and reused the converted amount.
- Disabled the loopback site's highlighting; the popup visibly returned to Enable highlighting. The temporary site grant was removed.
- Restored USD source and GBP target after testing.

The native Dia permission dialog initially closed the popup before activation completed. That observation led to a worker-side completion fix, covered by a deterministic regression test. The final version was reloaded afterwards. Fresh permission-dialog closure after that fix has not been separately reproduced; existing-grant activation and removal were exercised in Dia.

## Live provider checks
The new rate service made live USD/GBP, SAR/GBP and EUR/GBP requests. All returned current dated Frankfurter responses. Browser and command-line requests may reach different providers/data updates. These are time-bound observations, not locked expected exchange rates.

## Limits
Other Chromium browsers, store submission and production proxy servers are not certified. Copy's plain-number behaviour and selection races have automated coverage; real clipboard contents, every website/frame combination and all UI edge positions have not been independently checked. Daily reference rates can differ from Google's intraday quote.

## Repeat checks
```
node --test tests/*.test.js
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p '*_test.py'
python3 scripts/package.py
```
The Python environment variable avoids generated __pycache__ directories, which browsers refuse inside an unpacked extension folder.
