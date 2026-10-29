# Security and privacy

## Permissions

- storage: synchronised preferences, local rate cache and chosen highlighting sites.
- activeTab and scripting: read selected webpage text or show a result after a deliberate action.
- contextMenus: right-click conversion.
- Required host access is limited to api.frankfurter.dev and open.er-api.com for rates.
- Optional HTTP(S) host access is granted for individual highlighting sites or a configured proxy. The extension requests the specific host, not the blanket wildcard declared as the available permission scope. Browser match patterns cover all ports on that hostname.

Automatic highlighting starts disabled. It ignores fields/editors, does not poll and stops when a site is disabled. Removing a site's grant unregisters future scripts and notifies existing overlays. A proxy's permission is retained while the same host is still needed for that proxy.

Public providers receive currency codes; calculation happens locally. No analytics, conversion history or selected-text logs are shipped. No page text is interpolated as HTML. Overlay styling is isolated in a shadow root.

Proxy addresses must use HTTP(S) without embedded credentials. Browser sync may synchronise a saved proxy address; avoid putting secrets in its URL. A proxy failure stops conversion rather than bypassing the configured proxy. The optional legacy proxy.py is a development helper, not a secured public service.

## Reporting

Supported release series: 1.2.x. Report suspected vulnerabilities privately to the repository owner through an available private contact or GitHub private vulnerability reporting if enabled. Do not publish personal data, credentials or exploit details in a public issue. Response times are not guaranteed.
