# E2E Test Suite - Quick Reference

## 📋 Overview

This E2E test suite validates that React Hooks lint fixes don't introduce regressions by testing critical scenarios: race conditions, unmount handling, prop synchronization, and state isolation.

**Technology:** Playwright + Next.js Dev Server

---

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests (headless)
npm run test:e2e

# Interactive UI mode (recommended for development)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through)
npm run test:e2e:debug
```

### Running Specific Tests

```bash
# Run single spec file
npx playwright test compras-recebimento.spec.ts

# Run tests matching pattern
npx playwright test --grep "race condition"

# Run specific test by title
npx playwright test --grep "should handle rapid company switching"
```

---

## 🧪 Test Specs

### 1. `compras-recebimento.spec.ts`
**What it tests:** Race conditions when rapidly switching companies

**Scenarios:**
- ✅ Rapid company switching (3 switches within 150ms)
- ✅ Final UI shows last selected company's data
- ✅ Loading state doesn't get stuck
- ✅ No console errors or setState warnings

**Key validations:**
- `ConsoleMonitor` tracks errors/warnings
- Verifies no setState after unmount
- Checks loading indicator disappears

---

### 2. `delivery-detail-drawer.spec.ts`
**What it tests:** Unmount handling and race conditions in drawer component

**Scenarios:**
- ✅ Close drawer before fetch completes (unmount during async)
- ✅ Switch between deliveries rapidly
- ✅ Multiple open/close cycles
- ✅ Data shown matches current delivery ID

**Key validations:**
- No setState after unmount warnings
- No memory leak warnings
- Correct data displayed (not stale/previous)

---

### 3. `currency-input.spec.ts`
**What it tests:** Prop synchronization when navigating between records

**Scenarios:**
- ✅ Navigate from order A to order B (different values)
- ✅ Input updates to new value
- ✅ Value consistency after focus/blur cycles
- ✅ Rapid prop changes don't cause errors

**Key validations:**
- Value updates when prop changes
- Formatted value remains consistent
- No console errors during rapid updates

---

### 4. `packaging-modal.spec.ts`
**What it tests:** State isolation between modal opens

**Scenarios:**
- ✅ New mode shows defaults
- ✅ Edit mode populates fields correctly
- ✅ Switching between items doesn't leak state
- ✅ Rapid open/close doesn't cause errors

**Key validations:**
- Default values in new mode
- Correct data in edit mode
- No state inheritance from previous opens
- No setState/memory leak warnings

---

## 🔍 Console Monitor

The `ConsoleMonitor` helper tracks console activity during tests:

```typescript
const monitor = new ConsoleMonitor(page);

// Check for issues
expect(monitor.getErrors()).toHaveLength(0);
expect(monitor.hasSetStateAfterUnmountError()).toBe(false);
expect(monitor.hasMemoryLeakWarning()).toBe(false);

// Print summary
monitor.printSummary();
```

**What it catches:**
- Console errors (excluding known non-critical)
- Console warnings (React-related)
- setState after unmount
- Memory leak warnings

---

## 🎯 Test Strategy

### API Mocking

Tests mock API responses using Playwright's route interception:

```typescript
await page.route('**/api/deliveries/*', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: '1', data: '...' })
  });
});
```

### Authentication

Tests use mock authentication cookies:

```typescript
await page.context().addCookies([{
  name: 'sb-access-token',
  value: 'mock-token',
  domain: 'localhost',
  path: '/',
}]);
```

For real auth, update `tests/e2e/helpers/auth.ts`.

---

## 🐛 Troubleshooting

### Test Fails with "Selector not found"

**Cause:** Component selectors may differ from test expectations.

**Fix:**
1. Run in headed mode: `npm run test:e2e:headed`
2. Inspect actual DOM structure
3. Update selectors in test file
4. Add `data-testid` attributes to components if needed

### "Cannot find module" errors

**Cause:** Playwright not installed or missing browsers.

**Fix:**
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Dev server won't start

**Cause:** Port 3000 already in use or dev server crash.

**Fix:**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
# Update baseURL in playwright.config.ts
```

### Tests timeout

**Cause:** Slow network, heavy page load, or selector issues.

**Fix:**
- Increase timeout in `playwright.config.ts`
- Use `{ timeout: 10000 }` on specific locators
- Check network tab for slow requests

### Mock data not working

**Cause:** Route pattern doesn't match actual API calls.

**Fix:**
1. Enable verbose logging: `DEBUG=pw:api npm run test:e2e`
2. Check actual API URL in network tab
3. Adjust route pattern (wildcards, query params)

---

## 📊 CI Integration

Tests run automatically in GitHub Actions. View results by downloading the `playwright-report` artifact from the workflow run.

---

## 🎨 Best Practices

### Writing New Tests

1. **Use ConsoleMonitor:** Always track console errors
2. **Mock APIs:** Don't rely on real data
3. **Test one thing:** Focus on specific scenario
4. **Use descriptive titles:** Clear test names
5. **Add comments:** Explain non-obvious logic

### Selectors

Prefer in order:
1. `data-testid` attributes (most stable)
2. `role` selectors (`[role="button"]`)
3. `text` content (if unique)
4. CSS selectors (last resort)

---

## ✅ Verification Checklist

Before committing changes:

- [ ] All tests pass locally: `npm run test:e2e`
- [ ] Tests run in CI (check GitHub Actions)
- [ ] No console errors in test output
- [ ] Added `data-testid` to new components if needed
