# QuickCurrency Browser Extension

> Instantly convert highlighted currency values to your preferred currency. Free, fast, and privacy-friendly.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

✨ **Instant Conversion** - Highlight any currency amount and see the conversion in ~700ms  
🌍 **14+ Currencies** - GBP, USD, EUR, JPY, CNY, INR, and more  
🔒 **Privacy-First** - No tracking, no telemetry, optional local proxy  
⚡ **Smart Caching** - 15-minute default cache to minimize API calls  
🎯 **Flexible Parsing** - Detects both symbols ($, £, €, ¥) and ISO codes (USD, GBP, CNY)  
🛠️ **Raspberry Pi Proxy** - Optional local proxy for complete data sovereignty  

## Installation

### Load Unpacked in Chrome/Chromium/Comet Browser

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/quickcurrency.git
   cd quickcurrency
   ```

2. **Open Extension Management**
   - Chrome/Chromium: Navigate to `chrome://extensions/`
   - Comet Browser: Navigate to `comet://extensions/`
   - Edge: Navigate to `edge://extensions/`

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `quickcurrency` folder containing `manifest.json`

5. **Verify Installation**
   - You should see the QuickCurrency icon in your toolbar
   - Click the icon to open settings

## Usage

### Basic Usage

1. **Highlight currency text** on any webpage:
   - `$1,234.56`
   - `USD 1000`
   - `¥ 5 000`
   - `€1.2M`
   - `CN ¥ 529,000`

2. **Wait ~700ms** for the tooltip to appear above your selection

3. **Copy** the converted value by clicking the 📋 icon in the tooltip

4. **Dismiss** the tooltip by:
   - Pressing `Escape`
   - Clicking outside the tooltip
   - Changing your selection

### Supported Formats

| Format | Example | Currency |
|--------|---------|----------|
| Symbol | `$ 1,234` | USD (default) |
| Symbol | `£ 1,234.56` | GBP |
| Symbol | `¥ 5 000` | JPY (default) |
| ISO Code | `USD 1234.56` | USD |
| ISO Code | `CNY 529000` | CNY |
| Spaced | `CN ¥ 529,000` | CNY |
| Abbreviated | `$1.2M` | USD (1,200,000) |

### Settings

Click the extension icon or right-click → "Options" to configure:

- **Target Currency** - Choose your preferred currency (default: GBP)
- **Decimal Precision** - 0 or 2 decimal places
- **Cache Duration** - 5-60 minutes (default: 15)
- **Local Proxy** - Route requests through your Raspberry Pi (optional)

## Raspberry Pi Proxy (Optional)

For maximum privacy, run conversions through your own Raspberry Pi.

### Setup Instructions

1. **Install Flask on your Pi:**
   ```bash
   pip install flask requests
   ```

2. **Save the proxy script:**
   ```bash
   nano proxy.py
   ```
   Paste the contents from `proxy.py` (see below)

3. **Run the proxy:**
   ```bash
   python3 proxy.py
   ```
   The proxy will start on `http://0.0.0.0:5000`

4. **Configure the extension:**
   - Open QuickCurrency settings
   - Enable "Use Local Proxy"
   - Enter: `http://<your-pi-ip>:5000/convert?from={FROM}&to={TO}&amount={AMOUNT}`
   - Example: `http://<YOUR_PI_IP_OR_PROXY>/convert?from={FROM}&to={TO}&amount={AMOUNT}`

### proxy.py (Minimal Python Proxy)

