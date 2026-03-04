import { describe, expect, it } from "vitest";
import { calculateMovementBalance, groupInventoryLinesForPrint, toAdjustmentQuantities, type InventoryCountLine } from "@/lib/inventory/inventory-counts";

describe("inventory count adjustment rules", () => {
  it("uses qty_in - qty_out when ledger directional columns are present", () => {
    const balance = calculateMovementBalance({
      qty_in: 15,
      qty_out: 4,
      qty_base: -999,
    });

    expect(balance).toBe(11);
  });

  it("falls back to qty_base when directional columns are absent", () => {
    const balance = calculateMovementBalance({
      qty_in: null,
      qty_out: null,
      qty_base: -3.5,
    });

    expect(balance).toBe(-3.5);
  });

  it("maps positive and negative differences into ledger in/out quantities", () => {
    expect(toAdjustmentQuantities(6)).toEqual({
      qtyIn: 6,
      qtyOut: 0,
      qtyBase: 6,
    });

    expect(toAdjustmentQuantities(-2.25)).toEqual({
      qtyIn: 0,
      qtyOut: 2.25,
      qtyBase: -2.25,
    });
  });

  it("groups inventory lines by category and sorts items alphabetically", () => {
    const lines: InventoryCountLine[] = [
      {
        id: "3",
        itemId: "3",
        itemSku: "B-003",
        itemName: "Zinco",
        uom: "KG",
        itemType: "raw_material",
        systemQtyBase: 0,
        countedQtyBase: null,
        diffQtyBase: 0,
        notes: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "2",
        itemId: "2",
        itemSku: "A-001",
        itemName: "Granola Tradicional",
        uom: "UN",
        itemType: "finished_good",
        systemQtyBase: 0,
        countedQtyBase: null,
        diffQtyBase: 0,
        notes: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "4",
        itemId: "4",
        itemSku: "A-010",
        itemName: "Amêndoa",
        uom: "KG",
        itemType: "raw_material",
        systemQtyBase: 0,
        countedQtyBase: null,
        diffQtyBase: 0,
        notes: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "1",
        itemId: "1",
        itemSku: "C-100",
        itemName: "Granola a Granel",
        uom: "KG",
        itemType: "wip",
        systemQtyBase: 0,
        countedQtyBase: null,
        diffQtyBase: 0,
        notes: null,
        updatedAt: new Date().toISOString(),
      },
    ];

    const grouped = groupInventoryLinesForPrint(lines);

    expect(grouped.map((category) => category.key)).toEqual(["finished_good", "wip", "raw_material"]);
    expect(grouped[2]?.lines.map((line) => line.itemName)).toEqual(["Amêndoa", "Zinco"]);
  });
});
