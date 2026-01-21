-- Add sell_uom_id to item_packaging
ALTER TABLE item_packaging
ADD COLUMN sell_uom_id UUID REFERENCES uoms(id);

-- Backfill item_packaging.sell_uom_id based on type/label
-- Map 'BOX' -> 'Cx'
UPDATE item_packaging
SET sell_uom_id = (SELECT id FROM uoms WHERE abbrev ILIKE 'Cx' LIMIT 1)
WHERE type = 'BOX' AND sell_uom_id IS NULL;

-- Map 'PACK' -> 'Pc'
UPDATE item_packaging
SET sell_uom_id = (SELECT id FROM uoms WHERE abbrev ILIKE 'Pc' LIMIT 1)
WHERE type = 'PACK' AND sell_uom_id IS NULL;

-- Map 'BALE' -> 'FD' (Fardo - assume 'Fd' or 'Un' if not exists, try 'Fd' first)
-- If Fd doesn't exist, maybe 'Un'? Let's try to match label contains 'Fardo'
UPDATE item_packaging
SET sell_uom_id = (SELECT id FROM uoms WHERE abbrev ILIKE 'Fd' LIMIT 1)
WHERE type = 'BALE' AND sell_uom_id IS NULL;

-- Fallback for others: try to match label words to uom names? 
-- Too risky for SQL only. Manual Review might be needed later.

-- Backfill items.uom_id based on uom string
UPDATE items
SET uom_id = uoms.id
FROM uoms
WHERE items.uom_id IS NULL 
AND (
    items.uom ILIKE uoms.abbrev 
    OR items.uom ILIKE uoms.name
);
