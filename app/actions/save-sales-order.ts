"use server";

import { upsertSalesDocument, upsertSalesItem } from "@/lib/data/sales-orders";
import { SalesOrder, SalesItem } from "@/types/sales";

import { getActiveCompanyId } from "@/lib/auth/get-active-company";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { logger } from "@/lib/logger";

// Define input types more strictly
type SalesItemInput = Partial<SalesItem> & {
    item_id?: string;
    packaging_id?: string;
    [key: string]: unknown
};

function getRecordValue(record: unknown, key: string): unknown {
    if (!record || typeof record !== 'object') return undefined;
    return (record as Record<string, unknown>)[key];
}

export async function saveSalesOrderAction(
    doc: Partial<SalesOrder>,
    items: unknown[], // We cast this carefully
    deletedItemIds: string[],
    // userId param removed or ignored if not used, 
    // keeping argument for signature compatibility if needed, but best to remove.
    // We'll keep it optional to avoid matching errors if called with 4 args.
    _userId?: string
) {
    try {
        const companyId = await getActiveCompanyId();
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) throw new Error("Unauthorized");

        doc.company_id = companyId;

        // SECURITY: This action must operate under the user's session (RLS enforced).
        // Cross-tenant updates should be blocked by RLS, but we also validate IDs to return clearer errors.
        if (doc.id) {
            const { data: existingDoc, error: existingDocError } = await supabase
                .from('sales_documents')
                .select('id, company_id')
                .eq('id', doc.id)
                .maybeSingle();

            if (existingDocError) {
                throw new Error(existingDocError.message || 'Erro ao validar documento');
            }

            if (!existingDoc) {
                throw new Error("Documento inválido (não encontrado ou sem permissão).");
            }

            if (existingDoc.company_id !== companyId) {
                throw new Error("Forbidden: Documento não pertence à empresa ativa.");
            }
        }

        // 1. Save Document Header
        const savedDoc = await upsertSalesDocument(supabase, doc);
        if (savedDoc.company_id !== companyId) {
            throw new Error("Forbidden: Documento salvo fora do escopo da empresa ativa.");
        }

        // 2. Save/Update Items
        const savedItems = [];
        const { resolveDefaultPackagingId, resolvePackagingSnapshot } = await import("@/lib/packaging");

        // Cast items to a safer type for iteration
        const safeItems = items as SalesItemInput[];

        for (const item of safeItems) {
            const itemId = item.id;
            if (itemId && !itemId.startsWith('temp-')) {
                const { data: existingItem, error: existingItemError } = await supabase
                    .from('sales_document_items')
                    .select('id, document_id, document:sales_documents(company_id)')
                    .eq('id', itemId)
                    .maybeSingle();

                if (existingItemError) {
                    throw new Error(existingItemError.message || 'Erro ao validar item');
                }

                // If an ID was provided, it MUST exist and MUST belong to the same company + document.
                if (!existingItem) {
                    throw new Error("Item inválido (não encontrado).");
                }

                type ExistingItemRow = {
                    id: string;
                    document_id: string;
                    document: { company_id: string } | { company_id: string }[] | null;
                };
                const typedExistingItem = existingItem as unknown as ExistingItemRow;
                const rawDoc = typedExistingItem.document;
                const existingCompanyId = Array.isArray(rawDoc) ? rawDoc[0]?.company_id : rawDoc?.company_id;

                if (existingCompanyId && existingCompanyId !== companyId) {
                    throw new Error("Forbidden: Item não pertence à empresa ativa.");
                }

                if (typedExistingItem.document_id !== savedDoc.id) {
                    throw new Error("Item inválido: não pertence ao documento informado.");
                }
            }

            // Validate/Resolve Packaging if missing
            if (!item.packaging_id) {
                const companyId = savedDoc.company_id;
                if (companyId && item.item_id) {
                    const resolvedId = await resolveDefaultPackagingId(supabase, companyId, item.item_id);
                    if (resolvedId) {
                        item.packaging_id = resolvedId;
                    } else {
                        // Throw error if no default packaging found for item needing one
                        throw new Error(`Item (ID: ${item.item_id}) sem embalagem padrão cadastrada. Cadastre uma embalagem e marque como padrão.`);
                    }
                }
            }

            // Link item to document
            const itemPayload: Record<string, unknown> = { ...item, document_id: savedDoc.id };

            // --- Snapshot Logic ---
            try {
                if (item.packaging_id) {
                    const snapshot = await resolvePackagingSnapshot(supabase, item.packaging_id);
                    if (snapshot) {
                        itemPayload.sales_unit_snapshot = snapshot;
                    }
                } else if (item.item_id) {
                    // Fallback for UN items (no packaging)
                    const { data: prod } = await supabase
                        .from('items')
                        .select('uom, uom_id, base_uom:uoms!uom_id(abbrev, name)')
                        .eq('id', item.item_id)
                        .single();

                    if (prod) {
                        // Safe usage of prod.base_uom (Supabase can return single or array)
                        const rawBaseUom = getRecordValue(prod, 'base_uom');
                        const baseUom = (Array.isArray(rawBaseUom) ? rawBaseUom[0] : rawBaseUom) as unknown as { abbrev?: unknown; name?: unknown } | null;
                        const abbrevCandidate = typeof baseUom?.abbrev === 'string' ? baseUom.abbrev : undefined;
                        const prodUom = getRecordValue(prod, 'uom');
                        const prodUomCandidate = typeof prodUom === 'string' ? prodUom : undefined;
                        const abbrev = abbrevCandidate || prodUomCandidate || 'Un';
                        const nameCandidate = typeof baseUom?.name === 'string' ? baseUom.name : undefined;

                        itemPayload.sales_unit_snapshot = {
                            sell_uom_id: prod.uom_id,
                            base_uom_id: prod.uom_id,
                            sell_unit_code: abbrev,
                            base_unit_code: abbrev,
                            factor_in_base: 1,
                            auto_label: nameCandidate || 'Unidade'
                        };
                    }
                }
            } catch (snapErr) {
                logger.warn("Failed to generate sales_unit_snapshot:", snapErr);
            }

            const savedItem = await upsertSalesItem(supabase, itemPayload);
            savedItems.push(savedItem);
        }

        // 3. Delete Removed Items
        if (deletedItemIds && deletedItemIds.length > 0) {
            await supabase
                .from('sales_document_items')
                .delete()
                .eq('document_id', savedDoc.id)
                .in('id', deletedItemIds);
        }

        return { success: true, data: { ...savedDoc, items: savedItems } };

    } catch (e: unknown) {
        logger.error("Server Action Error:", e);

        const errorMessage = e instanceof Error ? e.message : '';
        const errorCode = (e as Record<string, unknown>)?.code;

        if (errorMessage?.includes("new row violates row-level security policy") || errorCode === '42501') {
            return { success: false, error: "Falha ao salvar. Verifique permissões de acesso." };
        }

        return { success: false, error: errorMessage || "Erro desconhecido no servidor." };
    }
}
