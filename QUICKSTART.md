# QuickCurrency - Quick Start Guide

Get up and running in 5 minutes!

## Installation (2 minutes)

1. **Download the extension**
   - You have the `quickcurrency_extension/` folder

2. **Open Comet Browser**
   - Navigate to: `comet://extensions`
   - Or Chrome: `chrome://extensions`

3. **Enable Developer Mode**
   - Toggle switch in top-right corner

4. **Load Extension**
   - Click "Load unpacked"
   - Select the `quickcurrency_extension` folder
   - Click "Select Folder"

## First Test (1 minute)

1. **Open test.html**
   - Double-click `test.html` in the extension folder
   - Or drag it into your browser

2. **Highlight a currency value**
   - Try: "$1,234.56"
   - Wait ~700ms
   - Tooltip should appear: "≈ £987.65"

3. **Click the 📋 icon**
   - Value copies to clipboard
   - Paste somewhere to verify

## Configure Settings (2 minutes)

1. **Click extension icon** in toolbar
   - Settings page opens

2. **Set your preferences**
   - Target Currency: Choose yours (default: GBP)
   - Decimal Precision: 2 decimals recommended
   - Cache Duration: 15 minutes is good

3. **Click "Save Settings"**
   - You'll see: "Settings saved successfully! ✓"

## Test on Real Sites

Try highlighting currency values on:
- Amazon product pages
- News articles about finance
- Travel booking sites
- Cryptocurrency sites

## Keyboard Shortcuts

- **Esc** - Dismiss tooltip
- **Ctrl+C** (after clicking 📋) - Copy converted value

## Troubleshooting

**No tooltip appearing?**
- Wait 700ms (debounce delay)
- Ensure text has currency symbol or ISO code
- Check browser console (F12) for errors

**Wrong conversion?**
- Clear cache: Settings → Clear Cache
- Check target currency setting

**Extension not loading?**
- Verify all files present
- Check for errors in `comet://extensions`
- Try reloading extension (refresh icon)

## Next Steps

- [ ] Generate proper icons (see ICONS.md)
- [ ] Read full README.md for all features
- [ ] Review TEST_PLAN.md for edge cases
- [ ] (Optional) Set up Pi proxy (INSTALL.md)

## Support

Having issues? Check:
1. README.md - Full documentation
2. INSTALL.md - Detailed setup guide
3. TEST_PLAN.md - Testing scenarios
4. Browser console (F12) - Error messages

---

**You're all set! 🎉**

Start highlighting currency values on any webpage to see instant conversions.
