import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { ItemPackaging } from "@/types/product";
import { cn } from "@/lib/utils";

interface PackagingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (packaging: Partial<ItemPackaging>) => void;
    initialData?: Partial<ItemPackaging>;
    baseUom: string;
}

const PACKAGING_TYPES = [
    { value: 'BOX', label: 'Caixa' },
    { value: 'PACK', label: 'Pacote' },
    { value: 'BALE', label: 'Fardo' },
    { value: 'PALLET', label: 'Pallet' },
    { value: 'OTHER', label: 'Outro' }
];

export function PackagingModal({ isOpen, onClose, onSave, initialData, baseUom }: PackagingModalProps) {
    const [formData, setFormData] = useState<Partial<ItemPackaging>>({
        type: 'BOX',
        label: '',
        qty_in_base: 1,
        gtin_ean: '',
        net_weight_g: 0,
        gross_weight_g: 0,
        height_cm: 0,
        width_cm: 0,
        length_cm: 0,
        is_active: true,
        is_default_sales_unit: false
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    net_weight_g: initialData.net_weight_g || 0,
                    gross_weight_g: initialData.gross_weight_g || 0,
                    height_cm: initialData.height_cm || 0,
                    width_cm: initialData.width_cm || 0,
                    length_cm: initialData.length_cm || 0
                });
            } else {
                setFormData({
                    type: 'BOX',
                    label: '',
                    qty_in_base: 1,
                    gtin_ean: '',
                    net_weight_g: 0,
                    gross_weight_g: 0,
                    height_cm: 0,
                    width_cm: 0,
                    length_cm: 0,
                    is_active: true,
                    is_default_sales_unit: false
                });
            }
            setErrors({});
        }
    }, [isOpen, initialData]);

    // Auto-suggest label
    useEffect(() => {
        if (!initialData && formData.type && formData.qty_in_base && baseUom) {
            const typeLabel = PACKAGING_TYPES.find(t => t.value === formData.type)?.label;
            if (typeLabel && (!formData.label || formData.label.includes(typeLabel))) {
                setFormData(prev => ({
                    ...prev,
                    label: `${typeLabel} ${formData.qty_in_base}x${baseUom}`
                }));
            }
        }
    }, [formData.type, formData.qty_in_base, baseUom, initialData]);

    const handleChange = (field: keyof ItemPackaging, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSave = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.label?.trim()) newErrors.label = "Rótulo é obrigatório";
        if (!formData.qty_in_base || formData.qty_in_base <= 0) newErrors.qty_in_base = "Quantidade deve ser maior que 0";

        if (formData.gtin_ean) {
            const len = formData.gtin_ean.length;
            if (![8, 12, 13, 14].includes(len) && /^\d+$/.test(formData.gtin_ean)) {
                newErrors.gtin_ean = "GTIN deve ter 8, 12, 13 ou 14 dígitos";
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSave(formData);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[500px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-none shadow-2xl">
                {/* Header Compact */}
                <div className="bg-white px-6 py-3 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
                            {initialData ? 'Editar Embalagem' : 'Nova Embalagem'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-gray-500 mt-0.5">
                            Dados para logística e automação.
                        </DialogDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[80vh]">
                    <div className="grid grid-cols-12 gap-4">
                        {/* Row 1: Tipo + Quantidade */}
                        <div className="col-span-12 md:col-span-8 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tipo *</Label>
                            <Select
                                value={formData.type}
                                onValueChange={(val) => handleChange('type', val)}
                            >
                                <SelectTrigger className="w-full h-9 rounded-xl bg-white border-gray-200">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {PACKAGING_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-12 md:col-span-4 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Qtd Base ({baseUom}) *</Label>
                            <Input
                                type="number"
                                min="0.001"
                                step="any"
                                value={formData.qty_in_base ?? ''}
                                onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                    handleChange('qty_in_base', val);
                                }}
                                className={cn(
                                    "h-9 rounded-xl bg-white border-gray-200 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    errors.qty_in_base && "border-red-500 ring-red-500/10"
                                )}
                            />
                        </div>

                        {/* Row 2: Rótulo */}
                        <div className="col-span-12 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rótulo / Descrição *</Label>
                            <Input
                                value={formData.label}
                                onChange={(e) => handleChange('label', e.target.value)}
                                placeholder="Ex: Caixa 12x1kg"
                                className={cn(
                                    "h-9 rounded-xl bg-white border-gray-200",
                                    errors.label && "border-red-500 ring-red-500/10"
                                )}
                            />
                            {errors.label && <p className="text-[10px] text-red-500 font-medium px-1 mt-0.5">{errors.label}</p>}
                        </div>

                        {/* Row 3: GTIN/EAN + Checkboxes */}
                        <div className="col-span-12 md:col-span-7 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">GTIN/EAN</Label>
                            <Input
                                value={formData.gtin_ean || ''}
                                onChange={(e) => handleChange('gtin_ean', e.target.value.replace(/\D/g, ''))}
                                placeholder="8, 12, 13 ou 14 dígitos"
                                maxLength={14}
                                className={cn(
                                    "h-9 rounded-xl bg-white border-gray-200",
                                    errors.gtin_ean && "border-red-500 ring-red-500/10"
                                )}
                            />
                            {errors.gtin_ean && <p className="text-[10px] text-red-500 font-medium px-1 mt-0.5">{errors.gtin_ean}</p>}
                        </div>

                        <div className="col-span-12 md:col-span-5 flex items-center gap-4 pt-5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.is_default_sales_unit}
                                    onChange={(e) => handleChange('is_default_sales_unit', e.target.checked)}
                                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 transition-all cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight group-hover:text-gray-900 transition-colors">Padrão</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => handleChange('is_active', e.target.checked)}
                                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300 transition-all cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight group-hover:text-gray-900 transition-colors">Ativo</span>
                            </label>
                        </div>

                        {/* Divider Compact */}
                        <div className="col-span-12 py-1">
                            <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-gray-200/60"></div>
                                <span className="text-[9px] uppercase tracking-[0.2em] font-black text-gray-300">Dimensões e Pesos</span>
                                <div className="h-px flex-1 bg-gray-200/60"></div>
                            </div>
                        </div>

                        {/* Row 4: Dimensões Compact */}
                        <div className="col-span-4 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Alt. (cm)</Label>
                            <DecimalInput
                                value={formData.height_cm}
                                onChange={(val) => handleChange('height_cm', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-xl bg-white border-gray-200 text-right"
                            />
                        </div>

                        <div className="col-span-4 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Larg. (cm)</Label>
                            <DecimalInput
                                value={formData.width_cm}
                                onChange={(val) => handleChange('width_cm', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-xl bg-white border-gray-200 text-right"
                            />
                        </div>

                        <div className="col-span-4 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comp. (cm)</Label>
                            <DecimalInput
                                value={formData.length_cm}
                                onChange={(val) => handleChange('length_cm', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-xl bg-white border-gray-200 text-right"
                            />
                        </div>

                        {/* Row 5: Pesos Compact */}
                        <div className="col-span-6 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">P. Líquido (g)</Label>
                            <DecimalInput
                                value={formData.net_weight_g}
                                onChange={(val) => handleChange('net_weight_g', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-xl bg-white border-gray-200 text-right font-medium"
                            />
                        </div>

                        <div className="col-span-6 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">P. Bruto (g)</Label>
                            <DecimalInput
                                value={formData.gross_weight_g}
                                onChange={(val) => handleChange('gross_weight_g', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-xl bg-white border-gray-200 text-right font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Sticky Compact */}
                <div className="bg-white px-6 py-3 border-t border-gray-100 flex gap-3 sticky bottom-0 z-10">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-[2] h-10 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/20 active:scale-[0.98] transition-all"
                    >
                        Salvar Embalagem
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
