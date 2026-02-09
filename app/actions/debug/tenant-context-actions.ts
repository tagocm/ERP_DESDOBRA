'use server';

import { createClient } from '@/utils/supabase/server';
import { getCompanyId } from '@/app/actions/sales/sales-actions';
import { z } from 'zod';

const TenantContextSchema = z.object({});

export type TenantContextResult = {
    success: boolean;
    data?: {
        userId: string;
        email: string;
        companyId: string;
        roles: string[];
        supabaseUrl: string;
        customersCount: number;
    };
    error?: string;
};

export async function getTenantContextAction(): Promise<TenantContextResult> {
    // Validate input (even if empty) to ensure structure
    TenantContextSchema.parse({});

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        const companyId = await getCompanyId();

        // Get Company Members Role
        const { data: members } = await supabase
            .from('company_members')
            .select('role')
            .eq('auth_user_id', user.id)
            .eq('company_id', companyId);

        const roles = members?.map(m => m.role) || [];

        // Count Customers (Simulate OrganizationSelector logic)
        // Filter: company_id, deleted_at is null, role='customer'
        // Note: OrganizationSelector uses searchOrganizationsAction with type='customer' (or 'all' then filters)
        // The selector usually passes 'customer'.

        // We strictly count 'customer' role
        const { count, error: countError } = await supabase
            .from('organizations')
            .select('organization_roles!inner(role)', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .eq('organization_roles.role', 'customer');

        if (countError) {
            console.error('Count Error:', countError);
        }

        return {
            success: true,
            data: {
                userId: user.id,
                email: user.email || 'unknown',
                companyId,
                roles,
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'unknown',
                customersCount: count || 0,
            }
        };

    } catch (error: unknown) {
        console.error('getTenantContextAction Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
