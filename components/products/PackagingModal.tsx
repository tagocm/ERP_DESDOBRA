import { useState, useEffect } from "react";
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
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Embalagem' : 'Nova Embalagem'}</DialogTitle>
                    <div className="text-sm text-gray-500">
                        Preencha os dados da embalagem abaixo.
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-12 gap-3 py-4">
                    {/* Row 1: Tipo + Quantidade + Checkboxes */}
                    <div className="col-span-6 space-y-2">
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

                    <div className="col-span-3 space-y-2">
                        <Label>Qtd Base *</Label>
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
                                "text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                errors.qty_in_base && "border-red-500"
                            )}
                        />
                        {errors.qty_in_base && <p className="text-xs text-red-500">{errors.qty_in_base}</p>}
                    </div>

                    {/* Checkboxes */}
                    <div className="col-span-3 flex flex-col gap-2 justify-center pt-6">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_default_sales_unit}
                                onChange={(e) => handleChange('is_default_sales_unit', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                            />
                            <span className="text-xs font-medium text-gray-700">Padrão</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => handleChange('is_active', e.target.checked)}
                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                            />
                            <span className="text-xs text-gray-700">Ativo</span>
                        </label>
                    </div>

                    {/* Row 2: Rótulo - full width */}
                    <div className="col-span-12 space-y-2">
                        <Label>Rótulo/Descrição *</Label>
                        <Input
                            value={formData.label}
                            onChange={(e) => handleChange('label', e.target.value)}
                            placeholder="Ex: Caixa 12x1kg"
                            className={errors.label ? "border-red-500" : ""}
                        />
                        {errors.label && <p className="text-xs text-red-500">{errors.label}</p>}
                    </div>

                    {/* Row 3: GTIN/EAN */}
                    <div className="col-span-12 space-y-2">
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

                    {/* Row 4: Pesos na mesma linha */}
                    <div className="col-span-6 space-y-2">
                        <Label className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Peso Líquido (g)</Label>
                        <DecimalInput
                            value={formData.net_weight_g}
                            onChange={(val) => handleChange('net_weight_g', val)}
                            precision={3}
                            minPrecision={0}
                            disableDecimalShift={true}
                            placeholder="0"
                            className="text-right"
                        />
                    </div>

                    <div className="col-span-6 space-y-2">
                        <Label className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Peso Bruto (g)</Label>
                        <DecimalInput
                            value={formData.gross_weight_g}
                            onChange={(val) => handleChange('gross_weight_g', val)}
                            precision={3}
                            minPrecision={0}
                            disableDecimalShift={true}
                            placeholder="0"
                            className="text-right"
                        />
                    </div>

                    {/* Row 5: Dimensões - todas na mesma linha */}
                    <div className="col-span-4 space-y-2">
                        <Label className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Altura (cm)</Label>
                        <DecimalInput
                            value={formData.height_cm}
                            onChange={(val) => handleChange('height_cm', val)}
                            precision={2}
                            minPrecision={0}
                            disableDecimalShift={true}
                            placeholder="0"
                            className="text-right"
                        />
                    </div>

                    <div className="col-span-4 space-y-2">
                        <Label className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Largura (cm)</Label>
                        <DecimalInput
                            value={formData.width_cm}
                            onChange={(val) => handleChange('width_cm', val)}
                            precision={2}
                            minPrecision={0}
                            disableDecimalShift={true}
                            placeholder="0"
                            className="text-right"
                        />
                    </div>

                    <div className="col-span-4 space-y-2">
                        <Label className="text-xs whitespace-nowrap overflow-hidden text-ellipsis">Comprimento (cm)</Label>
                        <DecimalInput
                            value={formData.length_cm}
                            onChange={(val) => handleChange('length_cm', val)}
                            precision={2}
                            minPrecision={0}
                            disableDecimalShift={true}
                            placeholder="0"
                            className="text-right"
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
