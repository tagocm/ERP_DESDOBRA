"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { CategorySelector } from "./CategorySelector";
import { UomSelector } from "./UomSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Tabs, TabsContent } from "@/components/ui/Tabs";
import { FormTabsList, FormTabsTrigger } from "@/components/ui/FormTabs";
import { Card, CardContent } from "@/components/ui/Card";
import { CardHeaderStandard } from "@/components/ui/CardHeaderStandard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loader2, AlertTriangle, CheckCircle2, Factory, Archive, Receipt, Layers, Box, Plus, Trash2, Info, AlertCircle, Package2, Warehouse, ShoppingBag, FileText } from "lucide-react";
import { ProductFormData } from "@/types/product";
import { cn, toTitleCase } from "@/lib/utils";
import { getTaxGroups, TaxGroup } from "@/lib/data/tax-groups";
import { getUoms } from "@/lib/data/uoms";
import { Uom } from "@/types/product";
import { Alert } from "@/components/ui/Alert";
import { PackagingList } from "./PackagingList";
import { PackagingModal } from "./PackagingModal";
import { TaxGroupSelector } from "./TaxGroupSelector";
import { ConfirmDialogDesdobra } from "@/components/ui/ConfirmDialogDesdobra";
import { ItemPackaging } from "@/types/product";


interface ProductFormProps {
    initialData?: ProductFormData;
    isEdit?: boolean;
    itemId?: string;
}

const ITEM_TYPES = [
    { value: 'raw_material', label: 'Matéria-Prima' },
    { value: 'packaging', label: 'Embalagem' },
    { value: 'wip', label: 'Semi-Acabado' },
    { value: 'finished_good', label: 'Produto Acabado' },
    { value: 'service', label: 'Serviço' },
    { value: 'other', label: 'Outros' }
];



// Helper for minimal ID generation for new lines
const tempId = () => '_' + Math.random().toString(36).substr(2, 9);

