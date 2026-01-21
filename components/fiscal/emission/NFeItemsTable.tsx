import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { CardHeaderStandard } from '@/components/ui/CardHeaderStandard';
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NFeItem } from '@/lib/fiscal/nfe-emission-actions';
import { formatCurrency } from '@/lib/utils';
import { DecimalInput } from '@/components/ui/DecimalInput';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';

interface Props {
    items: NFeItem[];
    totals: {
        products: number;
        discount: number;
        freight: number;
        insurance: number;
        others: number;
        total: number;
    };
    availableUoms?: string[];
    onUpdateItem: (index: number, field: keyof NFeItem, value: any) => void;
}

export function NFeItemsTable({ items, totals, availableUoms = [], onUpdateItem }: Props) {
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    const toggleRow = (idx: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(idx)) {
            newSet.delete(idx);
        } else {
            newSet.add(idx);
        }
        setExpandedRows(newSet);
    };

    // Formatting helper
    const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

    return (
        <Card>
            <CardHeaderStandard
                title="Itens da Nota"
                description="Produtos e regras fiscais"
                icon={<Package className="w-5 h-5 text-gray-500" />}
            />
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead className="min-w-[200px]">Produto / Descrição</TableHead>
                                <TableHead className="w-[140px] text-center">NCM</TableHead>
                                <TableHead className="w-[100px] text-center">CFOP</TableHead>
                                <TableHead className="w-[100px] text-center">Unid.</TableHead>
                                <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                <TableHead className="w-[120px] text-center">Valor Unit.</TableHead>
                                <TableHead className="w-[100px] text-center">Desc.</TableHead>
                                <TableHead className="w-[120px] text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, idx) => (
                                <React.Fragment key={item.id || idx}>
                                    <TableRow className="border-b-0">
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => toggleRow(idx)}
                                            >
                                                {expandedRows.has(idx) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-sm">{item.product_name}</span>
                                                <span className="text-xs text-muted-foreground">{item.product_code}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-8 text-xs font-mono text-center"
                                                value={item.ncm || ''}
                                                onChange={(e) => onUpdateItem(idx, 'ncm', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-8 text-xs font-mono text-center"
                                                value={item.cfop || ''}
                                                onChange={(e) => onUpdateItem(idx, 'cfop', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={item.uom || ''}
                                                onValueChange={(val) => onUpdateItem(idx, 'uom', val)}
                                            >
                                                <SelectTrigger className="h-8 w-[90px] mx-auto text-xs bg-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableUoms.map(u => (
                                                        <SelectItem key={u} value={u}>{u}</SelectItem>
                                                    ))}
                                                    {!availableUoms.includes(item.uom) && item.uom && (
                                                        <SelectItem value={item.uom}>{item.uom}</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                className="h-8 text-center text-sm"
                                                value={item.quantity}
                                                onChange={(e) => onUpdateItem(idx, 'quantity', Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DecimalInput
                                                precision={2}
                                                className="h-8 text-right text-sm"
                                                value={item.unit_price}
                                                onChange={(val) => onUpdateItem(idx, 'unit_price', Number(val))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DecimalInput
                                                precision={2}
                                                className="h-8 text-right text-sm"
                                                value={item.discount || 0}
                                                onChange={(val) => onUpdateItem(idx, 'discount', Number(val))}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-gray-900 bg-gray-50/50">
                                            R$ {fmt(item.total_price)}
                                        </TableCell>
                                    </TableRow>

                                    {/* Expanded Detail Row */}
                                    {expandedRows.has(idx) && (
                                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                                            <TableCell colSpan={9} className="p-4 pt-0">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border rounded-md bg-white shadow-sm">

                                                    {/* ICMS Group */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-blue-600 uppercase tracking-wide border-b pb-1">ICMS / ICMS ST</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">CST ICMS</label>
                                                                <Input
                                                                    className="h-7 text-xs"
                                                                    value={item.cst_icms || ''}
                                                                    onChange={(e) => onUpdateItem(idx, 'cst_icms', e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Base ICMS</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.icms_base || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'icms_base', Number(val))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Aliq. %</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.icms_rate || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'icms_rate', Number(val))}
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor ICMS</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs font-medium bg-gray-50"
                                                                    value={item.icms_value || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'icms_value', Number(val))}
                                                                />
                                                            </div>
                                                            {/* ST */}
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Base ST</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.icms_st_base || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'icms_st_base', Number(val))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor ST</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs font-medium bg-gray-50"
                                                                    value={item.icms_st_value || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'icms_st_value', Number(val))}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* IPI Group */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide border-b pb-1">IPI</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="col-span-2">
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">CST IPI</label>
                                                                <Input
                                                                    className="h-7 text-xs"
                                                                    value={item.cst_ipi || ''}
                                                                    onChange={(e) => onUpdateItem(idx, 'cst_ipi', e.target.value)}
                                                                    placeholder="ex: 50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Aliq. IPI</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.ipi_rate || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'ipi_rate', Number(val))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor IPI</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs font-medium bg-gray-50"
                                                                    value={item.ipi_value || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'ipi_value', Number(val))}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* PIS/COFINS Group */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide border-b pb-1">PIS / COFINS</h4>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">CST PIS</label>
                                                                <Input
                                                                    className="h-7 text-xs"
                                                                    value={item.cst_pis || ''}
                                                                    onChange={(e) => onUpdateItem(idx, 'cst_pis', e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor PIS</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.pis_value || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'pis_value', Number(val))}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">CST COFINS</label>
                                                                <Input
                                                                    className="h-7 text-xs"
                                                                    value={item.cst_cofins || ''}
                                                                    onChange={(e) => onUpdateItem(idx, 'cst_cofins', e.target.value)}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-gray-500">Valor COFINS</label>
                                                                <DecimalInput
                                                                    className="h-7 text-right text-xs"
                                                                    value={item.cofins_value || 0}
                                                                    onChange={(val) => onUpdateItem(idx, 'cofins_value', Number(val))}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Integrated Totals Section */}
                <div className="bg-gray-50 border-t border-gray-100 p-6">
                    <div className="flex flex-col md:flex-row justify-end items-end gap-6">
                        {/* Taxes Summary Block - Left Aligned in Flex (takes empty space) */}
                        <div className="mr-auto w-full md:w-auto">
                            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Imp. Aproximados (Totais)</div>
                            <div className="flex gap-6 text-sm">
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">ICMS</span>
                                    <span className="font-medium">R$ {fmt(items.reduce((acc, i) => acc + (i.icms_value || 0), 0))}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">ICMS-ST</span>
                                    <span className="font-medium">R$ {fmt(items.reduce((acc, i) => acc + (i.icms_st_value || 0), 0))}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">IPI</span>
                                    <span className="font-medium">R$ {fmt(items.reduce((acc, i) => acc + (i.ipi_value || 0), 0))}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">PIS</span>
                                    <span className="font-medium">R$ {fmt(items.reduce((acc, i) => acc + (i.pis_value || 0), 0))}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-muted-foreground text-xs">COFINS</span>
                                    <span className="font-medium">R$ {fmt(items.reduce((acc, i) => acc + (i.cofins_value || 0), 0))}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-[480px]">
                            <div className="grid grid-cols-2 gap-x-12 text-sm text-muted-foreground">
                                {/* Col 1 */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Produtos</span>
                                        <span>R$ {fmt(totals.products)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Frete</span>
                                        <span>R$ {fmt(totals.freight)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Seguro</span>
                                        <span>R$ {fmt(totals.insurance || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Outras Desp.</span>
                                        <span>R$ {fmt(totals.others)}</span>
                                    </div>
                                </div>

                                {/* Col 2 - Taxes & Discounts */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>IPI</span>
                                        <span>R$ {fmt(items.reduce((acc, i) => acc + (i.ipi_value || 0), 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ICMS ST</span>
                                        <span>R$ {fmt(items.reduce((acc, i) => acc + (i.icms_st_value || 0), 0))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Descontos</span>
                                        <span className="text-red-600">- R$ {fmt(totals.discount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-lg font-bold text-gray-900">
                                <span>Total</span>
                                <span>R$ {fmt(totals.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
