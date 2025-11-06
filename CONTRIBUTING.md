# Contributing to QuickCurrency

Thank you for your interest in contributing to QuickCurrency! This document provides guidelines and instructions for contributing.

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to see if the bug has already been reported
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs. actual behavior
   - Browser version and OS
   - Extension version
   - Console errors (if any)

### Suggesting Features

1. **Open an issue** with the `enhancement` label
2. Describe the feature and its use case
3. Explain why it would be useful

### Submitting Pull Requests

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**:
   - Follow the code style (see below)
   - Add comments for complex logic
   - Update documentation if needed
4. **Test your changes**:
   - Test on multiple browsers (Chrome, Edge, Brave)
   - Test with different currency formats
   - Verify no console errors
5. **Commit your changes**:
   ```bash
   git commit -m "Add: Description of your change"
   ```
   Use clear, descriptive commit messages.
6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request**:
   - Provide a clear description
   - Reference related issues
   - Include screenshots if UI changes

## Code Style

### JavaScript

- Use ES6+ features
- Use `const` and `let` (avoid `var`)
- Use arrow functions where appropriate
- Add JSDoc comments for functions
- Use meaningful variable names
- Keep functions small and focused

### HTML/CSS

- Use semantic HTML
- Follow BEM naming for CSS classes (if applicable)
- Keep styles organized and commented

### File Structure

```
quickcurrency/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script
├── options.html          # Options page HTML
├── options.js            # Options page script
├── overlay.css           # Tooltip styles
├── proxy.py              # Optional Raspberry Pi proxy
├── test.html             # Test page
└── examples/             # Example files
```

## Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/quickcurrency.git
   cd quickcurrency
   ```

2. **Load unpacked extension**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `quickcurrency` folder

3. **Make changes** and test

4. **Reload extension** after changes:
   - Go to `chrome://extensions/`
   - Click the refresh icon on QuickCurrency

## Testing

### Manual Testing

Test the following scenarios:

- [ ] Basic currency symbols (`$1,234`, `£500`, `€100`)
- [ ] ISO codes (`USD 1234`, `CNY 529000`)
- [ ] Country prefixes (`CN ¥ 185`, `GB £ 100`)
- [ ] Currency words (`185 yuan`, `500 RMB`)
- [ ] Abbreviated values (`$1.2M`, `£500K`)
- [ ] Tooltip appears and dismisses correctly
- [ ] Copy to clipboard works
- [ ] Settings save and load correctly
- [ ] Proxy mode works (if applicable)
- [ ] Context menu works

### Test Page

Use `test.html` or `examples/test.html` for testing:

```bash
# Start a local server
python -m http.server 8000

# Open in browser
# http://localhost:8000/test.html
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

- **Add**: New feature
- **Fix**: Bug fix
- **Update**: Update existing feature
- **Remove**: Remove feature or code
- **Docs**: Documentation changes
- **Style**: Code style changes (formatting, etc.)
- **Refactor**: Code refactoring
- **Test**: Add or update tests

Examples:
```
Add: Support for Chinese Yuan (CN ¥) format
Fix: Tooltip not appearing on AllChinaBuy
Update: Improve currency parsing priority
Docs: Add CONTRIBUTING.md
```

## Pull Request Process

1. **Ensure your code follows the style guidelines**
2. **Update documentation** if you change functionality
3. **Add comments** for complex logic
4. **Test thoroughly** on multiple browsers
5. **Keep PRs focused** - one feature or fix per PR
6. **Respond to feedback** promptly

## Code Review

All PRs require review before merging. Reviewers will check:

- Code quality and style
- Functionality and testing
- Documentation updates
- Security considerations
- Performance impact

## Questions?

If you have questions, feel free to:

- Open an issue with the `question` label
- Check existing issues and discussions
- Review the README.md and INSTALL.md

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to QuickCurrency! 🎉

