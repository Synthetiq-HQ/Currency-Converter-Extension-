# Release Notes

## How to Pack and Publish the Extension

### Packing for Distribution

#### Method 1: Chrome Web Store (Recommended)

1. **Prepare the Extension**:
   - Ensure all files are in the `GitHubChromeExtensions` folder
   - Verify `manifest.json` is valid
   - Test thoroughly on multiple browsers

2. **Create a ZIP file**:
   ```bash
   cd GitHubChromeExtensions
   zip -r quickcurrency-extension.zip . -x "*.git*" "*.DS_Store" "*.md" "examples/*"
   ```
   Or on Windows:
   ```powershell
   Compress-Archive -Path * -DestinationPath quickcurrency-extension.zip -Exclude "*.git*","*.DS_Store"
   ```

3. **Upload to Chrome Web Store**:
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Sign in with Google account
   - Click "New Item"
   - Upload the ZIP file
   - Fill in store listing details:
     - Name: QuickCurrency
     - Description: Instantly convert highlighted currency values
     - Category: Productivity
     - Screenshots: Add screenshots of the extension in action
     - Privacy policy: Link to your privacy policy
   - Submit for review

4. **Store Listing Requirements**:
   - Privacy policy URL (required)
   - Detailed description
   - Screenshots (at least 1, recommended 5)
   - Promotional images (optional)
   - Support site (optional)

#### Method 2: Pack as .crx (For Personal Use)

**Note**: Chrome Web Store no longer accepts .crx files. Use this method only for personal distribution.

1. **Load the extension** in `chrome://extensions/`
2. **Click "Pack extension"** button
3. **Select the extension root directory**
4. **Leave private key blank** (for first pack) or select existing .pem file
5. **Click "Pack Extension"**
6. **Distribute the .crx file** (users must enable Developer mode to install)

**Security Note**: .crx files from unknown sources may be blocked by Chrome. Chrome Web Store is the recommended distribution method.

### Publishing Checklist

Before publishing, ensure:

- [ ] All code is sanitized (no private IPs, API keys, etc.)
- [ ] manifest.json is valid JSON
- [ ] Extension works on Chrome 88+
- [ ] All permissions are justified
- [ ] Privacy policy is available
- [ ] Screenshots are prepared
- [ ] Description is clear and accurate
- [ ] Version number is updated
- [ ] Changelog is documented

### Version Numbering

Follow semantic versioning:
- **Major** (1.x.x): Breaking changes
- **Minor** (x.1.x): New features, backward compatible
- **Patch** (x.x.1): Bug fixes

Example: `1.1.0` → `1.1.1` (patch), `1.2.0` (minor), `2.0.0` (major)

### Resources

- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/devguide/)

---

**Note**: This extension uses Manifest V3 and is compatible with Chrome 88+.

