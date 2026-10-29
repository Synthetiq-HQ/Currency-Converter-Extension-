# QuickCurrency 1.2 scope

Confirmed by the owner on 29 October 2026: “just make those changes”, following the six-point review. Implemented and validated locally; GitHub review delivery in progress.

## Goal and users
Improve the existing Synthetiq currency extension for the owner's Dia browser and existing Chromium users.

## Confirmed changes
- Fix broken providers and prevent legacy cached rates contaminating the update.
- Prioritise correct recognition: regional grouping/decimals, validated ISO codes, aliases, ambiguous symbols, signed/zero amounts and Arabic/Persian digits.
- Create a converter popup with manual/pasted input, source and target, swap, favourites and copying. Move advanced settings to a separate page.
- Make highlighting event driven, with bounded requests, isolated styling, on-screen placement and cancellation of superseded results.
- Use temporary active-tab access for manual actions; persist automatic highlighting only for sites explicitly enabled by the user. Provide removal controls.
- Repair branding assets, add regression checks, update documentation and produce an installable ZIP.

## Owner's explicit exclusion
Do not focus on an explainability interface. Provider/date panels are not part of the main converter. Internally preserve dates and validate rates; show only required provider attribution and useful errors.

## Technical decisions
- Remain a plain JavaScript Manifest V3 extension; no frontend framework or runtime dependencies.
- Shared pure parser; service worker owns provider requests and cache.
- Primary: Frankfurter v2. Fallback: ExchangeRate-API open v6, with attribution when used.
- Daily reference rates remain estimates; matching Google's intraday quote is not promised. No Google scraping, paid feed, billing, account or telemetry.
- Retain existing preferences and optional proxy. An enabled proxy never silently falls back to public APIs.
- Store preferences in sync storage, rate cache and site list locally. Old cache schema is ignored.
- Bound cache to 100 pairs, deduplicate in-flight pair requests, cap concurrent requests at eight, and time out fetches.
- Chosen-site highlighting is off by default on upgrade; no blanket all-websites grant is requested.
- Main target: Dia on this Mac. Other Chromium compatibility must be distinguished from actual browser testing.

## Acceptance criteria
- Reported US/European number cases and yen/RMB aliases parse correctly; ordinary three-letter words and multiple selected prices are rejected.
- Popup supports manual input, selected text, swap, favourites, errors and copying.
- Old results cannot replace a newer selection/input; automatic detection has no polling interval and ignores fields/editors.
- Site permissions are optional and removable; manual conversion works on restricted pages.
- Live USD/GBP and SAR/GBP calls work using current provider endpoints. Network failure and stale/malformed data have deterministic tests.
- Release packaging verifies every runtime file and correctly sized icons. CI runs tests and produces the ZIP.
- Updated version is tested and loaded in Dia; GitHub changes are committed and delivered for review.

## Contributions and release
Document AI and library contributions in AI_CONTRIBUTIONS.md. Personal repo is the upstream source; organisation repo currently syncs from it. Preserve unrelated files and do not publish to the Chrome Web Store as part of this work.

## Open questions
None blocking within the approved scope. Broader currency coverage, paid live pricing and additional browsers remain future work.
