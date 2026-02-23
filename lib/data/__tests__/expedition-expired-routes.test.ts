import { describe, expect, it } from "vitest";

// NOTE: This test mirrors the heuristic inside checkAndCleanupExpiredRoutes()
// without requiring a live Supabase client.
function shouldResetExpiredRoute(route: { status?: string | null; orders?: Array<{ status_logistic?: string | null }> }) {
    const startedRouteStatuses = new Set(['in_route', 'in_progress', 'completed', 'cancelled', 'done', 'closed']);
    const routeStatus = String(route.status || '').toLowerCase();
    if (startedRouteStatuses.has(routeStatus)) return false;

    const orders = route.orders || [];
    if (orders.length === 0) return true;

    const hasProcessedOrders = orders.some((o) =>
        ['in_route', 'delivered', 'returned', 'partial'].includes(String(o.status_logistic || '').toLowerCase())
    );

    return !hasProcessedOrders;
}

describe("checkAndCleanupExpiredRoutes rule", () => {
    it("should NOT reset a started route even if no orders are processed", () => {
        expect(shouldResetExpiredRoute({
            status: "in_route",
            orders: [{ status_logistic: "routed" }],
        })).toBe(false);
    });

    it("should reset a non-started route with no orders", () => {
        expect(shouldResetExpiredRoute({
            status: "scheduled",
            orders: [],
        })).toBe(true);
    });

    it("should reset a non-started route when no order is processed", () => {
        expect(shouldResetExpiredRoute({
            status: "scheduled",
            orders: [{ status_logistic: "routed" }, { status_logistic: "scheduled" }],
        })).toBe(true);
    });

    it("should NOT reset a non-started route if any order is already in_route/delivered/returned/partial", () => {
        expect(shouldResetExpiredRoute({
            status: "scheduled",
            orders: [{ status_logistic: "delivered" }],
        })).toBe(false);
    });
});

