import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
                    gross_weight_g: initialData.gross_weight_g || 0
                });
            } else {
                setFormData({
                    type: 'BOX',
                    label: '',
                    qty_in_base: 1,
                    gtin_ean: '',
                    net_weight_g: 0,
                    gross_weight_g: 0,
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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Embalagem' : 'Nova Embalagem'}</DialogTitle>
                    <div className="text-sm text-gray-500">
                        Preencha os dados da embalagem abaixo.
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(val) => handleChange('type', val)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {PACKAGING_TYPES.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Quantidade na Base ({baseUom}) *</Label>
                        <Input
                            type="number"
                            min="0.001"
                            step="any"
                            value={formData.qty_in_base ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handleChange('qty_in_base', val);
                            }}
                            className={cn("text-right no-spinners", errors.qty_in_base && "border-red-500")}
                        />
                        {errors.qty_in_base && <p className="text-xs text-red-500">{errors.qty_in_base}</p>}
                    </div>

                    <div className="col-span-2 space-y-2">
                        <Label>Rótulo/Descrição *</Label>
                        <Input
                            value={formData.label}
                            onChange={(e) => handleChange('label', e.target.value)}
                            placeholder="Ex: Caixa 12x1kg"
                            className={errors.label ? "border-red-500" : ""}
                        />
                        {errors.label && <p className="text-xs text-red-500">{errors.label}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>GTIN/EAN (Embalagem)</Label>
                        <Input
                            value={formData.gtin_ean || ''}
                            onChange={(e) => handleChange('gtin_ean', e.target.value.replace(/\D/g, ''))}
                            placeholder="Opcional"
                            maxLength={14}
                            className={errors.gtin_ean ? "border-red-500" : ""}
                        />
                        {errors.gtin_ean && <p className="text-xs text-red-500">{errors.gtin_ean}</p>}
                    </div>

                    <div className="flex flex-col gap-4 mt-8">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_default_sales_unit}
                                onChange={(e) => handleChange('is_default_sales_unit', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                            />
                            <span className="text-sm font-medium text-gray-900">Padrão de Venda</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Ativo</span>
                        </label>
                    </div>

                    <div className="space-y-2">
                        <Label>Peso Líquido (g)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={formData.net_weight_g ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                handleChange('net_weight_g', val);
                            }}
                            placeholder="Opcional"
                            className="text-right no-spinners"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Peso Bruto (g)</Label>
                        <Input
                            type="number"
                            min="0"
                            value={formData.gross_weight_g ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                handleChange('gross_weight_g', val);
                            }}
                            placeholder="Opcional"
                            className="text-right no-spinners"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave}>Salvar Embalagem</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