```python
# proxy.py - Minimal currency conversion proxy for Raspberry Pi
from flask import Flask, request, jsonify
import requests
import time

app = Flask(__name__)
CACHE = {}
TTL = 60 * 15  # 15 minutes

FRANKFURTER_API = "https://api.frankfurter.dev/latest"
EXCHANGERATE_HOST_API = "https://api.exchangerate.host/convert"

@app.route("/convert")
def convert():
    from_code = request.args.get("from", "").upper()
    to_code = request.args.get("to", "GBP").upper()
    try:
        amount = float(request.args.get("amount", "1"))
    except:
        return jsonify({"error": "Invalid amount"}), 400

    key = f"{from_code}:{to_code}"
    now = time.time()

    # Check cache
    if key in CACHE and (now - CACHE[key]["ts"]) < TTL:
        rate = CACHE[key]["rate"]
        return jsonify({"result": round(rate * amount, 6), "cached": True})

    # Fetch from Frankfurter
    try:
        r = requests.get(FRANKFURTER_API, params={"from": from_code, "to": to_code}, timeout=8)
        if r.ok:
            j = r.json()
            if "rates" in j and to_code in j["rates"]:
                rate = j["rates"][to_code]
                CACHE[key] = {"rate": rate, "ts": now}
                return jsonify({"result": round(rate * amount, 6), "cached": False})
    except Exception:
        pass

    # Fallback to ExchangeRate.host
    try:
        r = requests.get(EXCHANGERATE_HOST_API, params={"from": from_code, "to": to_code, "amount": amount}, timeout=8)
        if r.ok:
            j = r.json()
            if "result" in j:
                rate = j["result"] / amount if amount != 0 else 0
                CACHE[key] = {"rate": rate, "ts": now}
                return jsonify({"result": round(j["result"], 6), "cached": False})
    except Exception:
        pass

    return jsonify({"error": "Could not fetch rates"}), 502

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

## Testing

### Manual Test Checklist

Test the following scenarios on a test page:

- [ ] **Basic symbol**: `$1,234` → Converts to GBP
- [ ] **ISO code**: `USD 1234` → Converts to GBP
- [ ] **Spaced numbers**: `¥ 5 000` → Converts correctly
- [ ] **Large numbers**: `CNY 529,000` → Handles commas
- [ ] **Decimal values**: `€1,234.56` → Preserves precision
- [ ] **Abbreviated**: `$1.2M` → Expands to 1,200,000
- [ ] **Copy to clipboard**: Click 📋 → Value copies
- [ ] **Dismiss on Escape**: Press Esc → Tooltip hides
- [ ] **Dismiss on click outside**: Click away → Tooltip hides
- [ ] **Cache works**: Same conversion twice → Second is instant
- [ ] **Proxy mode**: Enable proxy → Still works

### Debugging

**Issue**: Tooltip doesn't appear
- Check browser console (F12) for errors
- Verify selection contains currency format
- Ensure you waited ~700ms for debounce

**Issue**: "Could not fetch rates" error
- Check internet connection
- Verify API endpoints are not blocked by firewall
- Try clearing cache in settings

**Issue**: Extension doesn't load
- Verify all files are present in the folder
- Check for syntax errors in console
- Reload extension in `chrome://extensions`

**Issue**: CSP/iframe restrictions
- Some sites (PDFs, sandboxed iframes) may block content scripts
- Use the toolbar icon for manual conversion (future feature)

## Permissions Explained

| Permission | Reason |
|------------|--------|
| `storage` | Save user settings and cache exchange rates locally |
| `activeTab` | Inject content script into current page to detect selections |
| `host_permissions` (Frankfurter) | Fetch exchange rates from free ECB-based API |
| `host_permissions` (ExchangeRate.host) | Fallback API for currencies not covered by ECB |

**Privacy Note**: This extension does NOT:
- Track your browsing history
- Send page content to external servers
- Collect personal data
- Include third-party analytics

Only currency codes and amounts are sent to public APIs for conversion.

## Supported Browsers

- ✅ Google Chrome (88+)
- ✅ Chromium (88+)
- ✅ Microsoft Edge (88+)
- ✅ Brave Browser
- ✅ Comet Browser
- ✅ Opera (74+)
- ❌ Firefox (uses different extension format)

## APIs Used

This extension uses **free, keyless APIs**:

1. **Primary**: [Frankfurter](https://api.frankfurter.dev) (ECB-based, no signup)
2. **Fallback**: [ExchangeRate.host](https://api.exchangerate.host) (free tier, no key required)

Both APIs are free for personal use and do not require API keys.

## Contributing

Contributions welcome! Please open an issue or PR.

## Branding & Credits

This extension is developed by **[Synthetiq](https://github.com/Synthetiq-HQ)**.

- 🔗 [Synthetiq GitHub](https://github.com/Synthetiq-HQ)
- 💡 Built with ❤️ for privacy-conscious currency converters

## License

MIT License - see LICENSE file for details

---

**Note**: This extension is production-ready but consider it beta. Please report bugs via GitHub issues.
