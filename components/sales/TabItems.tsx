
"use client";

import { useState } from "react";
import { SalesOrderItem } from "@/types/sales";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { ProductSelector } from "@/components/app/ProductSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { createClient } from "@/lib/supabaseBrowser";

interface TabItemsProps {
    orderId?: string;
    items: SalesOrderItem[];
    onChange: (items: SalesOrderItem[]) => void;
    disabled?: boolean;
}

export function TabItems({ orderId, items, onChange, disabled }: TabItemsProps) {
    const supabase = createClient();

    const handleAddItem = () => {
        const newItem: SalesOrderItem = {
            id: `temp-${Date.now()}`,
            document_id: orderId || '',
            item_id: '',
            quantity: 1,
            qty_base: 1,
            unit_price: 0,
            discount_amount: 0,
            total_amount: 0,
            product: { id: '', name: '', un: 'UN' }
        };
        onChange([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    const handleUpdateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index], [field]: value };

        // Recalculate totals
        if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
            const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
            const price = Number(field === 'unit_price' ? value : item.unit_price) || 0;
            const discount = Number(field === 'discount_amount' ? value : item.discount_amount) || 0;
            item.total_amount = (qty * price) - discount;

            // Recalculate qty_base if specific packaging is selected
            if (field === 'quantity') {
                if (item.packaging_id) {
                    // Check if we have the packaging object loaded
                    // Ideally we should store packaging details or look it up from product.packagings
                    const pkg = item.product?.packagings?.find(p => p.id === item.packaging_id);
                    if (pkg) {
                        item.qty_base = qty * Number(pkg.qty_in_base);
                    } else {
                        item.qty_base = qty; // Fallback
                    }
                } else {
                    item.qty_base = qty;
                }
            }
        }

        newItems[index] = item;
        onChange(newItems);
    };

    const handleProductSelect = async (index: number, product: any) => {
        // Fetch packagings for this product
        const { data: packagings } = await supabase
            .from('item_packaging')
            .select('*')
            .eq('item_id', product.id)
            .eq('is_active', true)
            .order('is_default_sales_unit', { ascending: false }) // Default first
            .order('qty_in_base', { ascending: true }); // Then smallest (likely 1)

        // Resolve Default Packaging: Default -> Qty=1 -> First
        let selectedPkg = packagings?.find(p => p.is_default_sales_unit);
        if (!selectedPkg) selectedPkg = packagings?.find(p => Number(p.qty_in_base) === 1);
        if (!selectedPkg) selectedPkg = packagings?.[0];

        // Calc Price based on Factor
        const basePrice = Number(product.price) || 0;
        const factor = selectedPkg ? Number(selectedPkg.qty_in_base) : 1;
        const initialPrice = basePrice * factor;

        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            item_id: product.id,
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                un: product.un || 'UN',
                packagings: packagings || [],
                net_weight_kg_base: Number(product.net_weight_kg_base),
                net_weight_g_base: Number(product.net_weight_g_base),
                gross_weight_kg_base: Number(product.gross_weight_kg_base),
                gross_weight_g_base: Number(product.gross_weight_g_base),
                // Store base price for recals
                price_base: basePrice
            } as any, // Extending type locally for convenience if needed, or rely on product object structure
            unit_price: initialPrice,
            quantity: 1,
            qty_base: 1 * factor,
            packaging_id: selectedPkg ? selectedPkg.id : null,
            discount_amount: 0,
            total_amount: initialPrice
        };

        onChange(newItems);
    };

    const handleUnitChange = (index: number, val: string) => {
        const newItems = [...items];
        const item = newItems[index];
        const qty = Number(item.quantity) || 0;
        const currentPrice = Number(item.unit_price) || 0;

        // 1. Determine Old Factor
        let oldFactor = 1;
        if (item.packaging_id) {
            const oldPkg = item.product?.packagings?.find(p => p.id === item.packaging_id);
            if (oldPkg) oldFactor = Number(oldPkg.qty_in_base);
        }

        // 2. Determine New Factor and Packaging ID
        let newFactor = 1;
        let newPackagingId: string | null = null;

        if (val !== 'base') {
            const newPkg = item.product?.packagings?.find(p => p.id === val);
            if (newPkg) {
                newFactor = Number(newPkg.qty_in_base);
                newPackagingId = newPkg.id;
            }
        }

        // 3. Calculate New Price (Scale based on Base Unit Price inferred)
        // Avoid division by zero
        const basePrice = oldFactor > 0 ? (currentPrice / oldFactor) : 0;
        const newPrice = basePrice * newFactor;

        // 4. Update Item
        item.packaging_id = newPackagingId;
        item.qty_base = qty * newFactor;
        item.unit_price = newPrice;
        item.total_amount = (qty * newPrice) - (Number(item.discount_amount) || 0);

        newItems[index] = item;
        onChange(newItems);
    };

    return (
        <div className="space-y-4">
            <div className="border rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Produto</div>
                    <div className="col-span-2 text-center">Emb./Unid.</div>
                    <div className="col-span-1 text-right">Qtd</div>
                    <div className="col-span-1 text-right">Preço</div>
                    <div className="col-span-1 text-right">Desc.</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1"></div>
                </div>

                <div className="divide-y">
                    {items.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-gray-50 group">
                            <div className="col-span-1 text-gray-400 text-xs flex items-center justify-center">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="col-span-4">
                                <ProductSelector
                                    value={item.item_id}
                                    onChange={(prod) => handleProductSelect(index, prod)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-2 text-center text-sm text-gray-600">
                                {item.product?.packagings && item.product.packagings.length > 0 ? (
                                    <Select
                                        value={item.packaging_id || 'base'}
                                        onValueChange={(val) => handleUnitChange(index, val)}
                                        disabled={disabled}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="base">
                                                UNIDADE (1 {item.product?.un || 'UN'})
                                            </SelectItem>
                                            {item.product?.packagings?.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.label} ({Number(p.qty_in_base)} {item.product?.un || 'UN'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        {item.product?.un || 'UN'}
                                    </span>
                                )}
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    className="text-right h-8"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    className="text-right h-8"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    className="text-right h-8 text-red-600"
                                    value={item.discount_amount}
                                    onChange={(e) => handleUpdateItem(index, 'discount_amount', e.target.value)}
                                    disabled={disabled}
                                />
                            </div>
                            <div className="col-span-1 text-right font-medium text-sm">
                                {item.total_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            {!disabled && (
                                <div className="col-span-1 flex justify-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleRemoveItem(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            Nenhum item adicionado.
                        </div>
                    )}
                </div>
            </div>

            {!disabled && (
                <Button variant="outline" className="w-full border-dashed" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
                </Button>
            )}

            <div className="flex justify-end p-4 bg-gray-50 rounded-2xl border">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600 items-center">
                        <span>Subtotal Itens</span>
                        <span className="font-medium">
                            {items.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
