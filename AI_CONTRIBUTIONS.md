# Contributions to 1.2.0

On 29 October 2026 the owner approved the currency-recognition, popup, highlighting, permission and release improvements discussed in Codex. Codex assisted with implementation, regression tests, documentation and validation. The owner deprioritised a provider/date explainability interface.

Runtime: plain JavaScript, browser extension APIs and standard Intl formatting. No third-party JavaScript runtime library, model or AI service is shipped. There is no telemetry or selection logging.

Rate data: Frankfurter v2 (https://frankfurter.dev/) with ExchangeRate-API's open endpoint (https://www.exchangerate-api.com/docs/free) as fallback. API requests contain currency codes; conversions multiply the amount locally. An optional owner-configured proxy receives a unit amount (1) to obtain the rate.

Branding: official favicon.svg from the owner's synthetic-logo skill. PNGs were rasterised without editing its geometry using CairoSVG during development; CairoSVG is not a runtime dependency. Icon source is included in assets/icon-source.svg.

Development tools: Node's built-in node:test, assert and vm modules; Python's standard library for packaging. Automated checks use deterministic mocked provider responses. The optional existing Python proxy still uses Flask and requests, supplied by the person running that helper; it is not part of the browser package. Its endpoints were repaired and its request behaviour checked with mocked dependencies. Actual browser checks and live provider results are recorded in TEST_PLAN.md.