export function ProductForm({ initialData, isEdit, itemId }: ProductFormProps) {
    const router = useRouter();
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    const [isLoading, setIsLoading] = useState(false);
    const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
    const [activeTab, setActiveTab] = useState("general");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState<string | null>(null);

    const [uoms, setUoms] = useState<Uom[]>([]);

    // Recipe State
    const [availableIngredients, setAvailableIngredients] = useState<any[]>([]);
    const [recipeLines, setRecipeLines] = useState<any[]>([]);
    const [byproducts, setByproducts] = useState<any[]>([]);
    const [recipeHeaderId, setRecipeHeaderId] = useState<string | null>(null);

    const [formData, setFormData] = useState<ProductFormData>(initialData || {
        // Identity
        name: "",
        sku: "",
        type: "raw_material",
        uom: "UN",
        gtin_ean_base: "",
        net_weight_kg_base: 0,
        gross_weight_kg_base: 0,
        is_active: true,
        packagings: [],
        // Inventory
        control_stock: true,
        control_batch: false,
        control_expiry: false,
        // Sales
        is_sellable: true,
        // Production
        is_produced: false,
        // Fiscal
        has_fiscal_output: false,

        // Extended Fields (Local State for UI)
        production_uom: "UN",
        batch_size: 1, // Default yield 1
        loss_percent: 0,     // Perda padrão %
        byproducts: []
    } as ProductFormData & { production_uom: string; batch_size: number; loss_percent: number; packagings: Partial<ItemPackaging>[]; byproducts: any[] });

    const [packagingModalOpen, setPackagingModalOpen] = useState(false);
    const [showNoRecipeConfirm, setShowNoRecipeConfirm] = useState(false);
    const [pendingSaveAndNew, setPendingSaveAndNew] = useState(false);
    const [editingPackagingIndex, setEditingPackagingIndex] = useState<number | null>(null);
    const [packagingToDeleteIndex, setPackagingToDeleteIndex] = useState<number | null>(null);

    const [showByproducts, setShowByproducts] = useState(false);
    const [byproductSearchOpen, setByproductSearchOpen] = useState<string | null>(null);
    const [byproductSearchTerm, setByproductSearchTerm] = useState("");

    // --- Helpers ---
    const cleanDigits = (str: string) => str.replace(/\D/g, '');

    // Derived State
    const currentBaseUom = formData.uom_id
        ? (uoms.find(u => u.id === formData.uom_id)?.abbrev || formData.uom)
        : formData.uom;

    // --- Handlers ---
    const handleTypeChange = (newType: string) => {
        const updates: any = { type: newType };

        // Reset/Preset defaults based on type
        if (newType === 'service') {
            updates.control_stock = false;
            updates.is_produced = false;
            updates.has_fiscal_output = false; // Default off, user can enable
            updates.uom = 'UN';
        } else if (newType === 'raw_material' || newType === 'packaging') {
            updates.is_produced = false;
        } else if (newType === 'finished_good' || newType === 'wip') {
            updates.is_produced = true;
            updates.control_stock = true;
        }

        setFormData(prev => ({ ...prev, ...updates }));
        setErrors({});
    };

    const handleChange = (field: keyof ProductFormData | string, value: any) => {
        let finalValue = value;

        // Normalization Rules
        if (typeof value === 'string') {
            if (field === 'sku') finalValue = value.toUpperCase().trim();
            if (field === 'ncm' || field === 'cest') finalValue = cleanDigits(value);
            if (field === 'cfop_default') finalValue = cleanDigits(value).slice(0, 4);
            if (field === 'gtin_ean_base') finalValue = cleanDigits(value);
        }

        setFormData(prev => {
            const updates: any = { [field]: finalValue };

            // Logic for UOM ID -> Legacy UOM handle
            if (field === 'uom_id') {
                const uom = uoms.find(u => u.id === value);
                if (uom) updates.uom = uom.abbrev;

                // Sync Production UOM if it was same as base or unset
                if (!prev.production_uom_id || prev.production_uom_id === prev.uom_id) {
                    updates.production_uom_id = value;
                    if (uom) updates.production_uom = uom.abbrev;
                }
            }

            if (field === 'production_uom_id') {
                const uom = uoms.find(u => u.id === value);
                if (uom) updates.production_uom = uom.abbrev;
            }

            return { ...prev, ...updates };
        });

        // Clear error for this field on change
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    // --- Packaging Handlers ---
    const handleOpenPackagingModal = (index?: number) => {
        if (typeof index === 'number') {
            setEditingPackagingIndex(index);
        } else {
            setEditingPackagingIndex(null);
        }
        setPackagingModalOpen(true);
    };

    const handleSavePackaging = (pkg: Partial<ItemPackaging>) => {
        const newPackagings = [...(formData.packagings || [])];

        // Handle Default Sales Unit logic: If this one is default, unset others
        if (pkg.is_default_sales_unit) {
            newPackagings.forEach(p => p.is_default_sales_unit = false);
        }

        if (editingPackagingIndex !== null) {
            newPackagings[editingPackagingIndex] = { ...newPackagings[editingPackagingIndex], ...pkg };
        } else {
            newPackagings.push(pkg);
        }

        setFormData(prev => ({ ...prev, packagings: newPackagings }));
        setPackagingModalOpen(false);
        setEditingPackagingIndex(null);
    };

    const confirmDeletePackaging = () => {
        if (packagingToDeleteIndex !== null) {
            const newPackagings = [...(formData.packagings || [])];
            const pkg = newPackagings[packagingToDeleteIndex];

            // If it has an ID, mark as deleted (soft delete in UI until save)
            if (pkg.id) {
                // We can use a special flag or just handle it in backend. 
                // For now, let's just filter it out from UI list but keep track if we need to delete from DB?
                // Simpler approach: Include a 'deleted_at' field or similar in the payload to backend?
                // Or actually, commonly we track deleted IDs.
                // Let's assume the backend syncs the list: present = upsert, missing = delete. 
                // BUT to be safe with "missing = delete", we need to be sure we loaded all of them.
                // Alternatively, mark with a flag in a local state for deletion.

                // Let's use a "deleted_at" marker in memory if possible or just filter.
                // To support "missing = delete" in backend, we need to send ALL current ones.
                newPackagings.splice(packagingToDeleteIndex, 1);
                // If we rely on diffing in backend (delete items not in list), this is enough.
                // BUT filtering out means we lose the ID to say "delete this ID". 
                // So we should probably keep it but mark as deleted?
                // Or keep a separate "deletedPackagingIds" state.
            } else {
                newPackagings.splice(packagingToDeleteIndex, 1);
            }

            // Wait, to keep it simple and consistent with standard patterns:
            // We'll mark it as deleted in the array if it exists in DB, or remove if new.
            // Actually, for simplicity with Supabase upsert/sync, a separate "idsToDelete" is often cleaner.
            // But let's check validation: The user wants to remove it.

            // Refined Approach: Add to a "deletedPackagings" state if ID exists.
            const pkgToDelete = (formData.packagings || [])[packagingToDeleteIndex];
            if (pkgToDelete.id) {
                setDeletedPackagingIds(prev => [...prev, pkgToDelete.id!]);
            }

            newPackagings.splice(packagingToDeleteIndex, 1);

            setFormData(prev => ({ ...prev, packagings: newPackagings }));
            setPackagingToDeleteIndex(null);
        }
    };

    const [deletedPackagingIds, setDeletedPackagingIds] = useState<string[]>([]);

    // --- Fiscal Handlers ---
    const handleTaxGroupChange = (groupId: string) => {
        const group = taxGroups.find(g => g.id === groupId);

        // Update Tax Group
        setFormData(prev => ({
            ...prev,
            tax_group_id: groupId,
            // DECISION: Do NOT inherit NCM/CEST/Origin anymore. Product is source of truth.
        }));

        // Clear errors if any
        if (errors.tax_group_id) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.tax_group_id;
                return newErrors;
            });
        }
    };



    // --- Recipe Handlers ---
    const addRecipeLine = () => {
        setRecipeLines(prev => [
            ...prev,
            {
                id: tempId(), // Temp ID
                component_item_id: "",
                qty: 1,
                uom: "UN",
                notes: ""
            }
        ]);
        // Auto open search for new line? Optional.
    };

    const removeRecipeLine = (id: string) => {
        setRecipeLines(prev => prev.filter(l => l.id !== id));
    };

    const updateRecipeLine = (id: string, field: string, value: any) => {
        setRecipeLines(prev => prev.map(l => {
            if (l.id === id) {
                const updates: any = { [field]: value };
                // If item changed, update UOM
                if (field === 'component_item_id') {
                    const item = availableIngredients.find(i => i.id === value);
                    if (item) updates.uom = item.uom;
                }
                return { ...l, ...updates };
            }
            return l;
        }));
    };

    // --- Byproduct Handlers ---
    const addByproductLine = () => {
        setByproducts(prev => [
            ...prev,
            {
                id: tempId(),
                item_id: "",
                qty: 1,
                basis: "PERCENT",
                notes: ""
            }
        ]);
        setShowByproducts(true);
    };

    const removeByproductLine = (id: string) => {
        setByproducts(prev => prev.filter(l => l.id !== id));
    };

    const updateByproductLine = (id: string, field: string, value: any) => {
        setByproducts(prev => prev.map(l => {
            if (l.id === id) {
                return { ...l, [field]: value };
            }
            return l;
        }));
    };

    const handleByproductSearchOpen = (lineId: string, currentId: string) => {
        setByproductSearchOpen(lineId);
        const current = availableIngredients.find(i => i.id === currentId);
        setByproductSearchTerm(current ? current.name : "");
    };

    const handleByproductSelect = (lineId: string, item: any) => {
        updateByproductLine(lineId, 'item_id', item.id);
        setByproductSearchOpen(null);
        setByproductSearchTerm("");
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        // 1. General
        if (!formData.name || formData.name.trim().length < 3) {
            newErrors.name = "Nome deve ter pelo menos 3 caracteres.";
        }

        if (!formData.type) newErrors.type = "Tipo é obrigatório.";
        if (!formData.uom) newErrors.uom = "UOM é obrigatória.";

        if (formData.gtin_ean_base) {
            const len = formData.gtin_ean_base.length;
            if (![8, 12, 13, 14].includes(len)) {
                newErrors.gtin_ean_base = "GTIN/EAN deve ter 8, 12, 13 ou 14 dígitos.";
            }
        }

        // 2. Operations (Stock)
        if (formData.control_stock) {
            const min = formData.min_stock || 0;
            const max = formData.max_stock || 0;
            const point = formData.reorder_point || 0;

            if (min < 0) newErrors.min_stock = "Não pode ser negativo.";
            if (max < 0) newErrors.max_stock = "Não pode ser negativo.";
            if (max > 0 && max < min) {
                newErrors.max_stock = "Máximo deve ser maior ou igual ao mínimo.";
            }
        }

        // Purchase defaults
        if (formData.conversion_factor && formData.conversion_factor <= 0) {
            newErrors.conversion_factor = "Fator deve ser maior que 0.";
        }

        // 3. Fiscal
        if (formData.has_fiscal_output) {
            if (!formData.tax_group_id) newErrors.tax_group_id = "Grupo Tributário é obrigatório para item com saída fiscal.";
            // NCM/CEST are now inherited, but we still validate presence/length
            if (formData.ncm && formData.ncm.length !== 8) newErrors.ncm = "NCM deve ter 8 dígitos.";
            if (formData.cest && formData.cest.length !== 7) newErrors.cest = "CEST deve ter 7 dígitos.";
            // CFOP is now optional
        }

        // 4. Production
        if (formData.is_produced) {
            const prodState = formData as any;
            if (prodState.loss_percent < 0 || prodState.loss_percent > 100) {
                newErrors.loss_percent = "Perda deve ser entre 0 e 100%.";
            }
        }

        setErrors(newErrors);
        return newErrors;
    };

    const searchParams = useSearchParams();
    const { toast } = useToast();

    useEffect(() => {
        if (searchParams && searchParams.get("success") === "created") {
            toast({
                title: "Item criado com sucesso!",
                description: "Pronto para cadastrar o próximo.",
                // @ts-ignore
                className: "bg-green-600 text-white border-none"
            });
        }
    }, [searchParams]);

    useEffect(() => {
        if (selectedCompany) {
            getTaxGroups(supabase, selectedCompany.id).then(setTaxGroups);
            getUoms(selectedCompany.id).then(setUoms);

            // ... rest of use effect

            if (!isEdit && !formData.sku) {
                supabase.rpc('get_next_sku', { p_company_id: selectedCompany.id })
                    .then(({ data, error }) => {
                        if (data && !error) {
                            handleChange('sku', data);
                        }
                    });
            }

            // Fetch Ingredients (Raw Materials, Packaging, WIP)
            supabase.from('items')
                .select('id, name, sku, uom, type, avg_cost')
                .eq('company_id', selectedCompany.id)
                .in('type', ['raw_material', 'packaging', 'wip'])
                .eq('is_active', true)
                .order('name')
                .then(({ data }) => {
                    if (data) setAvailableIngredients(data);
                });

            // Fetch Existing Data if Edit
            if (isEdit && itemId) {
                // Fetch BOM Header
                supabase.from('bom_headers')
                    .select('id, yield_qty, yield_uom, lines:bom_lines(*)')
                    .eq('item_id', itemId)
                    .eq('is_active', true)
                    .maybeSingle()
                    .then(({ data, error }) => {
                        if (data && !error) {
                            setRecipeHeaderId(data.id);

                            if (data.lines) {
                                setRecipeLines(data.lines.map((l: any) => ({
                                    ...l,
                                    // ensure numeric
                                    qty: l.qty
                                })));
                            }

                            // Fetch Byproducts
                            supabase.from('bom_byproduct_outputs')
                                .select(`
                                    *,
                                    item:items!bom_byproduct_outputs_item_id_fkey(name, uom, sku)
                                `)
                                .eq('bom_id', data.id)
                                .then(({ data: bpData }) => {
                                    if (bpData) {
                                        setByproducts(bpData.map((bp: any) => ({
                                            ...bp,
                                            item_name: bp.item?.name,
                                            item_uom: bp.item?.uom,
                                            item_sku: bp.item?.sku
                                        })));
                                        if (bpData.length > 0) setShowByproducts(true);
                                    }
                                });
                        }
                    });

                // Fetch Packagings
                supabase.from('item_packaging')
                    .select('*')
                    .eq('item_id', itemId)
                    .is('deleted_at', null)
                    .order('created_at', { ascending: true })
                    .then(({ data }) => {
                        if (data) {
                            setFormData(prev => ({ ...prev, packagings: data }));
                        }
                    });
            }
        }
    }, [selectedCompany, isEdit, itemId]);

    const [hasMigrated, setHasMigrated] = useState(false);
    useEffect(() => {
        if (!hasMigrated && isEdit && taxGroups.length > 0 && formData.tax_group_id) {
            const group = taxGroups.find(g => g.id === formData.tax_group_id);
            if (group) {
                setFormData(prev => {
                    const needsMigration = (!prev.ncm && !!group.ncm) || (!prev.cest && !!group.cest);
                    if (needsMigration) {
                        console.log("Migrating fiscal data from Tax Group to Product...");
                        return {
                            ...prev,
                            ncm: prev.ncm || group.ncm || "",
                            cest: prev.cest || group.cest || "",
                            origin: (prev.origin === 0 && group.origin_default !== undefined && group.origin_default !== 0)
                                ? group.origin_default
                                : prev.origin
                        };
                    }
                    return prev;
                });
            }
            setHasMigrated(true);
        }
    }, [taxGroups, formData.tax_group_id, isEdit, hasMigrated]);

    // Force is_produced=true for consistency if type requires it (Fix for saving issue)
    useEffect(() => {
        if (['finished_good', 'wip'].includes(formData.type) && !formData.is_produced) {
            setFormData(prev => ({ ...prev, is_produced: true }));
        }
    }, [formData.type, formData.is_produced]);

    const executeSave = async (saveAndNew: boolean) => {
        // Apply formatting rules (Frontend)
        const finalName = toTitleCase(formData.name.trim()) || formData.name;
        const finalBrand = formData.brand ? toTitleCase(formData.brand.trim()) : null;
        const finalLine = formData.line ? toTitleCase(formData.line.trim()) : null;
        const finalDescription = formData.description ? toTitleCase(formData.description.trim()) : null;

        setIsLoading(true);
        try {
            if (!selectedCompany) throw new Error("Empresa não selecionada");

            // Validate SKU Uniqueness
            if (formData.sku) {
                let query = supabase
                    .from('items')
                    .select('id')
                    .eq('company_id', selectedCompany.id)
                    .eq('sku', formData.sku);

                if (isEdit && itemId) {
                    query = query.neq('id', itemId);
                }

                const { data: existingSku } = await query.single();
                if (existingSku) {
                    toast({
                        title: "Erro de Validação",
                        description: `O SKU "${formData.sku}" já está em uso por outro item. Por favor, escolha outro.`,
                        variant: "destructive"
                    });
                    setIsLoading(false);
                    return;
                }
            }
            // 1. Upsert Item
            const itemPayload = {
                company_id: selectedCompany.id,
                name: finalName,
                sku: formData.sku || null,
                type: formData.type,
                uom: formData.uom_id ? (uoms.find(u => u.id === formData.uom_id)?.abbrev || formData.uom) : formData.uom,
                uom_id: formData.uom_id || null,
                is_active: formData.is_active,
                gtin_ean_base: formData.gtin_ean_base || null,
                net_weight_kg_base: formData.net_weight_kg_base || null,
                gross_weight_kg_base: formData.gross_weight_kg_base || null,
                height_base: formData.height_base || null,
                width_base: formData.width_base || null,
                length_base: formData.length_base || null,
                brand: finalBrand,
                line: finalLine,
                category_id: formData.category_id || null,
                description: finalDescription,
                image_url: formData.image_url || null,
                avg_cost: 0 // Default
            };

            let savedItemId = itemId;

            if (isEdit && itemId) {
                const { error } = await supabase.from('items').update(itemPayload).eq('id', itemId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('items').insert(itemPayload).select().single();
                if (error) throw error;
                savedItemId = data.id.toString();
            }

            if (!savedItemId) throw new Error("Failed to get Item ID");

            // 2. Upsert Profiles 

            // Inventory Profile
            await supabase.from('item_inventory_profiles').upsert({
                company_id: selectedCompany.id,
                item_id: savedItemId,
                control_stock: formData.control_stock,
                min_stock: formData.min_stock || null,
                max_stock: formData.max_stock || null,
                reorder_point: formData.reorder_point || null,
                default_location: formData.default_location || null,
                control_batch: formData.control_batch,
                control_expiry: formData.control_expiry
            }, { onConflict: 'item_id' });

            // 4. Upsert Packagings (MUST BE BEFORE PURCHASE PROFILE due to FK)
            let resolvedPackagings: any[] = [];
            if (formData.packagings && formData.packagings.length > 0) {
                const packagingsToUpsert = formData.packagings.map(p => {
                    const packaging: any = {
                        company_id: selectedCompany.id,
                        item_id: savedItemId,
                        type: p.type?.trim() || '',
                        label: p.label?.trim() || '',
                        qty_in_base: p.qty_in_base,
                        gtin_ean: p.gtin_ean || null,
                        net_weight_kg: p.net_weight_kg || null,
                        gross_weight_kg: p.gross_weight_kg || null,
                        height_cm: p.height_cm || null,
                        width_cm: p.width_cm || null,
                        length_cm: p.length_cm || null,
                        is_default_sales_unit: p.is_default_sales_unit || false,
                        is_active: p.is_active,
                        deleted_at: null, // ensure it is not deleted
                        uom_id: null // New field for UOM standardization (NFe description enhancement)
                    };

                    // Only include id if it exists (for updates)
                    if (p.id && !String(p.id).startsWith('temp-')) {
                        packaging.id = p.id;
                    }

                    return packaging;
                });

                const { data: upsertedPackagings, error: pkgError } = await supabase
                    .from('item_packaging')
                    .upsert(packagingsToUpsert)
                    .select('*');

                if (pkgError) throw pkgError;
                resolvedPackagings = upsertedPackagings;
            }

            // Purchase Profile (Merged into Operations in UI, but separate table)
            // MOVED AFTER PACKAGING due to default_purchase_packaging_id FK

            // Resolve default packaging ID (handle temp IDs)
            let finalDefaultPkgId: string | null | undefined = formData.default_purchase_packaging_id;

            // If it's a temp ID or if we just saved new packagings, ensure we use the real ID
            if (finalDefaultPkgId && (String(finalDefaultPkgId).startsWith('temp-') || resolvedPackagings.length > 0)) {
                // If it's a real ID, verify it still exists/matches (optional but good)
                // If it's temp, we MUST find it
                if (String(finalDefaultPkgId).startsWith('temp-')) {
                    const tempPkg = formData.packagings?.find(p => p.id === finalDefaultPkgId);
                    if (tempPkg && resolvedPackagings.length > 0) {
                        // Match by unique combo: label + qty_in_base
                        const match = resolvedPackagings.find(rp =>
                            rp.label === tempPkg.label &&
                            Number(rp.qty_in_base) === Number(tempPkg.qty_in_base)
                        );
                        if (match) {
                            finalDefaultPkgId = match.id;
                        } else {
                            // Fallback: This shouldn't happen if upsert worked
                            finalDefaultPkgId = null;
                        }
                    } else {
                        finalDefaultPkgId = null;
                    }
                }
            }

            await supabase.from('item_purchase_profiles').upsert({
                company_id: selectedCompany.id,
                item_id: savedItemId,
                preferred_supplier_id: formData.preferred_supplier_id || null,
                lead_time_days: formData.lead_time_days || null,
                purchase_uom: formData.purchase_uom || null, // Legacy
                purchase_uom_id: formData.uom_id || null, // Sync with base UOM for now if not distinct
                default_purchase_packaging_id: finalDefaultPkgId,
                conversion_factor: formData.conversion_factor || 1,
                notes: formData.purchase_notes || null
            }, { onConflict: 'item_id' });

            // Sales Profile (Removed from UI but must persist defaults if needed)
            await supabase.from('item_sales_profiles').upsert({
                company_id: selectedCompany.id,
                item_id: savedItemId,
                is_sellable: formData.is_sellable,
                default_price_list_id: formData.default_price_list_id || null,
                default_commission_percent: formData.default_commission_percent || null,
                notes: formData.sales_notes || null
            }, { onConflict: 'item_id' });

            // Fiscal Profile
            await supabase.from('item_fiscal_profiles').upsert({
                company_id: selectedCompany.id,
                item_id: savedItemId,
                ncm: formData.ncm || null,
                cest: formData.cest || null,
                origin: formData.origin !== undefined ? formData.origin : 0, // Ensure origin is saved (0 is a valid value)
                cfop_default: formData.cfop_code || formData.cfop_default || null, // Fallback for legacy
                cfop_code: formData.cfop_code || null,
                tax_group_id: formData.tax_group_id || null,
                has_fiscal_output: formData.has_fiscal_output
            }, { onConflict: 'item_id' });

            // Production Profile
            const formProd = formData as any;
            await supabase.from('item_production_profiles').upsert({
                company_id: selectedCompany.id,
                item_id: savedItemId,
                is_produced: formData.is_produced,
                default_bom_id: recipeHeaderId || null,
                batch_size: formProd.batch_size || 1,
                production_uom: formProd.production_uom || "UN", // Legacy
                production_uom_id: formData.production_uom_id || null,
                loss_percent: formProd.loss_percent || 0,
                notes: formProd.production_notes || null
            }, { onConflict: 'item_id' });

            // 3. BOM / Recipe Logic
            if (formData.is_produced) {
                // Upsert BOM Header
                const bomPayload = {
                    company_id: selectedCompany.id,
                    item_id: savedItemId,
                    yield_qty: formProd.batch_size || 1,
                    yield_uom: formProd.production_uom || "UN",
                    is_active: true,
                    version: 1 // TODO: Versioning
                };

                let currentBomId = recipeHeaderId;

                if (currentBomId) {
                    await supabase.from('bom_headers').update(bomPayload).eq('id', currentBomId);
                } else {
                    const { data: newBom } = await supabase.from('bom_headers')
                        .insert(bomPayload).select().single();
                    if (newBom) {
                        currentBomId = newBom.id;
                        setRecipeHeaderId(newBom.id); // Prevent duplicate headers on next save
                    }
                }

                if (currentBomId) {
                    // Sync Lines: Delete all and re-insert 
                    await supabase.from('bom_lines').delete().eq('bom_id', currentBomId);

                    if (recipeLines.length > 0) {
                        // Aggregate duplicates (same component_item_id)
                        const aggregatedLines = new Map<string, any>();

                        recipeLines.forEach((l, idx) => {
                            if (!l.component_item_id) return;
                            const key = l.component_item_id;
                            if (aggregatedLines.has(key)) {
                                const existing = aggregatedLines.get(key);
                                existing.qty += l.qty;
                                existing.notes = existing.notes ? `${existing.notes}; ${l.notes || ''}` : (l.notes || null);
                            } else {
                                aggregatedLines.set(key, { ...l, sort_order: idx });
                            }
                        });

                        const linesToInsert = Array.from(aggregatedLines.values()).map((l, idx) => ({
                            company_id: selectedCompany.id,
                            bom_id: currentBomId,
                            component_item_id: l.component_item_id,
                            qty: l.qty,
                            uom: l.uom,
                            notes: l.notes || null,
                            sort_order: l.sort_order // or just idx
                        }));
                        const { error: linesError } = await supabase.from('bom_lines').insert(linesToInsert);
                        if (linesError) throw linesError;
                    }

                    // Sync Byproducts
                    await supabase.from('bom_byproduct_outputs').delete().eq('bom_id', currentBomId);

                    if (byproducts.length > 0) {
                        const byproductsToInsert = byproducts.map(bp => ({
                            company_id: selectedCompany.id,
                            bom_id: currentBomId,
                            item_id: bp.item_id,
                            qty: bp.qty,
                            basis: bp.basis,
                            notes: bp.notes || null
                        }));
                        await supabase.from('bom_byproduct_outputs').insert(byproductsToInsert);
                    }
                }
            }

            // Packagings (Moved up before Purchase Profile)
            // if (formData.packagings && formData.packagings.length > 0) { ... } // ALREADY HANDLED ABOVE

            // Delete removed packagings
            if (deletedPackagingIds.length > 0) {
                // Soft delete
                await supabase.from('item_packaging')
                    .update({ deleted_at: new Date().toISOString() })
                    .in('id', deletedPackagingIds);
            }

            if (saveAndNew) {
                window.location.href = '/app/cadastros/produtos/novo?success=created';
            } else {
                router.push('/app/cadastros/produtos?success=' + (isEdit ? 'updated' : 'created'));
            }

        } catch (error: any) {
            console.error("Save Error Detailed:", error);
            console.error("Save Error Stringified:", JSON.stringify(error, null, 2));

            let msg = "Erro desconhecido";
            if (typeof error === 'string') msg = error;
            else if (error?.message) msg = error.message;
            else if (error?.error_description) msg = error.error_description;
            else if (error?.details) msg = error.details;

            toast({
                title: "Erro ao Salvar",
                description: msg,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (saveAndNew = false) => {
        if (!selectedCompany) return;

        setSuccess(null);

        // Run validation
        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            toast({
                title: "Erro de Validação",
                description: "Existem erros no formulário. Verifique os campos em destaque.",
                variant: "destructive"
            });

            // Auto-switch to tab with error
            const generalFields = ['name', 'type', 'uom', 'gtin_ean_base', 'brand', 'line'];
            const operationsFields = ['min_stock', 'max_stock', 'conversion_factor'];
            const fiscalFields = ['tax_group_id', 'ncm', 'cest', 'cfop_default'];
            const productionFields = ['loss_percent'];

            const hasError = (fields: string[]) => fields.some(f => !!formErrors[f]);

            if (hasError(generalFields)) setActiveTab("general");
            else if (hasError(operationsFields) && showOperations) setActiveTab("operations");
            else if (hasError(fiscalFields) && showFiscal) setActiveTab("fiscal");
            else if (hasError(productionFields) && showProduction) setActiveTab("production");

            return;
        }

        // Validate Recipe if Produced
        if (formData.is_produced) {
            const invalidLines = recipeLines.filter(l => !l.component_item_id || l.qty <= 0);
            if (invalidLines.length > 0) {
                toast({
                    title: "Erro na Receita",
                    description: "A receita possui linhas inválidas (sem insumo ou quantidade zero).",
                    variant: "destructive"
                });
                setActiveTab("production");
                return;
            }

            if (recipeLines.length === 0) {
                setPendingSaveAndNew(saveAndNew);
                setShowNoRecipeConfirm(true);
                return;
            }
        }

        await executeSave(saveAndNew);
    };

    const handleConfirmNoRecipe = async () => {
        setShowNoRecipeConfirm(false);
        await executeSave(pendingSaveAndNew);
    };

    // --- Progressive Disclosure Logic ---

    // Should 'Operations' (Inventory + Purchase) be visible?
    const showOperations = ['raw_material', 'packaging', 'wip', 'finished_good', 'resale', 'other'].includes(formData.type);

    // Should 'Fiscal' be visible?
    const showFiscal = formData.has_fiscal_output;

    // Should 'Production' be visible?
    // User Constraint: "Aba Produção só aparece para Tipo do Item = 'Produto acabado' ou 'Semi-Acabado'"
    const showProduction = ['finished_good', 'wip'].includes(formData.type);

    // --- Search Helper for Ingredients ---
    // Simple inline logic for autocomplete using native inputs and absolute positioning

    const [ingredientSearchOpen, setIngredientSearchOpen] = useState<string | null>(null); // line id
    const [ingredientSearchTerm, setIngredientSearchTerm] = useState("");

    const handleIngredientSearchOpen = (lineId: string, currentId: string) => {
        setIngredientSearchOpen(lineId);
        // Find current name to pre-fill or empty
        const current = availableIngredients.find(i => i.id === currentId);
        setIngredientSearchTerm(current ? current.name : "");
    };

    const handleIngredientSelect = (lineId: string, item: any) => {
        updateRecipeLine(lineId, 'component_item_id', item.id);
        setIngredientSearchOpen(null);
        setIngredientSearchTerm("");
    };

    // Calculate Total Cost
    const totalRecipeCost = recipeLines.reduce((acc, line) => {
        const item = availableIngredients.find(i => i.id === line.component_item_id);
        const cost = item?.avg_cost || 0;
        return acc + (line.qty * cost);
    }, 0);

    const productionUomLabel = uoms.find(u => u.id === formData.production_uom_id)?.abbrev || formData.production_uom || "UN";

    // Filter available ingredients for the active search
    const filteredIngredients = availableIngredients.filter(i =>
        i.name.toLowerCase().includes(ingredientSearchTerm.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(ingredientSearchTerm.toLowerCase()))
    );

    const filteredByproducts = availableIngredients.filter(i =>
        i.id !== itemId && // Prevent loop
        (i.name.toLowerCase().includes(byproductSearchTerm.toLowerCase()) ||
            (i.sku && i.sku.toLowerCase().includes(byproductSearchTerm.toLowerCase())))
    );

    return (
        <div>

            {success && (
                <div className="mb-4">
                    {/* @ts-ignore */}
                    <Alert variant="success" onClose={() => setSuccess(null)}>
                        {success}
                    </Alert>
                </div>
            )}
            <PageHeader
                title={isEdit ? `Editar ${formData.name || 'Item'}` : "Novo Item"}
                subtitle="Cadastre produtos, materiais e insumos."
                actions={
                    <div className="flex gap-2 items-center">
                        {/* Status Badge */}
                        {formData.has_fiscal_output && (
                            (formData.is_active && formData.tax_group_id && formData.ncm?.length === 8 && formData.uom) ? (
                                <span className="mr-2 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Pronto para NF-e
                                </span>
                            ) : (
                                <span className="mr-2 inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20" title="Complete os dados fiscais (Grupo, NCM) para emitir NF-e">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Pendente Fiscal
                                </span>
                            )
                        )}

                        <Button variant="secondary" onClick={() => router.push('/app/cadastros/produtos')}>
                            Cancelar
                        </Button>
                        {!isEdit && (
                            <Button variant="secondary" onClick={() => handleSave(true)} disabled={isLoading}>
                                Salvar e Novo
                            </Button>
                        )}
                        <Button onClick={() => handleSave(false)} disabled={isLoading}>
                            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar
                        </Button>
                    </div>
                }
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <FormTabsList className="px-0 border-b-0">
                        <FormTabsTrigger value="general">
                            <Box className="w-4 h-4 mr-2" />
                            Geral
                        </FormTabsTrigger>

                        {showOperations && (
                            <FormTabsTrigger value="operations">
                                <Archive className="w-4 h-4 mr-2" />
                                Operações
                            </FormTabsTrigger>
                        )}

                        <FormTabsTrigger value="fiscal">
                            <Receipt className="w-4 h-4 mr-2" />
                            Fiscal
                        </FormTabsTrigger>

                        <FormTabsTrigger value="logistics">
                            <Box className="w-4 h-4 mr-2" />
                            Logística
                        </FormTabsTrigger>

                        {showProduction && (
                            <FormTabsTrigger value="production">
                                <Factory className="w-4 h-4 mr-2" />
                                Produção
                            </FormTabsTrigger>
                        )}
                    </FormTabsList>
                </Tabs>
            </PageHeader>

            <div className="container mx-auto max-w-[1600px] px-6 pb-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

                    {/* --- TAB GERAL --- */}
                    <TabsContent value="general" className="mt-0 space-y-6">
                        <Card>
                            <CardHeaderStandard
                                icon={<Package2 className="w-5 h-5" />}
                                title="Dados Principais"
                            />
                            <CardContent>
                                <div className="grid grid-cols-12 gap-8">
                                    {/* --- LEFT COLUMN: Main Info (Title, Brand, Line, Description) --- */}
                                    <div className="col-span-12 lg:col-span-9 space-y-6">

                                        {/* Name */}
                                        <div className="grid grid-cols-12 gap-6">
                                            <div className="col-span-12">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome do Item *</label>
                                                <Input
                                                    value={formData.name}
                                                    onChange={(e) => handleChange('name', e.target.value)}
                                                    placeholder="Ex: Cimento CP-II"
                                                    className={errors.name ? "mt-1 border-red-500" : "mt-1"}
                                                />
                                                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                            </div>
                                        </div>

                                        {/* SKU / GTIN / Type Row */}
                                        <div className="grid grid-cols-12 gap-4">
                                            <div className="col-span-6 md:col-span-2">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</label>
                                                <Input
                                                    value={formData.sku}
                                                    onChange={(e) => handleChange('sku', e.target.value)}
                                                    placeholder="AUTO"
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div className="col-span-6 md:col-span-4">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GTIN / EAN</label>
                                                <Input
                                                    value={formData.gtin_ean_base || ''}
                                                    onChange={(e) => handleChange('gtin_ean_base', e.target.value)}
                                                    placeholder="789..."
                                                    className={errors.gtin_ean_base ? "mt-1 border-red-500" : "mt-1"}
                                                    maxLength={14}
                                                />
                                                {errors.gtin_ean_base && <p className="text-xs text-red-500 mt-1">{errors.gtin_ean_base}</p>}
                                            </div>
                                            <div className="col-span-12 md:col-span-6">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo *</label>
                                                <Select
                                                    value={formData.type}
                                                    onValueChange={(val) => handleTypeChange(val)}
                                                >
                                                    <SelectTrigger className={cn("mt-1", errors.type && "border-red-500")}>
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ITEM_TYPES.map(t => (
                                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Brand & Line */}
                                        <div className="grid grid-cols-12 gap-6">
                                            <div className="col-span-12 md:col-span-6">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Marca</label>
                                                <Input
                                                    value={formData.brand || ''}
                                                    onChange={(e) => handleChange('brand', e.target.value)}
                                                    placeholder="Marca"
                                                    className="mt-1"
                                                />
                                            </div>
                                            <div className="col-span-12 md:col-span-6">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Linha / Categoria</label>
                                                <CategorySelector
                                                    value={formData.category_id}
                                                    onChange={(val) => handleChange('category_id', val)}
                                                    className="mt-1"
                                                    disabled={formData.type !== 'finished_good'}
                                                    companyId={selectedCompany?.id || ""}
                                                />
                                            </div>
                                        </div>

                                        {/* Active Toggle */}
                                        <div className="grid grid-cols-12 gap-6">
                                            <div className="col-span-12 flex items-center pt-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_active}
                                                        onChange={(e) => handleChange('is_active', e.target.checked)}
                                                        className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                                    />
                                                    <span className="text-sm font-medium text-gray-700">Item Ativo</span>
                                                </label>
                                            </div>
                                        </div>


                                    </div>

                                    {/* --- RIGHT COLUMN: Metadata (Type, UOM, Dimensions, Weights) --- */}
                                    <div className="col-span-12 lg:col-span-3 space-y-4 lg:border-l lg:border-gray-100 lg:pl-6">

                                        {/* Type */}


                                        {/* UOM */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500">Unid. Medida *</label>
                                            <UomSelector
                                                value={formData.uom_id}
                                                onChange={(val) => handleChange('uom_id', val)}
                                                onSelect={(uom) => {
                                                    // Sync Production UOM if it was same as base or unset
                                                    if (!formData.production_uom_id || formData.production_uom_id === formData.uom_id) {
                                                        handleChange('production_uom_id', uom.id);
                                                    }
                                                }}
                                                className="mt-1"
                                            />
                                            {errors.uom && <p className="text-xs text-red-500 mt-1">{errors.uom}</p>}
                                        </div>

                                        {/* Dimensions */}
                                        <div className="grid grid-cols-12 gap-3 mt-4">
                                            <div className="col-span-12">
                                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">DIMENSÕES (cm)</p>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-gray-500 mb-1 block">Altura</label>
                                                        <DecimalInput
                                                            value={formData.height_base || 0}
                                                            onChange={(val) => handleChange('height_base', val)}
                                                            precision={2}
                                                            minPrecision={0}
                                                            disableDecimalShift={true}
                                                            placeholder="0"
                                                            className="text-right"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-gray-500 mb-1 block">Largura</label>
                                                        <DecimalInput
                                                            value={formData.width_base || 0}
                                                            onChange={(val) => handleChange('width_base', val)}
                                                            precision={2}
                                                            minPrecision={0}
                                                            disableDecimalShift={true}
                                                            placeholder="0"
                                                            className="text-right"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-gray-500 mb-1 block">Comp.</label>
                                                        <DecimalInput
                                                            value={formData.length_base || 0}
                                                            onChange={(val) => handleChange('length_base', val)}
                                                            precision={2}
                                                            minPrecision={0}
                                                            disableDecimalShift={true}
                                                            placeholder="0"
                                                            className="text-right"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-12 mt-2">
                                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">PESOS (KG)</p>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-gray-500 mb-1 block">Líquido</label>
                                                        <DecimalInput
                                                            value={formData.net_weight_kg_base || 0}
                                                            onChange={(val) => handleChange('net_weight_kg_base', val)}
                                                            precision={2}
                                                            minPrecision={0}
                                                            disableDecimalShift={true}
                                                            placeholder="0"
                                                            className="text-right"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-gray-500 mb-1 block">Bruto</label>
                                                        <DecimalInput
                                                            value={formData.gross_weight_kg_base || 0}
                                                            onChange={(val) => handleChange('gross_weight_kg_base', val)}
                                                            precision={2}
                                                            minPrecision={0}
                                                            disableDecimalShift={true}
                                                            placeholder="0"
                                                            className="text-right"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        {/* Placeholder for alignment with dimensions */}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB OPERAÇÕES (Estoque + Compras) --- */}
                    <TabsContent value="operations" className="mt-0 space-y-6">
                        <Card>
                            <CardHeaderStandard
                                icon={<Warehouse className="w-5 h-5" />}
                                title="Controle de Estoque"
                                actions={
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={formData.control_stock}
                                            onChange={(e) => handleChange('control_stock', e.target.checked)}
                                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-900">Controlar estoque deste item</span>
                                    </label>
                                }
                            />
                            {formData.control_stock ? (
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-12 gap-6">
                                        {/* Row 1: Stock Levels */}
                                        <div className="col-span-6 md:col-span-3 lg:col-span-2">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mínimo</label>
                                            <DecimalInput
                                                value={formData.min_stock || 0}
                                                onChange={(val) => handleChange('min_stock', val)}
                                                className={cn("mt-1 text-right", errors.min_stock && "border-red-500")}
                                                precision={3}
                                                minPrecision={0}
                                                disableDecimalShift={true}
                                            />
                                            {errors.min_stock && <p className="text-xs text-red-500 mt-1">{errors.min_stock}</p>}
                                        </div>
                                        <div className="col-span-6 md:col-span-3 lg:col-span-2">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Máximo</label>
                                            <DecimalInput
                                                value={formData.max_stock || 0}
                                                onChange={(val) => handleChange('max_stock', val)}
                                                className={cn("mt-1 text-right", errors.max_stock && "border-red-500")}
                                                precision={3}
                                                minPrecision={0}
                                                disableDecimalShift={true}
                                            />
                                            {errors.max_stock && <p className="text-xs text-red-500 mt-1">{errors.max_stock}</p>}
                                        </div>
                                        <div className="col-span-6 md:col-span-3 lg:col-span-2">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ponto de Pedido</label>
                                            <DecimalInput
                                                value={formData.reorder_point || 0}
                                                onChange={(val) => handleChange('reorder_point', val)}
                                                className="mt-1 text-right"
                                                precision={3}
                                                minPrecision={0}
                                                disableDecimalShift={true}
                                            />
                                        </div>
                                        <div className="col-span-6 md:col-span-3 lg:col-span-4">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Localização Padrão</label>
                                            <Input
                                                value={formData.default_location || ''}
                                                onChange={(e) => handleChange('default_location', e.target.value)}
                                                placeholder="Ex: A-03"
                                                className="mt-1"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.control_batch}
                                                onChange={(e) => handleChange('control_batch', e.target.checked)}
                                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700">Controlar Lote</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.control_expiry}
                                                onChange={(e) => handleChange('control_expiry', e.target.checked)}
                                                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                            />
                                            <span className="text-sm text-gray-700">Controlar Validade</span>
                                        </label>
                                    </div>
                                </CardContent>
                            ) : (
                                <CardContent>
                                    <p className="text-sm text-gray-500 italic">O estoque deste item não será controlado (apenas informativo).</p>
                                </CardContent>
                            )}
                        </Card>

                        <Card>
                            <CardHeaderStandard
                                icon={<ShoppingBag className="w-5 h-5" />}
                                title="Parâmetros de Compra (Padrão)"
                            />
                            <CardContent>
                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-6 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Time (Dias)</label>
                                        <Input
                                            type="number"
                                            value={formData.lead_time_days || ''}
                                            onChange={(e) => handleChange('lead_time_days', parseInt(e.target.value))}
                                            placeholder="Ex: 5"
                                            className="mt-1 text-right no-spinners"
                                        />
                                    </div>
                                    <div className="col-span-6 md:col-span-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Embalagem de Compra Padrão</label>
                                        <Select
                                            value={formData.default_purchase_packaging_id || "none"}
                                            onValueChange={(val) => handleChange('default_purchase_packaging_id', val === "none" ? null : val)}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhuma (Usa UM Base)</SelectItem>
                                                {formData.packagings?.map((pkg, idx) => (
                                                    <SelectItem key={pkg.id || `temp-${idx}`} value={pkg.id || `temp-${idx}`} disabled={!pkg.id}>
                                                        {pkg.label} {pkg.qty_in_base ? `(${pkg.qty_in_base} ${currentBaseUom})` : ''} {!pkg.id ? '(Salve para usar)' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {formData.default_purchase_packaging_id && (
                                            <div className="mt-2 text-xs text-brand-600 font-medium">
                                                Entrada no estoque: {
                                                    (() => {
                                                        const pkg = formData.packagings?.find(p => p.id === formData.default_purchase_packaging_id);
                                                        return pkg ? `${pkg.qty_in_base} ${currentBaseUom}` : '...';
                                                    })()
                                                }
                                            </div>
                                        )}

                                        {(!formData.packagings || formData.packagings.length === 0) && (
                                            <div
                                                className="mt-2 text-xs text-brand-600 hover:text-brand-700 cursor-pointer flex items-center gap-1"
                                                onClick={() => setPackagingModalOpen(true)}
                                            >
                                                <Plus className="w-3 h-3" /> Criar Embalagem de Compra
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB FISCAL --- */}
                    <TabsContent value="fiscal" className="mt-0 space-y-6">
                        <Card>
                            <CardHeaderStandard
                                icon={<FileText className="w-5 h-5" />}
                                title="Dados Fiscais"
                                actions={
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={formData.has_fiscal_output}
                                            onChange={(e) => handleChange('has_fiscal_output', e.target.checked)}
                                            className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                        />
                                        <span className="text-sm font-medium text-gray-900">Item possui saída fiscal</span>
                                    </label>
                                }
                            />
                            {formData.has_fiscal_output ? (
                                <CardContent>
                                    <div className="grid grid-cols-12 gap-6">



                                        {/* Row 1: Tax Group (Rule Strategy) */}
                                        <div className="col-span-12">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupo Tributário *</label>
                                            <TaxGroupSelector
                                                value={formData.tax_group_id}
                                                onChange={(val) => handleTaxGroupChange(val || '')}
                                                onGroupUpdated={() => {
                                                    if (selectedCompany) getTaxGroups(createClient(), selectedCompany.id).then(setTaxGroups);
                                                }}
                                                className={cn("mt-1", errors.tax_group_id && "border-red-500 rounded-2xl")}
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">Define as regras de tributação (ICMS, IPI, PIS, COFINS).</p>
                                            {errors.tax_group_id && <p className="text-xs text-red-500 mt-1">{errors.tax_group_id}</p>}
                                        </div>

                                        {/* Row 2: Origin, NCM & CEST (Product Classification - Independent) */}
                                        <div className="col-span-12 md:col-span-6">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Origem da Mercadoria *</label>
                                            <Select
                                                value={formData.origin?.toString() ?? "0"}
                                                onValueChange={(val) => handleChange('origin', parseInt(val))}
                                            >
                                                <SelectTrigger className="mt-1">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">0 - Nacional</SelectItem>
                                                    <SelectItem value="1">1 - Estrangeira (Imp. Direta)</SelectItem>
                                                    <SelectItem value="2">2 - Estrangeira (Adq. No Mercado Interno)</SelectItem>
                                                    <SelectItem value="3">3 - Nacional (Conteúdo Superior 40%)</SelectItem>
                                                    <SelectItem value="4">4 - Nacional (Produção conformidade)</SelectItem>
                                                    <SelectItem value="5">5 - Nacional (Conteúdo Inferior 40%)</SelectItem>
                                                    <SelectItem value="6">6 - Estrangeira (Imp. Direta s/ Similar)</SelectItem>
                                                    <SelectItem value="7">7 - Estrangeira (Adq. Mercado Interno s/ Similar)</SelectItem>
                                                    <SelectItem value="8">8 - Nacional (Importação Superior 70%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="col-span-6 md:col-span-3">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NCM *</label>
                                            <Input
                                                value={formData.ncm || ''}
                                                onChange={(e) => handleChange('ncm', e.target.value)}
                                                placeholder="8 dígitos"
                                                className={cn("mt-1", errors.ncm && "border-red-500")}
                                                maxLength={8}
                                            />
                                            {errors.ncm && <p className="text-xs text-red-500 mt-1">{errors.ncm}</p>}
                                        </div>
                                        <div className="col-span-6 md:col-span-3">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CEST</label>
                                            <Input
                                                value={formData.cest || ''}
                                                onChange={(e) => handleChange('cest', e.target.value)}
                                                placeholder="7 dígitos (Opcional)"
                                                className={cn("mt-1", errors.cest && "border-red-500")}
                                                maxLength={7}
                                            />
                                            {errors.cest && <p className="text-xs text-red-500 mt-1">{errors.cest}</p>}
                                        </div>
                                    </div>
                                </CardContent>
                            ) : (
                                <CardContent>
                                    <p className="text-sm text-gray-500 italic">Este item não exige configuração fiscal de saída (ex: uso/consumo interno ou serviço sem emissão).</p>
                                </CardContent>
                            )}
                        </Card>
                    </TabsContent>

                    {/* --- TAB PRODUÇÃO (PCP) --- */}
                    <TabsContent value="production" className="mt-0 space-y-6">

                        {/* CARD 1: Parâmetros */}
                        <Card>
                            <CardHeaderStandard
                                icon={<Factory className="w-5 h-5" />}
                                title="Parâmetros de Produção"
                            />
                            <CardContent>
                                <div className="grid grid-cols-12 gap-6">
                                    <div className="col-span-12 md:col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rendimento (Lote)*</label>
                                        <Input
                                            type="number"
                                            value={(formData as any).batch_size || ''}
                                            onChange={(e) => handleChange('batch_size', parseFloat(e.target.value))}
                                            className="mt-1"
                                            min={0.001}
                                            step="any"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Quanto este lote rende ao final.</p>
                                    </div>
                                    <div className="col-span-12 md:col-span-3">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidade de Produção</label>
                                        <UomSelector
                                            value={formData.production_uom_id}
                                            onChange={(val) => handleChange('production_uom_id', val)}
                                            onSelect={(uom) => {
                                                // Sync Production UOM if it was same as base or unset
                                                if (!formData.production_uom_id || formData.production_uom_id === formData.uom_id) {
                                                    handleChange('production_uom_id', uom.id);
                                                }
                                            }}
                                            className="mt-1"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Unidade do produto final.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* CARD 2: Receita / BOM */}
                        <Card className="border-l-4 border-l-brand-500">
                            <CardHeaderStandard
                                icon={<Receipt className="w-5 h-5" />}
                                title="Receita / Ficha Técnica"
                                actions={
                                    <div className="text-right flex flex-col items-end gap-1">
                                        {recipeLines.length > 0 ? (
                                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                Receita Cadastrada
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                                Sem Receita
                                            </span>
                                        )}
                                    </div>
                                }
                            />
                            <CardContent className="p-0">
                                {/* Grid de Insumos */}
                                <div className="border-t border-gray-100">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-gray-600 w-[50%]">Insumo (Matéria-prima/Emb.)</th>
                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[15%]">Qtd.</th>
                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[10%]">Unid.</th>
                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[20%]">Obs.</th>
                                                <th className="px-4 py-3 w-[5%]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {recipeLines.map((line, idx) => (
                                                <tr key={line.id || idx} className="group hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-2 relative">
                                                        {/* Searchable Input Logic */}
                                                        {ingredientSearchOpen === line.id ? (
                                                            <div className="absolute top-1 left-3 right-3 z-10">
                                                                <Input
                                                                    autoFocus
                                                                    value={ingredientSearchTerm}
                                                                    onChange={(e) => setIngredientSearchTerm(e.target.value)}
                                                                    onBlur={() => {
                                                                        // Small timeout to allow click on option
                                                                        setTimeout(() => setIngredientSearchOpen(null), 200);
                                                                    }}
                                                                    placeholder="Buscar insumo..."
                                                                    className="h-9 border-brand-500 ring-1 ring-brand-500"
                                                                />
                                                                {ingredientSearchTerm && (
                                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-card border border-gray-100 max-h-48 overflow-y-auto z-20">
                                                                        {filteredIngredients.length > 0 ? filteredIngredients.map(item => (
                                                                            <div
                                                                                key={item.id}
                                                                                className="px-3 py-2 hover:bg-brand-50 cursor-pointer text-sm"
                                                                                onMouseDown={() => handleIngredientSelect(line.id, item)}
                                                                            >
                                                                                <div className="font-medium">{item.name}</div>
                                                                                <div className="text-[10px] text-gray-400">{item.sku} • {item.uom}</div>
                                                                            </div>
                                                                        )) : (
                                                                            <div className="px-3 py-2 text-gray-400 text-xs text-center">Nenhum item encontrado.</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="h-9 flex items-center px-1 cursor-text border border-transparent hover:border-gray-200 rounded text-gray-800"
                                                                onClick={() => handleIngredientSearchOpen(line.id, line.component_item_id)}
                                                            >
                                                                {availableIngredients.find(i => i.id === line.component_item_id)?.name || <span className="text-gray-400 italic">Selecione o insumo...</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <Input
                                                            type="number"
                                                            value={line.qty}
                                                            onChange={(e) => updateRecipeLine(line.id, 'qty', parseFloat(e.target.value))}
                                                            className="h-8 text-right"
                                                            min={0}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center text-xs text-gray-500 h-8 justify-center bg-gray-100 rounded">
                                                            {line.uom}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-2">
                                                        <Input
                                                            value={line.notes || ''}
                                                            onChange={(e) => updateRecipeLine(line.id, 'notes', e.target.value)}
                                                            className="h-8 text-xs"
                                                            placeholder="..."
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeRecipeLine(line.id)}
                                                            className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Remover linha"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Ações de Rodapé */}
                                <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
                                    <Button variant="outline" size="sm" onClick={addRecipeLine} className="gap-2">
                                        <Plus className="w-4 h-4" />
                                        Adicionar Insumo
                                    </Button>

                                    <div className="flex gap-6 text-sm">
                                        <div className="text-gray-500">
                                            Total de Insumos: <span className="font-medium text-gray-900">{recipeLines.length}</span>
                                        </div>
                                        <div className="text-gray-500">
                                            Custo Estimado: <span className="font-medium text-gray-900">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRecipeCost)}
                                            </span>
                                        </div>
                                        <div className="text-gray-500">
                                            Rendimento: <span className="font-medium text-gray-900">{(formData as any).batch_size} {productionUomLabel}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção de Co-produtos (Output Adicional) */}
                                <div className="border-t border-gray-100 p-4 bg-white rounded-b-2xl">
                                    {!showByproducts && byproducts.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={addByproductLine}
                                            className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Adicionar co-produto (output adicional)
                                        </button>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                                        Co-produtos / Subprodutos
                                                        <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-[10px]">
                                                            {byproducts.length}
                                                        </span>
                                                    </h4>
                                                    {!showByproducts && byproducts.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowByproducts(true)}
                                                            className="text-[10px] text-brand-600 hover:underline"
                                                        >
                                                            Ver detalhes
                                                        </button>
                                                    )}
                                                </div>
                                                {showByproducts && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowByproducts(false)}
                                                        className="text-[10px] text-gray-400 hover:text-gray-600"
                                                    >
                                                        Recolher
                                                    </button>
                                                )}
                                            </div>

                                            {showByproducts && (
                                                <div className="border border-gray-100 rounded-xl overflow-hidden mt-2">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left font-medium text-gray-600 w-[40%]">Produto (Co-produto)</th>
                                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[15%]">Qtd.</th>
                                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[15%]">Base / Unid.</th>
                                                                <th className="px-4 py-3 text-center font-medium text-gray-600 w-[25%]">Obs.</th>
                                                                <th className="px-4 py-3 w-[5%]"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {byproducts.map((bp, idx) => {
                                                                const item = availableIngredients.find(i => i.id === bp.item_id);
                                                                return (
                                                                    <tr key={bp.id || idx} className="group hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-2 relative">
                                                                            {byproductSearchOpen === bp.id ? (
                                                                                <div className="absolute top-1 left-3 right-3 z-10">
                                                                                    <Input
                                                                                        autoFocus
                                                                                        value={byproductSearchTerm}
                                                                                        onChange={(e) => setByproductSearchTerm(e.target.value)}
                                                                                        onBlur={() => setTimeout(() => setByproductSearchOpen(null), 200)}
                                                                                        placeholder="Buscar co-produto..."
                                                                                        className="h-9 border-brand-500 ring-1 ring-brand-500"
                                                                                    />
                                                                                    {byproductSearchTerm && (
                                                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-card border border-gray-100 max-h-48 overflow-y-auto z-20">
                                                                                            {filteredByproducts.length > 0 ? filteredByproducts.map(searchItem => (
                                                                                                <div
                                                                                                    key={searchItem.id}
                                                                                                    className="px-3 py-2 hover:bg-brand-50 cursor-pointer text-sm"
                                                                                                    onMouseDown={() => {
                                                                                                        handleByproductSelect(bp.id, searchItem);
                                                                                                    }}
                                                                                                >
                                                                                                    <div className="font-medium">{searchItem.name}</div>
                                                                                                    <div className="text-[10px] text-gray-400">{searchItem.sku} • {searchItem.uom}</div>
                                                                                                </div>
                                                                                            )) : (
                                                                                                <div className="px-3 py-2 text-gray-400 text-xs text-center">Nenhum item encontrado.</div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div
                                                                                    className="h-9 flex items-center px-1 cursor-text border border-transparent hover:border-gray-200 rounded text-gray-800"
                                                                                    onClick={() => handleByproductSearchOpen(bp.id, bp.item_id)}
                                                                                >
                                                                                    {item?.name || <span className="text-gray-400 italic">Selecionar produto...</span>}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <Input
                                                                                type="number"
                                                                                value={bp.qty}
                                                                                onChange={(e) => updateByproductLine(bp.id, 'qty', parseFloat(e.target.value))}
                                                                                className="h-8 text-right"
                                                                                min={0}
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <div className="flex flex-col gap-1">
                                                                                <Select
                                                                                    value={bp.basis}
                                                                                    onValueChange={(val) => updateByproductLine(bp.id, 'basis', val)}
                                                                                >
                                                                                    <SelectTrigger className="h-7 text-[10px] px-2 bg-gray-50 border-gray-200">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        <SelectItem value="PERCENT">%</SelectItem>
                                                                                        <SelectItem value="FIXED">Fixo</SelectItem>
                                                                                    </SelectContent>
                                                                                </Select>
                                                                                <div className="flex items-center text-[10px] text-gray-500 h-6 justify-center bg-gray-100 rounded uppercase">
                                                                                    {bp.basis === 'PERCENT' ? '%' : (item?.uom || '-')}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-2">
                                                                            <Input
                                                                                value={bp.notes || ''}
                                                                                onChange={(e) => updateByproductLine(bp.id, 'notes', e.target.value)}
                                                                                className="h-8 text-xs"
                                                                                placeholder="..."
                                                                            />
                                                                        </td>
                                                                        <td className="px-4 py-2 text-center">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeByproductLine(bp.id)}
                                                                                className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                                title="Remover linha"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>

                                                    {/* Rodapé Interno da Tabela de Co-produtos */}
                                                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={addByproductLine}
                                                            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            Adicionar outro co-produto
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB LOGÍSTICA & EMBALAGENS --- */}
                    <TabsContent value="logistics" className="mt-0 space-y-6">
                        <Card>
                            <CardHeaderStandard
                                icon={<Box className="w-5 h-5" />}
                                title="Embalagens e Apresentações"
                                actions={
                                    <Button
                                        onClick={() => handleOpenPackagingModal()}
                                        className="bg-brand-600 hover:bg-brand-700 text-white rounded-full px-4 text-xs h-8 shadow-sm transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                                        Adicionar Embalagem
                                    </Button>
                                }
                            />
                            <CardContent>
                                <PackagingList
                                    packagings={formData.packagings || []}
                                    baseUom={currentBaseUom}
                                    onEdit={handleOpenPackagingModal}
                                    onDelete={(idx) => setPackagingToDeleteIndex(idx)}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>

            <PackagingModal
                isOpen={packagingModalOpen}
                onClose={() => setPackagingModalOpen(false)}
                onSave={handleSavePackaging}
                initialData={editingPackagingIndex !== null ? (formData.packagings?.[editingPackagingIndex]) : undefined}
                baseUom={currentBaseUom}
                baseNetWeight={formData.net_weight_kg_base || 0}
                baseGrossWeight={formData.gross_weight_kg_base || 0}
            />

            <ConfirmDialogDesdobra
                open={packagingToDeleteIndex !== null}
                onOpenChange={(open) => !open && setPackagingToDeleteIndex(null)}
                title="Remover Embalagem"
                description="Tem certeza que deseja remover esta embalagem? Esta ação não pode ser desfeita após salvar."
                onConfirm={confirmDeletePackaging}
                variant="danger"
            />

            <ConfirmDialogDesdobra
                open={showNoRecipeConfirm}
                onOpenChange={setShowNoRecipeConfirm}
                title="Produto sem Receita"
                description="Este item está marcado como produzido, mas não possui nenhuma receita (insumos) cadastrada. Deseja salvar mesmo assim?"
                onConfirm={handleConfirmNoRecipe}
                variant="danger"
                isLoading={isLoading}
                confirmText="Salvar Mesmo Assim"
            />
        </div>
    );
}
