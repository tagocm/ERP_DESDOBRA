import { createClient } from '@/utils/supabase/server'

export interface PurchaseOrder {
    id: string
    document_number?: number
    company_id: string
    supplier_id: string | null
    status: 'draft' | 'sent' | 'received' | 'cancelled'

    // Operational Block
    receiving_blocked?: boolean
    receiving_blocked_reason?: string | null
    receiving_blocked_at?: string | null
    receiving_blocked_by?: string | null

    ordered_at: string
    expected_at: string | null
    notes: string | null
    payment_terms_id?: string | null
    payment_mode_id?: string | null
    price_table_id?: string | null
    freight_amount?: number
    discount_amount?: number
    subtotal_amount?: number
    total_amount?: number
    total_weight_kg?: number
    total_gross_weight_kg?: number
    delivery_address_json?: any
    created_by: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    supplier?: {
        id: string
        name: string
        trade_name?: string
        document?: string
        email?: string
        phone?: string
    }
    items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
    id: string
    company_id: string
    purchase_order_id: string
    item_id: string
    packaging_id?: string | null
    qty_display: number
    uom_label: string
    conversion_factor: number
    qty_base: number
    unit_cost: number | null
    total_cost: number | null
    notes: string | null
    created_at: string
    updated_at: string
    item?: {
        id: string
        name: string
        uom: string
    }
}

