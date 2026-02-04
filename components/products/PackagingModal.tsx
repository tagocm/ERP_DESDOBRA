import { useState, useEffect, useMemo } from "react";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { ItemPackaging } from "@/types/product";
import { cn } from "@/lib/utils";
import { PackagingTypeManagerModal } from "./PackagingTypeManagerModal";
import { getPackagingTypes } from "@/lib/data/packaging-types";
import { Settings } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

interface PackagingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (packaging: Partial<ItemPackaging>) => void;
    initialData?: Partial<ItemPackaging>;
    baseUom: string;
    baseNetWeight: number;
    baseGrossWeight: number;
}

// Default types to show while loading or if offline
const DEFAULT_TYPES = [
    { value: 'BOX', label: 'Caixa' },
    { value: 'PACK', label: 'Pacote' },
    { value: 'BALE', label: 'Fardo' },
    { value: 'PALLET', label: 'Pallet' },
    { value: 'OTHER', label: 'Outro' }
];

export function PackagingModal({ isOpen, onClose, onSave, initialData, baseUom, baseNetWeight, baseGrossWeight }: PackagingModalProps) {
    const { selectedCompany } = useCompany();
    const [types, setTypes] = useState<{ value: string, label: string }[]>(DEFAULT_TYPES);
    const [manageTypesOpen, setManageTypesOpen] = useState(false);

    // Initialize formData from initialData or defaults
    const [formData, setFormData] = useState<Partial<ItemPackaging>>(() => {
        if (initialData) {
            return {
                ...initialData,
                net_weight_kg: initialData.net_weight_kg || 0,
                gross_weight_kg: initialData.gross_weight_kg || 0,
                height_cm: initialData.height_cm || 0,
                width_cm: initialData.width_cm || 0,
                length_cm: initialData.length_cm || 0
            };
        }
        return {
            type: 'BOX',
            label: '',
            qty_in_base: 1,
            gtin_ean: '',
            net_weight_kg: 0,
            gross_weight_kg: 0,
            height_cm: 0,
            width_cm: 0,
            length_cm: 0,
            is_active: true,
            is_default_sales_unit: false
        };
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    // If editing existing packaging, weights/labels are considered manual
    const [manualWeightOverride, setManualWeightOverride] = useState(!!initialData);
    const [manualLabelOverride, setManualLabelOverride] = useState(!!initialData);

    // Load types when modal opens
    useEffect(() => {
        if (isOpen && selectedCompany?.id) {
            getPackagingTypes(selectedCompany.id).then(data => {
                if (data && data.length > 0) {
                    setTypes(data.map(t => ({ value: t.code, label: t.name })));
                }
            }).catch(console.error);
        }
    }, [isOpen, selectedCompany, manageTypesOpen]);

    // Derive calculated weights
    const calculatedWeights = useMemo(() => {
        const qty = formData.qty_in_base || 0;
        return {
            net: (baseNetWeight || 0) * qty,
            gross: (baseGrossWeight || 0) * qty
        };
    }, [formData.qty_in_base, baseNetWeight, baseGrossWeight]);

    // Derive suggested label  
    const suggestedLabel = useMemo(() => {
        if (!formData.type || !formData.qty_in_base || !baseUom) return '';
        const typeLabel = types.find(t => t.value === formData.type)?.label;
        return typeLabel ? `${typeLabel} ${formData.qty_in_base}x${baseUom}` : '';
    }, [formData.type, formData.qty_in_base, baseUom, types]);

    // Use effective values: manual override takes precedence, otherwise use calculated
    const effectiveWeights = {
        net: manualWeightOverride ? (formData.net_weight_kg ?? 0) : calculatedWeights.net,
        gross: manualWeightOverride ? (formData.gross_weight_kg ?? 0) : calculatedWeights.gross
    };

    const effectiveLabel = manualLabelOverride || initialData ? (formData.label || '') : (suggestedLabel || formData.label || '');

    const handleChange = (field: keyof ItemPackaging, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Mark as manually overridden if user edits weights or label
        if (field === 'net_weight_kg' || field === 'gross_weight_kg') {
            setManualWeightOverride(true);
        }
        if (field === 'label') {
            setManualLabelOverride(true);
        }

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
            <DialogContent className="max-w-lg w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-none shadow-float flex flex-col max-h-screen">
                {/* Header Compact */}
                <div className="bg-white px-6 py-3 border-b border-gray-100 flex justify-between items-center">
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

                <div className="flex-1 p-5 overflow-y-auto">
                    <div className="grid grid-cols-12 gap-4">
                        {/* Row 1: Tipo + Quantidade */}
                        <div className="col-span-12 md:col-span-8 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tipo *</Label>
                            <div className="flex gap-2 items-center">
                                <Select
                                    value={formData.type}
                                    onValueChange={(val) => handleChange('type', val)}
                                >
                                    <SelectTrigger className="flex-1 h-9 rounded-2xl bg-white border-gray-200">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setManageTypesOpen(true)}
                                    className="shrink-0 h-9 w-9 rounded-2xl text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                                    title="Gerenciar Tipos de Embalagem"
                                >
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </div>
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
                                    "h-9 rounded-2xl bg-white border-gray-200 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    errors.qty_in_base && "border-red-500 ring-red-500/10"
                                )}
                            />
                        </div>

                        {/* Row 2: Rótulo */}
                        <div className="col-span-12 space-y-1">
                            <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rótulo / Descrição *</Label>
                            <Input
                                value={effectiveLabel}
                                onChange={(e) => handleChange('label', e.target.value)}
                                placeholder="Ex: Caixa 12x1kg"
                                className={cn(
                                    "h-9 rounded-2xl bg-white border-gray-200",
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
                                    "h-9 rounded-2xl bg-white border-gray-200",
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
                                    className="w-4 h-4 rounded-none text-brand-600 focus:ring-brand-500 border-gray-300 transition-all cursor-pointer"
                                />
                                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-tight group-hover:text-gray-900 transition-colors">Padrão</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => handleChange('is_active', e.target.checked)}
                                    className="w-4 h-4 rounded-none text-brand-600 focus:ring-brand-500 border-gray-300 transition-all cursor-pointer"
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
                                className="h-9 rounded-2xl bg-white border-gray-200 text-right"
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
                                className="h-9 rounded-2xl bg-white border-gray-200 text-right"
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
                                className="h-9 rounded-2xl bg-white border-gray-200 text-right"
                            />
                        </div>

                        {/* Row 5: Pesos Compact */}
                        <div className="col-span-6 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">P. Líquido (KG)</Label>
                            <DecimalInput
                                value={effectiveWeights.net}
                                onChange={(val) => handleChange('net_weight_kg', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-2xl bg-white border-gray-200 text-right font-medium"
                            />
                        </div>

                        <div className="col-span-6 space-y-1">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">P. Bruto (KG)</Label>
                            <DecimalInput
                                value={effectiveWeights.gross}
                                onChange={(val) => handleChange('gross_weight_kg', val)}
                                precision={2}
                                minPrecision={0}
                                disableDecimalShift={true}
                                placeholder="0"
                                className="h-9 rounded-2xl bg-white border-gray-200 text-right font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Sticky Compact */}
                <div className="bg-white px-6 py-3 border-t border-gray-100 flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1 h-10 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold transition-all"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-[2] h-10 bg-brand-600 hover:bg-brand-700 text-white font-bold active:scale-[0.98] transition-all"
                    >
                        Salvar Embalagem
                    </Button>
                </div>
            </DialogContent>

            <PackagingTypeManagerModal open={manageTypesOpen} onOpenChange={setManageTypesOpen} />
        </Dialog>
    );
}
