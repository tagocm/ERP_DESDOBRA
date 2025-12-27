
"use client";

import { useState } from "react";
import { SalesOrderItem } from "@/types/sales";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { ProductSelector } from "@/components/app/ProductSelector";

interface TabItemsProps {
    orderId?: string;
    items: SalesOrderItem[];
    onChange: (items: SalesOrderItem[]) => void;
}

export function TabItems({ orderId, items, onChange }: TabItemsProps) {

    const handleAddItem = () => {
        const newItem: SalesOrderItem = {
            id: `temp-${Date.now()}`,
            document_id: orderId || '',
            item_id: '',
            quantity: 1,
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

        if (field === 'quantity' || field === 'unit_price' || field === 'discount_amount') {
            const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
            const price = Number(field === 'unit_price' ? value : item.unit_price) || 0;
            const discount = Number(field === 'discount_amount' ? value : item.discount_amount) || 0;
            item.total_amount = (qty * price) - discount;
        }

        newItems[index] = item;
        onChange(newItems);
    };

    const handleProductSelect = (index: number, product: any) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            item_id: product.id,
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
                un: product.un || 'UN'
            },
            unit_price: Number(product.price) || 0,
            quantity: 1,
            discount_amount: 0,
            total_amount: Number(product.price) || 0
        };
        onChange(newItems);
    };

    return (
        <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Produto</div>
                    <div className="col-span-1 text-center">UN</div>
                    <div className="col-span-1 text-right">Qtd</div>
                    <div className="col-span-2 text-right">Preço</div>
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
                                />
                            </div>
                            <div className="col-span-1 text-center text-sm text-gray-600">
                                {item.product?.un || 'UN'}
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    className="text-right h-8"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="number"
                                    className="text-right h-8"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItem(index, 'unit_price', e.target.value)}
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    className="text-right h-8 text-red-600"
                                    value={item.discount_amount}
                                    onChange={(e) => handleUpdateItem(index, 'discount_amount', e.target.value)}
                                />
                            </div>
                            <div className="col-span-1 text-right font-medium text-sm">
                                {item.total_amount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveItem(index)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            Nenhum item adicionado.
                        </div>
                    )}
                </div>
            </div>

            <Button variant="outline" className="w-full border-dashed" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
            </Button>

            <div className="flex justify-end p-4 bg-gray-50 rounded-lg border">
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
