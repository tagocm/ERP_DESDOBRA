import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Read routes from the generated JSON file
const routesFile = path.resolve("scripts/routes.smoke.json");
const routes: string[] = JSON.parse(fs.readFileSync(routesFile, "utf-8"));

const baseURL = process.env.SMOKE_BASE_URL || "http://localhost:3000";

// Allowed status codes (including auth redirects/blocks)
const allowedStatuses = new Set([200, 302, 401, 403]);

test.describe("Smoke pages", () => {
    // Filter out problem routes or specific dynamic cases if needed
    const testRoutes = routes.filter(r =>
        !r.includes('[') && // Skip dynamic routes just in case
        r !== '/debug-routes' // specific exclusions
    );

    for (const route of testRoutes) {
        test(`GET ${route}`, async ({ page }, testInfo) => {
            const consoleErrors: string[] = [];
            const failedRequests: string[] = [];

            // Capture console errors
            page.on("console", (msg) => {
                if (msg.type() === "error") consoleErrors.push(msg.text());
            });

            // Capture failed network requests
            page.on("requestfailed", (req) => {
                // Filter out some expected failures (e.g. tracking, optional assets)
                const url = req.url();
                if (!url.includes('google-analytics') && !url.includes('sentry')) {
                    failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
                }
            });

            // Navigate
            const res = await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });

            expect(res, `Sem response em ${route}`).not.toBeNull();
            const status = res!.status();

            // Fail if status is 404 or 500
            expect(allowedStatuses.has(status), `Status ${status} em ${route}`).toBeTruthy();

            // Fail if significant errors occurred
            if (consoleErrors.length || failedRequests.length) {
                // Take screenshot on failure
                const screenshotPath = testInfo.outputPath(`fail-${route.replace(/\//g, "_")}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });

                // Attach logs
                testInfo.attach(`console-errors-${route}`, { body: consoleErrors.join("\n"), contentType: "text/plain" });
                testInfo.attach(`failed-requests-${route}`, { body: failedRequests.join("\n"), contentType: "text/plain" });

                // Assert clean console/network
                // Note: You might want to relax this for specific known issues
                expect(consoleErrors, `Console errors em ${route}`).toEqual([]);
                expect(failedRequests, `Requests falhando em ${route}`).toEqual([]);
            }
        });
    }
});
