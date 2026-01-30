import { Page } from '@playwright/test';

/**
 * Authentication helper for E2E tests
 * Handles login and session management
 */
export async function login(page: Page, options?: {
    email?: string;
    password?: string;
}) {
    const email = options?.email || process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = options?.password || process.env.TEST_USER_PASSWORD || 'testpassword';

    // Navigate to login page
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForURL('**/app/**', { timeout: 10000 });
}

/**
 * Check if user is already authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
    try {
        const cookies = await page.context().cookies();
        return cookies.some(cookie =>
            cookie.name.includes('session') ||
            cookie.name.includes('auth') ||
            cookie.name.includes('sb-')  // Supabase session
        );
    } catch {
        return false;
    }
}

/**
 * Ensure user is authenticated before running tests
 */
export async function ensureAuthenticated(page: Page) {
    const authenticated = await isAuthenticated(page);

    if (!authenticated) {
        await login(page);
    }
}

/**
 * Mock authentication by setting session cookies
 * Useful for bypassing login in tests
 */
export async function mockAuth(page: Page) {
    await page.context().addCookies([
        {
            name: 'sb-access-token',
            value: 'mock-token',
            domain: 'localhost',
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ]);
}
