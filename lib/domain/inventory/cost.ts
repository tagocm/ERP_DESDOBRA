
/**
 * Calculates the new average cost based on incoming stock.
 * Formula: (CurrentValue + IncomingValue) / TotalQuantity
 * 
 * @param currentStock Current quantity in stock
 * @param currentAvgCost Current average cost per unit
 * @param qtyIn Quantity being added
 * @param unitCost Cost per unit of the incoming quantity
 * @returns The new average cost
 */
export function calculateNewAverageCost(
    currentStock: number,
    currentAvgCost: number,
    qtyIn: number,
    unitCost: number
): number {
    const newStock = currentStock + qtyIn;

    // Prevent division by zero or negative stock handling
    if (newStock <= 0) {
        return 0;
    }

    const currentValue = currentStock * currentAvgCost;
    const incomingValue = qtyIn * unitCost;

    const newAvgCost = (currentValue + incomingValue) / newStock;

    // Round to 4 decimal places for precision
    return Math.round(newAvgCost * 10000) / 10000;
}
