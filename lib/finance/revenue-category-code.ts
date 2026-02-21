const REVENUE_CHILD_CODE_REGEX = /^1\.1\.(\d+)$/;

export function extractRevenueChildSuffix(code: string): number | null {
    const match = REVENUE_CHILD_CODE_REGEX.exec(code);
    if (!match) return null;

    const parsed = Number.parseInt(match[1], 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export function computeNextRevenueChildCode(lastPersistedSuffix: number, maxExistingSuffix: number): {
    nextSuffix: number;
    code: string;
} {
    const safeLast = Math.max(0, Math.trunc(lastPersistedSuffix));
    const safeMax = Math.max(0, Math.trunc(maxExistingSuffix));
    const nextSuffix = Math.max(safeLast, safeMax) + 1;

    return {
        nextSuffix,
        code: `1.1.${String(nextSuffix).padStart(2, '0')}`,
    };
}
