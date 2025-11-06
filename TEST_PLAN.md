# QuickCurrency Test Plan

Condensed test plan for validating extension functionality.

## Quick Start

1. Load extension in `chrome://extensions/` (Developer mode)
2. Open `examples/test.html` in browser
3. Highlight currency values and verify tooltip appears
4. Check browser console (F12) for errors

## Acceptance Tests (Must Pass)

### Test 1: CN ¥ Format Detection
**Input**: `"CN ¥ 185"`  
**Expected**: Parsed as `{currency: 'CNY', amount: 185}` → Converted result ≈ Google "185 CNY to GBP"  
**Status**: ⬜

### Test 2: Total Amount Format
**Input**: `"Total Amount:CN ¥ 80.00"`  
**Expected**: Parsed as `{currency: 'CNY', amount: 80}`  
**Status**: ⬜

### Test 3: Context-Aware ¥ Detection
**Input**: `"¥ 185"` on page containing "CNY" nearby  
**Expected**: Parsed as CNY  
**Status**: ⬜

### Test 4: Default ¥ Behavior
**Input**: `"¥ 185"` on page with no CNY context  
**Expected**: Parsed as JPY by default (unless user override)  
**Status**: ⬜

### Test 5: Basic USD Detection
**Input**: `"$185.00"`  
**Expected**: Parsed as USD  
**Status**: ⬜

### Test 6: Context Menu Fallback
**Action**: Right-click selected currency → "QuickCurrency: Convert selection"  
**Expected**: Tooltip appears (works even if content script injection fails)  
**Status**: ⬜

### Test 7: Popup Selection Reading
**Action**: Highlight currency → Click extension icon  
**Expected**: Popup shows conversion of current selection  
**Status**: ⬜

## Test Cases

### Currency Formats

| Format | Example | Expected Currency |
|--------|---------|-------------------|
| ISO Code | `USD 1234` | USD |
| ISO Code | `CNY 529000` | CNY |
| Country Prefix | `CN ¥ 35.00` | CNY |
| Country Prefix | `GB £ 100` | GBP |
| Symbol | `$1,234.56` | USD |
| Symbol | `¥ 185` | JPY (default) or CNY (if context) |
| Currency Word | `185 yuan` | CNY |
| Currency Word | `500 RMB` | CNY |
| Abbreviated | `$1.2M` | USD (1,200,000) |

### AllChinaBuy Example

**Test on AllChinaBuy.com:**
1. Navigate to product page
2. Highlight price: `"CN ¥ 185.00"`
3. Verify tooltip shows CNY conversion (not USD)
4. Verify conversion matches Google "185 CNY to GBP"

## Priority Order Tests

Verify parsing priority (strict order):

1. **ISO Code** (highest priority)
   - `USD 1234` → USD
   - `CNY 529000` → CNY

2. **Country Prefix**
   - `CN ¥ 35.00` → CNY
   - `GB £ 100` → GBP

3. **Currency Words**
   - `185 yuan` → CNY
   - `500 RMB` → CNY

4. **Symbol** (with user preference)
   - `¥ 185` → JPY (default) or CNY (user setting)

## Manual Test Checklist

- [ ] Tooltip appears after ~700ms
- [ ] Tooltip shows correct conversion
- [ ] Copy button works (📋)
- [ ] Escape key dismisses tooltip
- [ ] Click outside dismisses tooltip
- [ ] Settings save and load correctly
- [ ] Context menu works
- [ ] Popup shows current selection
- [ ] Cache works (second conversion is instant)
- [ ] Proxy mode works (if configured)

## Debugging

**Open DevTools (F12) → Console** to see:
- Parser decisions: `[QuickCurrency] parseCurrency: PRIORITY X - Matched...`
- Selection info: `[QuickCurrency] getCurrentSelectionInfo: Selection: ...`
- Conversion requests: `[QuickCurrency] Converting...`

## Test Commands

### Test Parser Directly
```javascript
// In page console after selecting text:
const selection = document.getSelection().toString();
console.log('Raw selection:', JSON.stringify(selection));
```

### Verify Settings
```javascript
// In extension popup console:
chrome.storage.sync.get(['ambiguousYenDefault'], (result) => {
  console.log('Ambiguous yen default:', result.ambiguousYenDefault || 'JPY (default)');
});
```  

## Browser Compatibility

Test on:
- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Brave Browser
- ✅ Comet Browser
- ✅ Opera 74+

## Reporting Issues

When reporting test failures, include:
- Browser version
- Extension version
- Test case that failed
- Console errors
- Steps to reproduce

---

**Note**: This is a condensed test plan. See full test plan in repository for comprehensive testing scenarios.
