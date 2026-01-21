-- Add default_purchase_packaging_id to item_purchase_profiles
ALTER TABLE item_purchase_profiles 
ADD COLUMN default_purchase_packaging_id UUID REFERENCES item_packaging(id);