export const purchasesRepository = {
    /**
     * List purchase orders with filters
     */
    async listPurchaseOrders(
        companyId: string,
        filters?: {
            status?: string
            supplier_id?: string
            from_date?: string
            to_date?: string
            show_archived?: boolean
        }
    ) {
        const supabase = await createClient()

        let query = supabase
            .from('purchase_orders')
            .select(`
                *,
                supplier:organizations!supplier_id(id, name:trade_name),
                payment_term:payment_terms!payment_terms_id(name),
                payment_mode:payment_modes!payment_mode_id(name),
                items:purchase_order_items(
                    id,
                    qty_display,
                    uom_label,
                    unit_cost,
                    total_cost,
                    item:items(id, name, uom)
                )
            `)
            .eq('company_id', companyId)
            .order('ordered_at', { ascending: false })

        // Default: hide archived (deleted_at IS NULL)
        // If show_archived is TRUE, we show everything (or could show ONLY archived? Standard is Include)
        // User requested: "ON: incluir arquivados (remover filtro ou usar deleted_at IS NOT NULL dependendo da UX)"
        // Let's implement "Include Archived" (don't filter).
        if (!filters?.show_archived) {
            query = query.is('deleted_at', null)

            // Hide cancelled orders if no specific status is requested
            // This groups "Cancelled" with "Archived" in terms of default visibility
            if (!filters?.status) {
                query = query.neq('status', 'cancelled')
            }
        }

        if (filters?.status) {
            query = query.eq('status', filters.status)
        }
        if (filters?.supplier_id) {
            query = query.eq('supplier_id', filters.supplier_id)
        }
        if (filters?.from_date) {
            query = query.gte('ordered_at', filters.from_date)
        }
        if (filters?.to_date) {
            query = query.lte('ordered_at', filters.to_date)
        }

        return await query
    },

    /**
     * Get purchase order by ID with all details
     */
    async getPurchaseOrderById(companyId: string, purchaseOrderId: string) {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
                *,
                supplier:organizations!supplier_id(id, name:trade_name, document:document_number, trade_name, email, phone),
                items:purchase_order_items(
                    *,
                    item:items(
                        id, 
                        name, 
                        uom, 
                        sku
                    )
                )
            `)
            .eq('company_id', companyId)
            .eq('id', purchaseOrderId)
            // .is('deleted_at', null)
            .single()

        if (error) {
            console.error('Error fetching purchase order:', error)
            return { data: null, error }
        }

        return { data, error: null }
    },

    /**
     * Create purchase order with items
     */
    async createPurchaseOrder(
        companyId: string,
        userId: string,
        data: {
            supplier_id?: string | null
            expected_at?: string | null
            notes?: string | null
            payment_terms_id?: string | null
            payment_mode_id?: string | null
            price_table_id?: string | null
            freight_amount?: number
            discount_amount?: number
            subtotal_amount?: number
            total_amount?: number
            total_weight_kg?: number
            total_gross_weight_kg?: number
            delivery_address_json?: any
            items: Array<{
                item_id: string
                packaging_id?: string | null
                qty_display: number
                uom_label: string
                conversion_factor: number
                unit_cost?: number | null
                notes?: string | null
            }>
        }
    ) {
        const supabase = await createClient()

        // 1. Create purchase order
        const { data: po, error: poError } = await supabase
            .from('purchase_orders')
            .insert({
                company_id: companyId,
                supplier_id: data.supplier_id || null,
                status: 'draft',
                expected_at: data.expected_at || null,
                notes: data.notes || null,
                payment_terms_id: data.payment_terms_id || null,
                payment_mode_id: data.payment_mode_id || null,
                price_table_id: data.price_table_id || null,
                freight_amount: data.freight_amount || 0,
                discount_amount: data.discount_amount || 0,
                subtotal_amount: data.subtotal_amount || 0,
                total_amount: data.total_amount || 0,
                total_weight_kg: data.total_weight_kg || 0,
                total_gross_weight_kg: data.total_gross_weight_kg || 0,
                delivery_address_json: data.delivery_address_json || null,
                created_by: userId,
                ordered_at: new Date().toISOString()
            })
            .select()
            .single()

        if (poError) throw poError

        // 2. Create purchase order items
        if (data.items.length > 0) {
            const itemsToInsert = data.items.map(item => ({
                company_id: companyId,
                purchase_order_id: po.id,
                item_id: item.item_id,
                packaging_id: item.packaging_id || null,
                qty_display: item.qty_display,
                uom_label: item.uom_label,
                conversion_factor: item.conversion_factor,
                qty_base: item.qty_display * item.conversion_factor,
                unit_cost: item.unit_cost || null,
                total_cost: item.unit_cost ? item.qty_display * item.unit_cost : null,
                notes: item.notes || null
            }))

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert)

            if (itemsError) throw itemsError
        }

        return { data: po }
    },

    /**
     * Update purchase order and items
     */
    async updatePurchaseOrder(
        companyId: string,
        purchaseOrderId: string,
        data: {
            supplier_id?: string | null
            expected_at?: string | null
            notes?: string | null
            payment_terms_id?: string | null
            payment_mode_id?: string | null
            price_table_id?: string | null
            freight_amount?: number
            discount_amount?: number
            subtotal_amount?: number
            total_amount?: number
            total_weight_kg?: number
            total_gross_weight_kg?: number
            delivery_address_json?: any
            items?: Array<{
                id?: string // if exists, update; if not, create
                item_id: string
                packaging_id?: string | null
                qty_display: number
                uom_label: string
                conversion_factor: number
                unit_cost?: number | null
                notes?: string | null
            }>
        }
    ) {
        const supabase = await createClient()

        // Update purchase order header
        const updates: any = {}
        if (data.supplier_id !== undefined) updates.supplier_id = data.supplier_id
        if (data.expected_at !== undefined) updates.expected_at = data.expected_at
        if (data.notes !== undefined) updates.notes = data.notes
        if (data.payment_terms_id !== undefined) updates.payment_terms_id = data.payment_terms_id
        if (data.payment_mode_id !== undefined) updates.payment_mode_id = data.payment_mode_id
        if (data.price_table_id !== undefined) updates.price_table_id = data.price_table_id
        if (data.freight_amount !== undefined) updates.freight_amount = data.freight_amount
        if (data.discount_amount !== undefined) updates.discount_amount = data.discount_amount
        if (data.subtotal_amount !== undefined) updates.subtotal_amount = data.subtotal_amount
        if (data.total_amount !== undefined) updates.total_amount = data.total_amount
        if (data.total_weight_kg !== undefined) updates.total_weight_kg = data.total_weight_kg
        if (data.total_gross_weight_kg !== undefined) updates.total_gross_weight_kg = data.total_gross_weight_kg
        if (data.delivery_address_json !== undefined) updates.delivery_address_json = data.delivery_address_json

        if (Object.keys(updates).length > 0) {
            const { error } = await supabase
                .from('purchase_orders')
                .update(updates)
                .eq('id', purchaseOrderId)
                .eq('company_id', companyId)

            if (error) throw error
        }

        // Update items if provided
        if (data.items) {
            // Delete all existing items
            await supabase
                .from('purchase_order_items')
                .delete()
                .eq('purchase_order_id', purchaseOrderId)
                .eq('company_id', companyId)

            // Re-insert items
            if (data.items.length > 0) {
                const itemsToInsert = data.items.map(item => ({
                    company_id: companyId,
                    purchase_order_id: purchaseOrderId,
                    item_id: item.item_id,
                    packaging_id: item.packaging_id || null,
                    qty_display: item.qty_display,
                    uom_label: item.uom_label,
                    conversion_factor: item.conversion_factor,
                    qty_base: item.qty_display * item.conversion_factor,
                    unit_cost: item.unit_cost || null,
                    total_cost: item.unit_cost ? item.qty_display * item.unit_cost : null,
                    notes: item.notes || null
                }))

                const { error: itemsError } = await supabase
                    .from('purchase_order_items')
                    .insert(itemsToInsert)

                if (itemsError) throw itemsError
            }
        }

        return { success: true }
    },

    /**
     * Receive purchase order: change status to 'received' and create inventory movements
     */
    async receivePurchaseOrder(
        companyId: string,
        userId: string,
        purchaseOrderId: string,
        receiptData?: {
            supplier_invoice_number: string
            supplier_invoice_series?: string
            supplier_invoice_date?: string
            payment_terms_id?: string
            payment_mode_id?: string
            generate_financial?: boolean
            receipt_notes?: string
            received_at?: string
        }
    ) {
        const supabase = await createClient()

        // 1. Get purchase order with items
        const { data: po, error: poError } = await this.getPurchaseOrderById(companyId, purchaseOrderId)
        if (poError || !po) {
            throw new Error(`Error fetching PO: ${poError?.message || 'Purchase order not found'} (${poError?.code || 'Unknown'})`)
        }

        if (po.status === 'received') {
            throw new Error('Purchase order already received')
        }
        if (po.status === 'cancelled') {
            throw new Error('Cannot receive a cancelled purchase order')
        }

        // Validate mandatory invoice number if receiptData provided (or enforce strictly if new flow)
        // For backward compatibility, we'll allow missing data but warn/default, but user wants STRICT flow.
        // "Não permitir concluir sem NF + data entrada."
        if (receiptData) {
            if (!receiptData.supplier_invoice_number) {
                throw new Error('Invoice Number is required for receipt.')
            }
        }

        // @ts-ignore
        const items = po.items as any[]

        // 2. Create inventory movements for each item
        for (const item of items) {
            await supabase.from('inventory_movements').insert({
                company_id: companyId,
                item_id: item.item_id,
                movement_type: 'ENTRADA',
                qty_base: item.qty_base,
                qty_in: item.qty_base,
                qty_out: 0,
                reference_type: 'PURCHASE_ORDER',
                reference_id: purchaseOrderId,
                occurred_at: receiptData?.received_at || new Date().toISOString(),
                // @ts-ignore
                notes: `NF ${receiptData?.supplier_invoice_number || 'S/N'} - ${po.supplier?.name || 'Compra'}`,
                created_by: userId
            })
        }

        // 3. Create or Update AP Title (Pending Approval) only if generate_financial is true
        // Default to true if receiptData is missing (legacy behavior compatibility) or explicitly set
        const shouldGenerateFinancial = receiptData?.generate_financial !== false

        if (shouldGenerateFinancial) {
            const paymentTermsId = receiptData?.payment_terms_id || po.payment_terms_id
            const paymentModeId = receiptData?.payment_mode_id || po.payment_mode_id

            // Note: A trigger might have created this when status became 'sent'.
            // We use upsert to ensure it exists and update dates/amounts if needed.
            const { data: apTitle, error: apError } = await supabase.from('ap_titles').upsert({
                company_id: companyId,
                purchase_order_id: purchaseOrderId,
                supplier_id: po.supplier_id,
                status: 'PENDING_APPROVAL',
                amount_total: po.total_amount || 0,
                amount_paid: 0,
                amount_open: po.total_amount || 0,
                date_issued: receiptData?.supplier_invoice_date || new Date().toISOString(),
                due_date: po.expected_at || new Date().toISOString(),
                payment_terms_snapshot: paymentTermsId,
                payment_method_snapshot: paymentModeId,
                document_number: receiptData?.supplier_invoice_number, // Link Invoice Number to AP Title
                // If it existed, preserve created info but ensure these fields are set
                attention_status: (!paymentTermsId || !paymentModeId) ? 'EM_ATENCAO' : null,
                attention_reason: (!paymentTermsId || !paymentModeId) ? 'Dados de pagamento incompletos.' : null
            }, {
                onConflict: 'purchase_order_id'
            }).select().single()

            if (apError) {
                console.error("Error creating/updating AP Title on receipt:", apError)
                throw apError
            }

            // Generate Installments based on Payment Terms
            if (apTitle && paymentTermsId) {
                // Fetch Payment Terms Config
                const { data: termsConfig } = await supabase
                    .from('payment_terms')
                    .select('installments_count, first_due_days, cadence_days')
                    .eq('id', paymentTermsId)
                    .single();

                if (termsConfig) {
                    const count = termsConfig.installments_count || 1;
                    const firstDue = termsConfig.first_due_days || 0;
                    const cadence = termsConfig.cadence_days || 30;
                    const totalAmount = Number(po.total_amount || 0);

                    // Base date: invoice date or today
                    const baseDate = new Date(receiptData?.supplier_invoice_date || new Date());

                    // Split amount
                    const baseInstallment = Math.floor((totalAmount / count) * 100) / 100;
                    const remainder = Number((totalAmount - (baseInstallment * count)).toFixed(2));

                    const installmentsToInsert = [];

                    for (let i = 1; i <= count; i++) {
                        const dueDate = new Date(baseDate);
                        // Logic: 1st installment = base + first_due
                        // Subsequent = base + first_due + ((i-1) * cadence)
                        // If cadence is null (single installment), loop runs once so it works.
                        const daysToAdd = firstDue + ((i - 1) * (cadence || 0));
                        dueDate.setDate(dueDate.getDate() + daysToAdd);

                        let amount = baseInstallment;
                        if (i === count) {
                            amount += remainder; // Add cents to last installment
                        }

                        installmentsToInsert.push({
                            company_id: companyId,
                            ap_title_id: apTitle.id,
                            installment_number: i,
                            due_date: dueDate.toISOString(),
                            amount_original: amount,
                            amount_open: amount,
                            status: 'OPEN'
                        });
                    }

                    if (installmentsToInsert.length > 0) {
                        // Clear existing installments to prevent duplication/orphans on re-receipt
                        await supabase.from('ap_installments').delete().eq('ap_title_id', apTitle.id);

                        const { error: instError } = await supabase
                            .from('ap_installments')
                            .insert(installmentsToInsert);

                        if (instError) {
                            console.error("Error creating AP Installments:", instError);
                            // Don't block receipt, but log error
                        }
                    }
                }
            }
        }

        // 4. Update purchase order status and receipt fields
        const updatePayload: any = {
            status: 'received',
            updated_at: new Date().toISOString()
        }

        if (receiptData) {
            updatePayload.supplier_invoice_number = receiptData.supplier_invoice_number
            updatePayload.supplier_invoice_series = receiptData.supplier_invoice_series
            updatePayload.supplier_invoice_date = receiptData.supplier_invoice_date
            updatePayload.received_at = receiptData.received_at || new Date().toISOString()
            updatePayload.received_by = userId
            updatePayload.receipt_notes = receiptData.receipt_notes
            // Also update financial fields if they changed during receipt
            if (receiptData.payment_terms_id) updatePayload.payment_terms_id = receiptData.payment_terms_id
            if (receiptData.payment_mode_id) updatePayload.payment_mode_id = receiptData.payment_mode_id
        }

        const { error: updateError } = await supabase
            .from('purchase_orders')
            .update(updatePayload)
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)

        if (updateError) throw updateError

        return { success: true }
    },

    /**
     * Cancel purchase order
     */
    async cancelPurchaseOrder(companyId: string, purchaseOrderId: string, reason?: string) {
        const supabase = await createClient()

        // 1. Validate status
        const { data: po } = await supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)
            .single()

        if (!po) throw new Error('Purchase order not found')

        if (po.status === 'received') {
            throw new Error('Cannot cancel a received purchase order')
        }

        const { error } = await supabase
            .from('purchase_orders')
            .update({
                status: 'cancelled',
                // Log reason if we had a dedicated status history log, but for now just status change.
                // If we add a notes append or similar, do it here.
            })
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)

        if (error) throw error

        return { success: true }
    },

    /**
     * Archive purchase order (Soft Delete)
     */
    async archivePurchaseOrder(companyId: string, userId: string, purchaseOrderId: string, reason: string) {
        const supabase = await createClient()

        // 1. Validate
        const { data: po } = await supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)
            .single()

        if (!po) throw new Error('Purchase order not found')

        // Safety: only draft or cancelled can be archived? 
        // Or any status except 'received'? 
        // Requirement: "Se o documento já gerou movimento de estoque, bloquear"
        if (po.status === 'received') {
            throw new Error('Cannot archive a received purchase order. It has inventory movements.')
        }

        const { error } = await supabase
            .from('purchase_orders')
            .update({
                deleted_at: new Date().toISOString(),
                deleted_by: userId,
                delete_reason: reason
            })
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)

        if (error) throw error

        return { success: true }
    },

    /**
     * Send purchase order (Draft -> Sent)
     */
    async sendPurchaseOrder(companyId: string, purchaseOrderId: string) {
        const supabase = await createClient()

        const { data: po } = await supabase
            .from('purchase_orders')
            .select('status')
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)
            .single()

        if (!po) throw new Error('Purchase order not found')

        if (po.status !== 'draft') {
            throw new Error('Only draft orders can be sent')
        }

        const { error } = await supabase
            .from('purchase_orders')
            .update({ status: 'sent' })
            .eq('id', purchaseOrderId)
            .eq('company_id', companyId)

        if (error) throw error

        return { success: true }
    },

    /**
     * Get items below minimum stock.
     * Logic: items with control_stock=true AND min_stock > 0.
     * Calculates current stock on the fly.
     */
    async getItemsBelowMin(companyId: string) {
        const supabase = await createClient()

        // 1. Get Profiles that need checking (control_stock=true AND min_stock > 0)
        const { data: profiles, error: profileError } = await supabase
            .from('item_inventory_profiles')
            .select('item_id, min_stock, control_stock')
            .eq('company_id', companyId)
            .eq('control_stock', true)
            .gt('min_stock', 0)

        if (profileError) {
            console.error("Error fetching inventory profiles:", profileError)
            throw profileError
        }

        if (!profiles || profiles.length === 0) return []

        const profileMap = new Map<string, typeof profiles[0]>()
        profiles.forEach(p => profileMap.set(p.item_id, p))
        const itemIds = profiles.map(p => p.item_id)

        // 2. Fetch Items details
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('id, name, sku, type, uom')
            .eq('company_id', companyId)
            .in('id', itemIds)

        if (itemsError) {
            console.error("Error fetching items details:", itemsError)
            throw itemsError
        }

        if (!items || items.length === 0) return []

        // 3. Calculate Current Stock
        const { data: movements, error: movError } = await supabase
            .from('inventory_movements')
            .select('item_id, qty_in, qty_out')
            .eq('company_id', companyId)
            .in('item_id', itemIds)

        if (movError) throw movError

        const stockMap = new Map<string, number>()
        movements?.forEach(m => {
            const current = stockMap.get(m.item_id) || 0
            const balance = (m.qty_in || 0) - (m.qty_out || 0)
            stockMap.set(m.item_id, current + balance)
        })

        // 4. Filter items below min
        const belowMinItems = items.map(item => {
            const profile = profileMap.get(item.id)
            const minStock = profile?.min_stock || 0
            const currentStock = stockMap.get(item.id) || 0

            if (currentStock < minStock) {
                return {
                    ...item,
                    min_stock: minStock,
                    current_stock: currentStock
                }
            }
            return null
        }).filter(item => item !== null)

        return belowMinItems
    }
}
