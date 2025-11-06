# QuickCurrency Installation Guide

Complete step-by-step instructions for installing and configuring the QuickCurrency browser extension.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Configuration](#configuration)
4. [Raspberry Pi Proxy Setup](#raspberry-pi-proxy-setup)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Chromium-based browser (Chrome 88+, Edge 88+, Brave, Opera, Comet Browser)
- Basic knowledge of file management
- (Optional) Raspberry Pi for local proxy

---

## Installation Methods

### Method 1: Load Unpacked Extension (Development)

This is the recommended method for testing and development.

#### Step 1: Download the Extension

```bash
# Clone the repository
git clone https://github.com/yourusername/quickcurrency.git

# Or download and extract the ZIP
# wget https://github.com/yourusername/quickcurrency/archive/refs/heads/main.zip
# unzip main.zip
```

#### Step 2: Open Extension Management

**Chrome/Chromium/Brave:**
1. Open your browser
2. Navigate to: `chrome://extensions/`
3. Or: Menu → More Tools → Extensions

**Microsoft Edge:**
1. Navigate to: `edge://extensions/`
2. Or: Menu → Extensions

**Comet Browser:**
1. Navigate to: `comet://extensions/`

**Opera:**
1. Navigate to: `opera://extensions/`

#### Step 3: Enable Developer Mode

1. Look for the "Developer mode" toggle in the top-right corner
2. Turn it **ON**

#### Step 4: Load the Extension

1. Click the **"Load unpacked"** button
2. Navigate to the `quickcurrency` folder (the one containing `manifest.json`)
3. Select the folder and click **"Select Folder"** (or equivalent)

#### Step 5: Verify Installation

You should see:
- ✓ QuickCurrency card appear in the extensions list
- ✓ Extension icon in your browser toolbar
- ✓ No error messages

**Troubleshooting**: If you see errors:
- Verify all files are present in the folder
- Check that `manifest.json` is valid JSON
- Look for syntax errors in the console

---

### Method 2: Install from Chrome Web Store (Future)

*Coming soon - this extension is not yet published to the Chrome Web Store.*

---

## Configuration

### Basic Settings

1. **Click the extension icon** in your toolbar
2. The options page will open
3. Configure the following:

#### Target Currency
- Choose your preferred currency
- Default: **GBP** (British Pound)
- Supported: GBP, USD, EUR, JPY, CNY, INR, AUD, CAD, CHF, HKD, SGD, NZD, KRW, RUB

#### Decimal Precision
- **0 decimals**: Display as `£1,234`
- **2 decimals**: Display as `£1,234.56`
- Default: **2 decimals**

#### Cache Duration
- How long to cache exchange rates
- Range: **5-60 minutes**
- Default: **15 minutes**
- Lower values = more API calls, fresher rates
- Higher values = fewer API calls, faster performance

### Advanced Settings

#### Local Proxy (Optional)

If you want to route all API requests through your own server:

1. Check **"Use Local Proxy"**
2. Enter your proxy URL in the format:
   ```
   http://<YOUR_PI_IP_OR_PROXY>/convert?from={FROM}&to={TO}&amount={AMOUNT}
   ```
3. Placeholders `{FROM}`, `{TO}`, `{AMOUNT}` will be replaced automatically
4. See [Raspberry Pi Proxy Setup](#raspberry-pi-proxy-setup) below

#### Save Settings

1. Click **"Save Settings"** button
2. You should see: "Settings saved successfully! ✓"

#### Clear Cache

- Click **"Clear Cache"** to force fresh rate fetches
- Useful if you think rates are stale

---

## Raspberry Pi Proxy Setup

Run currency conversions through your own Raspberry Pi for maximum privacy.

### Why Use a Local Proxy?

- ✓ Complete data sovereignty
- ✓ No external API rate limits
- ✓ Works even if public APIs are down
- ✓ Faster response times on local network
- ✓ Cached rates persist across browser sessions

### Requirements

- Raspberry Pi (any model with network)
- Raspbian/Raspberry Pi OS installed
- Python 3.7+
- Same network as your computer

### Installation Steps

#### 1. Prepare Your Pi

SSH into your Raspberry Pi or open a terminal:

```bash
ssh pi@raspberrypi.local
# Default password: raspberry (change this!)
```

#### 2. Install Dependencies

```bash
sudo apt update
sudo apt install python3-pip -y
pip3 install flask requests
```

#### 3. Create the Proxy Script

```bash
nano ~/quickcurrency-proxy.py
```

Paste the contents of `proxy.py` (see repo), then save:
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

#### 4. Make it Executable

```bash
chmod +x ~/quickcurrency-proxy.py
```

#### 5. Run the Proxy

```bash
python3 ~/quickcurrency-proxy.py
```

You should see:
```
============================================================
QuickCurrency Proxy Server
============================================================
TTL: 900s (15.0 minutes)
Primary API: https://api.frankfurter.dev/latest
Fallback API: https://api.exchangerate.host/convert
============================================================
Starting server on http://0.0.0.0:5000
============================================================
```

#### 6. Test the Proxy

From another terminal or computer on the same network:

```bash
# Replace <YOUR_PI_IP_OR_PROXY> with your Pi's IP
curl "http://<YOUR_PI_IP_OR_PROXY>/convert?from=USD&to=GBP&amount=100"
```

Expected response:
```json
{
  "cached": false,
  "from": "USD",
  "result": 79.234,
  "source": "frankfurter",
  "to": "GBP"
}
```

#### 7. Find Your Pi's IP Address

If you don't know your Pi's IP:

```bash
hostname -I
```

Example output: `<YOUR_PI_IP> 2001:db8::1`  
Use the first IP (IPv4): `<YOUR_PI_IP>`

#### 8. Configure the Extension

1. Open QuickCurrency settings
2. Enable "Use Local Proxy"
3. Enter:
   ```
   http://<YOUR_PI_IP_OR_PROXY>/convert?from={FROM}&to={TO}&amount={AMOUNT}
   ```
   (Replace `<YOUR_PI_IP_OR_PROXY>` with your Pi's IP)
4. Click "Save Settings"

#### 9. Run Proxy on Startup (Optional)

To make the proxy start automatically when your Pi boots:

```bash
# Create a systemd service
sudo nano /etc/systemd/system/quickcurrency.service
```

Paste:
```ini
[Unit]
Description=QuickCurrency Proxy Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/quickcurrency-proxy.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save and enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable quickcurrency.service
sudo systemctl start quickcurrency.service
```

Check status:
```bash
sudo systemctl status quickcurrency.service
```

View logs:
```bash
sudo journalctl -u quickcurrency.service -f
```

---

## Troubleshooting

### Extension Not Loading

**Symptom**: Extension card shows errors in `chrome://extensions/`

**Solutions**:
1. Verify all files exist in the folder
2. Check `manifest.json` syntax (use a JSON validator)
3. Reload the extension: Click the refresh icon
4. Check browser console (F12) for JavaScript errors

---

### Tooltip Not Appearing

**Symptom**: Highlighting currency text doesn't show tooltip

**Solutions**:

1. **Wait 700ms**: The debounce delay is intentional
2. **Check format**: Ensure text matches supported patterns
   - ✓ `$1,234`
   - ✓ `USD 1234`
   - ✗ `1234` (no currency indicator)
3. **Console errors**: Open DevTools (F12) → Console tab
4. **Same currency**: Extension doesn't convert to same currency (e.g., GBP → GBP)
5. **CSP restrictions**: Some sites block content scripts (see below)

---

### CSP/Iframe Restrictions

**Symptom**: Extension works on some sites but not others

**Explanation**: Some sites use Content Security Policy (CSP) or sandboxed iframes that prevent content scripts.

**Affected Sites**:
- PDF files viewed in browser
- Sites with strict CSP (banks, government)
- Sandboxed iframes

**Workarounds**:
1. Future feature: Manual conversion via toolbar icon
2. Copy text to test.html and highlight there
3. Disable CSP (not recommended): Chrome flag `--disable-web-security`

---

### API Errors

**Symptom**: "Could not fetch rates" error in console

**Solutions**:

1. **Check internet**: Ensure you're connected
2. **API down**: Try visiting [https://api.frankfurter.dev/latest](https://api.frankfurter.dev/latest)
3. **Firewall**: Check if your firewall blocks API requests
4. **Rate limits**: Public APIs have limits (proxy avoids this)
5. **Clear cache**: Settings → Clear Cache

---

### Proxy Connection Failed

**Symptom**: "Could not fetch rates" when proxy is enabled

**Solutions**:

1. **Verify Pi is running**:
   ```bash
   curl http://<YOUR_PI_IP_OR_PROXY>/health
   ```
2. **Check IP address**: Ensure correct IP in settings
3. **Firewall**: Check Pi's firewall (ufw)
4. **Network**: Ensure Pi and computer are on same network
5. **Logs**: Check Pi terminal for error messages

---

### Permission Errors

**Symptom**: "Cannot read property of undefined" errors

**Solution**: Reload the extension:
1. Go to `chrome://extensions/`
2. Click the refresh icon on QuickCurrency
3. Reload the test page

---

### Performance Issues

**Symptom**: Slow tooltip appearance or browser lag

**Solutions**:

1. **Increase cache TTL**: Settings → Cache Duration → 60 minutes
2. **Use proxy**: Local proxy is faster than public APIs
3. **Reduce precision**: Settings → Decimal Precision → 0
4. **Disable on heavy pages**: Click extension icon → Disable for this site

---

## Support

If you encounter issues not covered here:

1. Check the [README.md](README.md) for general info
2. Review the test page: `test.html`
3. Open DevTools (F12) and check for console errors
4. Open a GitHub issue with:
   - Browser version
   - Extension version
   - Error messages
   - Steps to reproduce

---

**Happy converting!** 💱
