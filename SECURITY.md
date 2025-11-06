# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send details to `<YOUR_EMAIL>` (replace with your security contact email)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature (if enabled)

### What to Include

When reporting a vulnerability, please include:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### Security Best Practices

**For Contributors:**

- Never commit API keys, tokens, or secrets to the repository
- Never commit private extension keys (`.pem` files)
- Never commit local IP addresses or internal network details
- Use environment variables for sensitive configuration
- Review code changes for security implications before submitting PRs

**For Users:**

- Review the extension's permissions before installing
- Only install from trusted sources (Chrome Web Store or this repository)
- Keep the extension updated to the latest version
- Report suspicious behavior immediately

## Known Security Considerations

### Permissions

This extension requires the following permissions:

- `storage`: Stores user settings and cached exchange rates locally
- `activeTab`: Injects content script to detect currency selections
- `tabs`: Allows popup to read current tab selection
- `scripting`: Allows fallback selection reading when content script unavailable
- `contextMenus`: Provides right-click conversion fallback
- `host_permissions`: Accesses free currency exchange APIs

**Privacy Note**: The extension does NOT:
- Track browsing history
- Send page content to external servers
- Collect personal data
- Include third-party analytics

Only currency codes and amounts are sent to public APIs for conversion.

### Content Security Policy (CSP)

Some websites use strict CSP that may prevent the extension's content script from running. This is a browser security feature, not a vulnerability in the extension.

### API Security

The extension uses free, public APIs that do not require authentication:
- [Frankfurter](https://api.frankfurter.dev) - ECB-based rates
- [ExchangeRate.host](https://api.exchangerate.host) - Free tier

These APIs are rate-limited but do not require API keys. For enhanced privacy, users can run their own proxy server (see `INSTALL.md`).

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the issue and determine affected versions
2. Audit code to find any potential similar problems
3. Prepare fixes for all supported versions
4. Publish a security advisory after fixes are available

## Credits

We thank security researchers and users who report vulnerabilities responsibly.

