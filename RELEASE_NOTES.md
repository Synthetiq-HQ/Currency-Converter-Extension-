# 1.2.0 · 29 October 2026

- Repaired provider requests and replaced the outdated/key-required fallback chain.
- Replaced legacy rate cache with a bounded, provider-specific cache and shared in-flight requests.
- Unified price parsing across manual entry, selections and right-click conversion, including regional formats, yen/RMB aliases, Arabic digits, signed amounts and zero.
- Added a dedicated converter popup: source/target, swap, favourite targets, copy formatted/plain amount, refresh and keyboard shortcut.
- Moved advanced preferences into Settings while retaining existing user preferences and the optional proxy.
- Removed mandatory all-webpages injection and the tabs permission. Automatic selection highlighting is opt-in per site, with removal controls.
- Replaced polling and duplicate selection handlers with cancellable events, isolated tooltip styling and bounded placement.
- Added actual Synthetiq icons, deterministic regression checks and validated ZIP packaging in CI.

Rates remain indicative daily reference values. This release does not promise matching Google's intraday quote. See TEST_PLAN.md for verification status.
