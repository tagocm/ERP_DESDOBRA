import { createClient } from '@/utils/supabase/server';
import { RecurringRule, RecurringRuleStatus, AmountType } from '@/types/recurring-rules';
import { getActiveCompanyId } from '@/lib/auth/get-active-company';

export interface GetRecurringRulesFilters {
    search?: string;
    status?: RecurringRuleStatus | 'ALL';
    type?: AmountType | 'ALL';
    sortBy?: 'recent' | 'name_asc';
}

export async function getRecurringRules(filters: GetRecurringRulesFilters = {}) {
    const supabase = await createClient();
    const companyId = await getActiveCompanyId();

    if (!companyId) {
        throw new Error('Empresa não encontrada para este usuário.');
    }

    let query = supabase
        .from('recurring_rules')
        .select('*')
        .eq('company_id', companyId);

    if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
    }

    if (filters.type && filters.type !== 'ALL') {
        query = query.eq('amount_type', filters.type);
    }

    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,partner_name.ilike.%${filters.search}%`);
    }

    if (filters.sortBy === 'name_asc') {
        query = query.order('name', { ascending: true });
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching recurring rules:', error);
        // If table doesn't exist, return empty array for now to avoid crashing UI
        if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('relation "recurring_rules" does not exist')) {
            return [];
        }
        throw error;
    }

    return (data || []) as RecurringRule[];
}
