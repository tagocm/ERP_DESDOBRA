import { Page, ConsoleMessage } from '@playwright/test';

/**
 * ConsoleMonitor tracks console errors and warnings during tests
 * to detect setState after unmount and other critical issues.
 */
export class ConsoleMonitor {
    private errors: ConsoleMessage[] = [];
    private warnings: ConsoleMessage[] = [];
    private criticalWarnings: ConsoleMessage[] = [];

    constructor(private page: Page) {
        this.setup();
    }

    private setup() {
        this.page.on('console', (msg) => {
            const text = msg.text();

            if (msg.type() === 'error') {
                // Filter out known non-critical errors
                if (!this.isKnownNonCriticalError(text)) {
                    this.errors.push(msg);
                    console.error('Console error:', text);
                }
            } else if (msg.type() === 'warning') {
                this.warnings.push(msg);

                // Track critical React warnings
                if (this.isCriticalWarning(text)) {
                    this.criticalWarnings.push(msg);
                    console.warn('Critical warning:', text);
                }
            }
        });

        this.page.on('pageerror', (error) => {
            console.error('Page error:', error.message);
        });
    }

    private isKnownNonCriticalError(text: string): boolean {
        const knownPatterns = [
            'React DevTools',
            'Download the React DevTools',
            'getaddrinfo',           // DNS/Network errors in CI
            'ENOTFOUND',             // DNS/Network errors in CI
            'node:dns',              // Server-side DNS errors logged to client
            'net::ERR_NAME_NOT_RESOLVED' // Browser DNS errors
        ];

        return knownPatterns.some(pattern => text.includes(pattern));
    }

    private isCriticalWarning(text: string): boolean {
        const criticalPatterns = [
            'setState',
            'unmounted',
            'memory leak',
            'act(',
            'useEffect',
        ];

        return criticalPatterns.some(pattern => text.toLowerCase().includes(pattern.toLowerCase()));
    }

    /**
     * Get all console errors captured
     */
    getErrors(): ConsoleMessage[] {
        return this.errors;
    }

    /**
     * Get all console warnings captured
     */
    getWarnings(): ConsoleMessage[] {
        return this.warnings;
    }

    /**
     * Get critical warnings (React-related issues)
     */
    getCriticalWarnings(): ConsoleMessage[] {
        return this.criticalWarnings;
    }

    /**
     * Check if there are any setState after unmount warnings
     */
    hasSetStateAfterUnmountError(): boolean {
        return this.criticalWarnings.some(w => {
            const text = w.text().toLowerCase();
            return (text.includes('setstate') || text.includes('state update')) &&
                text.includes('unmounted');
        });
    }

    /**
     * Check if there are any memory leak warnings
     */
    hasMemoryLeakWarning(): boolean {
        return this.criticalWarnings.some(w =>
            w.text().toLowerCase().includes('memory leak')
        );
    }

    /**
     * Get a summary of all issues
     */
    getSummary() {
        return {
            errors: this.errors.length,
            warnings: this.warnings.length,
            criticalWarnings: this.criticalWarnings.length,
            hasSetStateAfterUnmount: this.hasSetStateAfterUnmountError(),
            hasMemoryLeak: this.hasMemoryLeakWarning(),
        };
    }

    /**
     * Print summary to console
     */
    printSummary() {
        const summary = this.getSummary();
        console.log('Console Monitor Summary:', summary);

        if (summary.criticalWarnings > 0) {
            console.log('Critical warnings:');
            this.criticalWarnings.forEach(w => console.log('  -', w.text()));
        }
    }
}
