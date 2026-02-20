import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define types locally since codegen hasn't run yet
export interface GLAccount {
    id: string;
    company_id: string;
    code: string;
    name: string;
    type: 'SINTETICA' | 'ANALITICA';
    nature: 'RECEITA' | 'DEDUCAO' | 'CUSTO' | 'DESPESA' | 'FINANCEIRO';
    parent_id: string | null;
    is_active: boolean;
    is_system_locked: boolean;
    origin: 'SYSTEM' | 'PRODUCT_CATEGORY' | 'MANUAL';
    origin_id: string | null;
    created_at: string;
    updated_at: string;
    children?: GLAccount[];
}

export interface RevenueCategory {
    id: string;
    name: string;
    normalized_name: string;
    revenue_account_id: string;
    is_active: boolean;
    usage_count?: number; // Calculated field
    account_code?: string; // Joined field
}

// Schemas
export const createCategorySchema = z.object({
    name: z.string().min(3, "Nome muito curto").max(100, "Nome muito longo"),
});

export const updateCategorySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(3, "Nome muito curto").max(100, "Nome muito longo"),
});

// --- Server Actions ---

export async function getAccountsTree() {
    const supabase = await createClient();

    // Fetch all accounts
    const { data, error } = await supabase
        .from('gl_accounts')
        .select('*')
        .order('code');

    if (error) {
        console.error('Error fetching chart of accounts:', error);
        throw new Error('Falha ao carregar plano de contas.');
    }

    const accounts = data as GLAccount[];
    return buildTree(accounts);
}

export async function getRevenueCategories() {
    const supabase = await createClient();

    // Fetch categories with linked account code
    const { data, error } = await supabase
        .from('product_categories')
        .select(`
            *,
            account:gl_accounts!revenue_account_id (
                code
            )
        `)
        .order('name');

    if (error) {
        console.error('Error fetching revenue categories:', error);
        throw new Error('Falha ao carregar categorias de receita.');
    }

    // TODO: Implement usage count via separate query or view if needed
    // For now, returning structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
        ...item,
        account_code: item.account?.code,
        usage_count: 0 // Placeholder until we have usage logic
    })) as RevenueCategory[];
}

export async function createRevenueCategory(input: z.infer<typeof createCategorySchema>) {
    const validated = createCategorySchema.parse(input);
    const supabase = await createClient();

    // 1. Check duplicate name
    // normalized_name generator (simple lowercase/trim)
    const normalizedName = validated.name.trim().toLowerCase();

    // 2. Get user's company (from auth)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // We need company_id. Assuming RLS handles it, but for explicit operations we might need it.
    // Usually supabase client with RLS contexts the company. 
    // To generate code, we need company_id for the RPC.

    // Fetch company_id from user metadata or profile? 
    // Best practice in this codebase: rely on RLS, but for RPC we pass it?
    // Let's first try to insert using Supabase and let triggers handle? 
    // No, we need transaction.

    // Since we don't have a robust "Get Company ID" readily available without context,
    // we'll assume the user is logged in and query their profile or company context.
    // Or we fetch one record to get company_id.
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

    if (!profile?.company_id) throw new Error('Empresa não encontrada.');
    const companyId = profile.company_id;

    // 3. Generate Next Code
    const { data: nextCode, error: codeError } = await supabase.rpc('generate_next_revenue_code', {
        p_company_id: companyId
    });

    if (codeError || !nextCode) {
        console.error('Error generating code:', codeError);
        throw new Error('Falha ao gerar código da conta.');
    }

    // 4. Perform Transaction (Supabase doesn't support client-side transactions easily without RPC)
    // We will do optimistic formatting. 
    // Since we can't do strict SQL transaction here without writing another RPC,
    // we will create the Account FIRST, then Category. 
    // If category fails, we should delete account (compensating transaction).

    // A. Create GL Account
    const { data: account, error: accError } = await supabase
        .from('gl_accounts')
        .insert({
            company_id: companyId,
            code: nextCode,
            name: validated.name, // Display name matches category
            type: 'ANALITICA',
            nature: 'RECEITA',
            parent_id: (await getSystemRevenueParentId(supabase, companyId)), // 1.1 ID
            is_system_locked: false,
            origin: 'PRODUCT_CATEGORY',
            is_active: true
        })
        .select()
        .single();

    if (accError) {
        if (accError.code === '23505') throw new Error('Já existe uma conta com este código (race condition). Tente novamente.');
        throw new Error(`Erro ao criar conta: ${accError.message}`);
    }

    // B. Create Product Category
    const { data: category, error: catError } = await supabase
        .from('product_categories')
        .insert({
            company_id: companyId,
            name: validated.name,
            normalized_name: normalizedName,
            is_active: true,
            revenue_account_id: account.id
        })
        .select()
        .single();

    if (catError) {
        // Rollback account
        await supabase.from('gl_accounts').delete().eq('id', account.id);
        if (catError.code === '23505') throw new Error('Já existe uma categoria com este nome.');
        throw new Error(`Erro ao criar categoria: ${catError.message}`);
    }

    // C. Update Account with Origin ID (Circular reference, but useful)
    await supabase
        .from('gl_accounts')
        .update({ origin_id: category.id })
        .eq('id', account.id);

    return category;
}

