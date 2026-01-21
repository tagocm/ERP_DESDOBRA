/**
 * NFe Product Description Builder
 * 
 * Builds human-readable product descriptions for NFe with explicit unit conversion.
 * Handles xProd length limits (120 chars) and overflow to infAdProd.
 * 
 * Format Examples:
 * - No packaging: "Granola Tradicional 1kg"
 * - With packaging: "Granola Tradicional 1kg - CX 12xPC"
 * - With equivalence: "Granola Tradicional 1kg - CX 12xPC (5 CX = 60 PC)"
 */

export interface NfeDescriptionParams {
    /** Product name (required) */
    itemName: string;

    /** Commercial/packaging unit abbreviation (e.g., "CX", "FD") */
    salesUomAbbrev?: string | null;

    /** Base product unit abbreviation (e.g., "PC", "KG", "UN") */
    baseUomAbbrev?: string | null;

    /** Conversion factor: how many base units per commercial unit */
    conversionFactor?: number | null;

    /** Quantity sold in commercial units */
    qtySales?: number | null;

    /** Quantity in base units */
    qtyBase?: number | null;

    /** Packaging label (fallback if UOMs not available) */
    packagingLabel?: string | null;
}

export interface NfeDescriptionResult {
    /** Product description for xProd field (max 120 chars) */
    xProd: string;

    /** Additional info for infAdProd if xProd overflow */
    infAdProd?: string;
}

/**
 * Maximum length for xProd field in NFe schema
 */
const XPROD_MAX_LENGTH = 120;

/**
 * Builds NFe product description with explicit unit conversion
 * 
 * @param params - Description parameters
 * @returns Object with xProd and optional infAdProd
 * 
 * @example
 * ```typescript
 * const result = buildNfeProductDescription({
 *   itemName: 'Granola Tradicional 1kg',
 *   salesUomAbbrev: 'CX',
 *   baseUomAbbrev: 'PC',
 *   conversionFactor: 12,
 *   qtySales: 5,
 *   qtyBase: 60
 * });
 * // result.xProd: "Granola Tradicional 1kg - CX 12xPC (5 CX = 60 PC)"
 * ```
 */
export function buildNfeProductDescription(params: NfeDescriptionParams): NfeDescriptionResult {
    const {
        itemName,
        salesUomAbbrev,
        baseUomAbbrev,
        conversionFactor,
        qtySales,
        qtyBase,
        packagingLabel
    } = params;

    // Base case: no packaging info
    if (!salesUomAbbrev || !baseUomAbbrev || !conversionFactor) {
        return {
            xProd: truncate(itemName, XPROD_MAX_LENGTH),
            infAdProd: undefined
        };
    }

    // Build conversion label: "CX 12xPC"
    const conversionLabel = `${salesUomAbbrev} ${formatNumber(conversionFactor)}x${baseUomAbbrev}`;

    // Build base description: "{NAME} - {CONVERSION}"
    const baseDesc = `${itemName} - ${conversionLabel}`;

    // If no quantities provided or base description already too long, return as-is
    if (!qtySales || !qtyBase || baseDesc.length >= XPROD_MAX_LENGTH) {
        return {
            xProd: truncate(baseDesc, XPROD_MAX_LENGTH),
            infAdProd: undefined
        };
    }

    // Build equivalence: "(5 CX = 60 PC)"
    const equivalence = `(${formatNumber(qtySales)} ${salesUomAbbrev} = ${formatNumber(qtyBase)} ${baseUomAbbrev})`;

    // Try to fit everything in xProd
    const fullDesc = `${baseDesc} ${equivalence}`;

    if (fullDesc.length <= XPROD_MAX_LENGTH) {
        return {
            xProd: fullDesc,
            infAdProd: undefined
        };
    }

    // Overflow: keep base in xProd, move equivalence to infAdProd
    return {
        xProd: truncate(baseDesc, XPROD_MAX_LENGTH),
        infAdProd: `Equivalência: ${equivalence}`
    };
}

/**
 * Builds short unit label for snapshot storage
 * 
 * @param salesUom - Commercial unit abbreviation
 * @param factor - Conversion factor
 * @param baseUom - Base unit abbreviation
 * @returns Label like "CX 12xPC"
 */
export function buildSalesUnitLabel(
    salesUom: string,
    factor: number,
    baseUom: string
): string {
    return `${salesUom} ${formatNumber(factor)}x${baseUom}`;
}

/**
 * Resolves UOM abbreviation with fallback chain:
 * 1. From UOMs table (if uom_id exists)
 * 2. From packaging type mapping
 * 3. From legacy string field
 * 
 * @param uomFromTable - Abbreviation from uoms table
 * @param packagingType - Packaging type (BOX, PACK, etc.)
 * @param legacyUom - Legacy UOM string
 * @returns Resolved abbreviation
 */
export function resolveUomAbbrev(
    uomFromTable?: string | null,
    packagingType?: string | null,
    legacyUom?: string | null
): string {
    // Prefer UOMs table
    if (uomFromTable) return uomFromTable;

    // Fallback to packaging type mapping
    if (packagingType) {
        switch (packagingType.toUpperCase()) {
            case 'BOX': return 'CX';
            case 'PACK': return 'PC';
            case 'BALE': return 'FD';
            case 'PALLET': return 'PL';
            case 'OTHER': return 'UN';
        }
    }

    // Final fallback to legacy string or default
    return legacyUom || 'UN';
}

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Truncates string to max length, adding ellipsis if needed
 */
function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Formats number for display, removing unnecessary decimals
 */
function formatNumber(num: number): string {
    // Remove trailing zeros and unnecessary decimal point
    return num.toString().replace(/\.?0+$/, '');
}
