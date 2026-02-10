import { normalizeLoadingStatus, normalizeLogisticsStatus } from '@/lib/constants/status';

export function normalizeOccurrenceType(value: string | null | undefined): string {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'CARREGAMENTO_PARCIAL' || normalized === 'PARTIAL_LOADED') return 'PARTIAL_LOADED';
    if (normalized === 'NAO_CARREGAMENTO' || normalized === 'NOT_LOADED_TOTAL') return 'NOT_LOADED_TOTAL';
    return normalized;
}

export function isRouteOrderEligibleForReturn(
    loadingStatusRaw: string | null | undefined,
    logisticsStatusRaw: string | null | undefined
): boolean {
    const loadingStatus = normalizeLoadingStatus(loadingStatusRaw);
    const logisticsStatus = normalizeLogisticsStatus(logisticsStatusRaw);
    const isLoadedForReturn = loadingStatus === 'loaded' || loadingStatus === 'partial';
    return isLoadedForReturn && logisticsStatus === 'in_route';
}