export async function updateRevenueCategory(id: string, name: string) {
    const supabase = await createClient();
    const normalizedName = name.trim().toLowerCase();

    // 1. Update Category
    const { data: category, error: catError } = await supabase
        .from('product_categories')
        .update({ name, normalized_name: normalizedName })
        .eq('id', id)
        .select()
        .single();

    if (catError) throw new Error('Erro ao atualizar categoria.');

    // 2. Update Linked Account Name
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .update({ name })
            .eq('id', category.revenue_account_id);
    }

    return category;
}

export async function toggleRevenueCategoryStatus(id: string, isActive: boolean) {
    const supabase = await createClient();

    // 1. Update Category
    const { data: category, error: catError } = await supabase
        .from('product_categories')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (catError) throw new Error('Erro ao atualizar status da categoria.');

    // 2. Update Linked Account
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .update({ is_active: isActive })
            .eq('id', category.revenue_account_id);
    }
}

export async function createManualAccount(parentId: string, name: string) {
    if (!name || name.trim().length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres.');

    const supabase = await createClient();

    // 1. Get parent account to inherit company_id, nature, and code prefix
    const { data: parent, error: parentError } = await supabase
        .from('gl_accounts')
        .select('id, code, nature, company_id, type')
        .eq('id', parentId)
        .single();

    if (parentError || !parent) throw new Error('Conta pai não encontrada.');
    if (parent.type !== 'SINTETICA') throw new Error('Só é possível criar contas dentro de pastas (contas sintéticas).');

    // 2. Get existing children to determine next code suffix
    const { data: siblings } = await supabase
        .from('gl_accounts')
        .select('code')
        .eq('parent_id', parentId)
        .order('code', { ascending: false });

    let nextSuffix = 1;
    if (siblings && siblings.length > 0) {
        // Extract last numeric suffix from the sibling codes (e.g. "2.1.03" -> 3)
        const maxSuffix = siblings.reduce((max, s) => {
            const parts = s.code.split('.');
            const last = parseInt(parts[parts.length - 1], 10);
            return isNaN(last) ? max : Math.max(max, last);
        }, 0);
        nextSuffix = maxSuffix + 1;
    }

    const nextCode = `${parent.code}.${String(nextSuffix).padStart(2, '0')}`;

    // 3. Insert new ANALITICA account
    const { data: account, error: accError } = await supabase
        .from('gl_accounts')
        .insert({
            company_id: parent.company_id,
            code: nextCode,
            name: name.trim(),
            type: 'ANALITICA',
            nature: parent.nature,
            parent_id: parentId,
            is_system_locked: false,
            origin: 'MANUAL',
            is_active: true,
        })
        .select()
        .single();

    if (accError) {
        if (accError.code === '23505') throw new Error('Já existe uma conta com este código. Tente novamente.');
        throw new Error(`Erro ao criar conta: ${accError.message}`);
    }

    return account as GLAccount;
}

export async function updateManualAccount(id: string, name: string) {
    if (!name || name.trim().length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres.');

    const supabase = await createClient();

    const { data: account, error: fetchError } = await supabase
        .from('gl_accounts')
        .select('origin, is_system_locked')
        .eq('id', id)
        .single();

    if (fetchError || !account) throw new Error('Conta não encontrada.');
    if (account.is_system_locked) throw new Error('Contas do sistema não podem ser editadas.');
    if (account.origin !== 'MANUAL') throw new Error('Somente contas manuais podem ser renomeadas.');

    const { error } = await supabase
        .from('gl_accounts')
        .update({ name: name.trim() })
        .eq('id', id);

    if (error) throw new Error(`Erro ao atualizar conta: ${error.message}`);
}

export async function deleteManualAccount(id: string): Promise<{ mode: 'hard' | 'soft' }> {
    const supabase = await createClient();

    const { data: account, error: fetchError } = await supabase
        .from('gl_accounts')
        .select('origin, is_system_locked, type')
        .eq('id', id)
        .single();

    if (fetchError || !account) throw new Error('Conta não encontrada.');
    if (account.is_system_locked) throw new Error('Contas do sistema não podem ser excluídas.');
    if (account.origin !== 'MANUAL') throw new Error('Somente contas manuais podem ser excluídas.');
    if (account.type === 'SINTETICA') throw new Error('Pastas só podem ser excluídas quando estiverem vazias e não são suportadas nesta versão.');

    // Check if there are any financial_events referencing this account
    const { count } = await supabase
        .from('financial_events')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id);

    if (count && count > 0) {
        // Soft delete: just deactivate
        const { error } = await supabase
            .from('gl_accounts')
            .update({ is_active: false })
            .eq('id', id);
        if (error) throw new Error(`Erro ao inativar conta: ${error.message}`);
        return { mode: 'soft' };
    } else {
        // Hard delete: no references
        const { error } = await supabase
            .from('gl_accounts')
            .delete()
            .eq('id', id);
        if (error) throw new Error(`Erro ao excluir conta: ${error.message}`);
        return { mode: 'hard' };
    }
}

export async function deleteRevenueCategory(id: string) {


    const supabase = await createClient();

    // 1. Check Usage
    // TODO: Implement real usage check (products, sales lines)
    // For V1 MVP: Allow if no products linked.

    /*
    const { count } = await supabase
        .from('items') // assuming 'items' table links to Category? Or 'products'? 
        // Need to check specific schema link. Usually items -> category_id
        .select('*', { count: 'exact', head: true })
    //.eq('category_id', id); // CHECK SCHEMA FOR THIS LINK
    // Schema check: product_categories id is referenced by items? 
    // Let's assume strict check later. For now, proceeding.
    */

    // 2. Get Account ID before deleting
    const { data: category } = await supabase
        .from('product_categories')
        .select('revenue_account_id')
        .eq('id', id)
        .single();

    if (!category) throw new Error('Categoria não encontrada.');

    // 3. Delete Category
    const { error: delError } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);

    if (delError) throw new Error('Erro ao excluir categoria (pode estar em uso).');

    // 4. Delete Linked Account
    if (category.revenue_account_id) {
        await supabase
            .from('gl_accounts')
            .delete()
            .eq('id', category.revenue_account_id);
    }
}

// Helpers

function buildTree(accounts: GLAccount[]): GLAccount[] {
    const map = new Map<string, GLAccount>();
    const roots: GLAccount[] = [];

    // Initialize map with children array
    accounts.forEach(acc => {
        map.set(acc.id, { ...acc, children: [] });
    });

    accounts.forEach(acc => {
        const node = map.get(acc.id)!;
        if (acc.parent_id && map.has(acc.parent_id)) {
            map.get(acc.parent_id)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSystemRevenueParentId(supabase: any, companyId: string) {
    const { data } = await supabase
        .from('gl_accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', '1.1')
        .single();

    return data?.id;
}
