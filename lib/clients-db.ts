
import { SupabaseClient } from "@supabase/supabase-js";

// --- TYPES ---

export interface Organization {
    id: string;
    company_id: string;
    legal_name: string | null;
    trade_name: string;
    document_number: string | null;
    document_type: 'cpf' | 'cnpj' | 'other' | null;
    state_registration: string | null;
    municipal_registration: string | null;
    ie_indicator: 'contributor' | 'exempt' | 'non_contributor';
    suframa: string | null;
    email_nfe: string | null;
    email: string | null;
    phone: string | null;
    country_code: string;
    status: 'active' | 'inactive';
    default_payment_terms_days: number | null;
    notes: string | null;
    is_simple_national: boolean;
    is_public_agency: boolean;
    freight_terms: 'cif' | 'fob' | 'retira' | 'combinar' | 'sem_frete' | null;
    price_table_id: string | null;
    sales_rep_user_id: string | null;
    notes_commercial: string | null;

    // New Commercial Fields
    credit_limit: number | null;
    default_discount: number | null;
    sales_channel: string | null;
    payment_terms_id: string | null; // Sales Payment Terms
    purchase_payment_terms_id: string | null; // Purchase Payment Terms
    delivery_terms: string | null;
    lead_time_days: number | null;
    minimum_order_value: number | null;
    preferred_carrier_id: string | null;
    region_route: string | null;
    payment_mode_id: string | null; // New field for Payment Mode (Boleto, Pix, etc)

    // New Fiscal Fields
    tax_regime: string | null;
    is_ie_exempt: boolean;
    is_final_consumer: boolean;
    public_agency_sphere: string | null;
    public_agency_code: string | null;
    default_operation_nature: string | null;
    default_cfop: string | null;
    notes_fiscal: string | null;

    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export interface OrganizationBranch {
    id: string;
    company_id: string;
    organization_id: string;
    name: string;
    code: string | null;
    is_active: boolean;
    default_payment_terms_days: number | null;
    notes: string | null;
}

export interface Person {
    id: string;
    company_id: string;
    organization_id: string;
    branch_id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    role_title: string | null;
    is_primary: boolean;
    departments: string[] | null;
    notes: string | null;
}

export interface Address {
    id: string;
    company_id: string;
    organization_id: string;
    branch_id: string | null;
    type: 'shipping' | 'billing' | 'other';
    label: string | null;
    zip: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    country: string;
    city_code_ibge: string | null;
    is_default: boolean;
}



export interface PriceTable {
    id: string;
    company_id: string;
    name: string;
    is_active: boolean;
}

export interface PaymentTerm {
    id: string;
    company_id: string;
    name: string;
    day_count?: number; // Optional if we want to store days, but name is main identifier
    is_active: boolean;
}

export interface OrganizationTag {
    id: string;
    company_id: string;
    name: string;
}

export interface OrganizationRole {
    company_id: string;
    organization_id: string;
    role: 'prospect' | 'customer' | 'supplier' | 'carrier' | 'employee';
    created_at: string;
    deleted_at: string | null;
}

// --- QUERIES ---

// 1. ORGANIZATIONS

export async function getOrganizations(
    supabase: SupabaseClient,
    companyId: string,
    search?: string
) {
    let query = supabase
        .from("organizations")
        .select("*, addresses(city, state)")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("trade_name", { ascending: true });

    if (search) {
        query = query.or(`trade_name.ilike.%${search}%,legal_name.ilike.%${search}%,document_number.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getOrganizationById(
    supabase: SupabaseClient,
    companyId: string,
    id: string
) {
    const { data, error } = await supabase
        .from("organizations")
        .select(`
            *,
            addresses(*)
        `)
        .eq("company_id", companyId)
        .eq("id", id)
        .single();

    if (error) throw error;
    return data as Organization & { addresses: Address[] };
}

export async function createOrganization(
    supabase: SupabaseClient,
    org: Partial<Organization>
) {
    const { data, error } = await supabase
        .from("organizations")
        .insert(org)
        .select()
        .single();

    if (error) throw error;
    return data as Organization;
}

export async function updateOrganization(
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Organization>
) {
    const { data, error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;
    return data as Organization;
}

export async function deleteOrganization(
    supabase: SupabaseClient,
    id: string
) {
    const { error } = await supabase
        .from("organizations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

    if (error) throw error;
}

// 2. ORGANIZATION ROLES

export async function getOrganizationRoles(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("organization_roles")
        .select("*")
        .eq("company_id", companyId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

    if (error) throw error;
    return data as OrganizationRole[];
}

export async function setOrganizationRoles(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string,
    roles: string[]
) {
    // Delete existing roles
    await supabase
        .from("organization_roles")
        .delete()
        .eq("company_id", companyId)
        .eq("organization_id", organizationId);

    // Insert new roles
    if (roles.length > 0) {
        const { error } = await supabase
            .from("organization_roles")
            .insert(
                roles.map(role => ({
                    company_id: companyId,
                    organization_id: organizationId,
                    role
                }))
            );

        if (error) throw error;
    }
}

// 3. BRANCHES

export async function getBranches(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("organization_branches")
        .select("*")
        .eq("company_id", companyId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name");

    if (error) throw error;
    return data as OrganizationBranch[];
}

export async function upsertBranch(
    supabase: SupabaseClient,
    branch: Partial<OrganizationBranch>
) {
    const { data, error } = await supabase
        .from("organization_branches")
        .upsert(branch)
        .select()
        .single();

    if (error) throw error;
    return data as OrganizationBranch;
}

export async function deleteBranch(
    supabase: SupabaseClient,
    id: string
) {
    const { error } = await supabase
        .from("organization_branches")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

// 4. PEOPLE

export async function getPeople(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("people")
        .select("*, organization_branches!people_branch_id_fkey(name)")
        .eq("company_id", companyId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("full_name");

    if (error) throw error;
    return data;
}

export async function upsertPerson(
    supabase: SupabaseClient,
    person: Partial<Person>
) {
    const { data, error } = await supabase
        .from("people")
        .upsert(person)
        .select()
        .single();
    if (error) throw error;
    return data as Person;
}

export async function deletePerson(
    supabase: SupabaseClient,
    id: string
) {
    const { error } = await supabase
        .from("people")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

// 5. ADDRESSES

export async function getAddresses(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("addresses")
        .select("*, organization_branches!addresses_branch_id_fkey(name)")
        .eq("company_id", companyId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("is_default", { ascending: false });

    if (error) throw error;
    return data;
}

export async function upsertAddress(
    supabase: SupabaseClient,
    address: Partial<Address>
) {
    const { data, error } = await supabase
        .from("addresses")
        .upsert(address)
        .select()
        .single();
    if (error) throw error;
    return data as Address;
}

export async function deleteAddress(
    supabase: SupabaseClient,
    id: string
) {
    const { error } = await supabase
        .from("addresses")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw error;
}

// 6. TAGS

export async function getOrganizationTags(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("organization_tag_links")
        .select("tag_id, organization_tags(name, id)")
        .eq("company_id", companyId)
        .eq("organization_id", organizationId);

    if (error) throw error;
    return data?.map(item => item.organization_tags) || [];
}

export async function getAllTags(
    supabase: SupabaseClient,
    companyId: string
) {
    const { data, error } = await supabase
        .from("organization_tags")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name");

    if (error) throw error;
    return data as OrganizationTag[];
}

export async function createTag(
    supabase: SupabaseClient,
    companyId: string,
    name: string
) {
    const { data, error } = await supabase
        .from("organization_tags")
        .insert({ company_id: companyId, name })
        .select()
        .single();
    if (error) throw error;
    return data as OrganizationTag;
}

export async function linkTag(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string,
    tagId: string
) {
    const { error } = await supabase
        .from("organization_tag_links")
        .insert({ company_id: companyId, organization_id: organizationId, tag_id: tagId });
    if (error) throw error;
}

export async function unlinkTag(
    supabase: SupabaseClient,
    companyId: string,
    organizationId: string,
    tagId: string
) {
    const { error } = await supabase
        .from("organization_tag_links")
        .delete()
        .eq("company_id", companyId)
        .eq("organization_id", organizationId)
        .eq("tag_id", tagId);
    if (error) throw error;
}

// 7. COMMERCIAL SETTINGS (Price Tables, Payment Terms)

export async function getPriceTables(
    supabase: SupabaseClient,
    companyId: string
) {
    const { data, error } = await supabase
        .from("price_tables")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

    if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01') {
            console.warn("Table 'price_tables' not found. Returning empty list.");
            return [];
        }
        throw error;
    }
    return data as PriceTable[];
}

export async function getPaymentTerms(
    supabase: SupabaseClient,
    companyId: string
) {
    const { data, error } = await supabase
        .from("payment_terms")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");

    if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '42P01') {
            console.warn("Table 'payment_terms' not found. Returning empty list.");
            return [];
        }
        throw error;
    }
    return data as PaymentTerm[];
}

export interface PaymentMode {
    id: string;
    company_id: string;
    name: string;
    is_active: boolean;
}

export async function getPaymentModes(
    supabase: SupabaseClient,
    companyId: string
) {
    const { data, error } = await supabase
        .from("payment_modes")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

    if (error) {
        if (error.code === '42P01') {
            return [];
        }
        throw error;
    }
    return data as PaymentMode[];
}

/**
 * Get all carriers (organizations with 'carrier' role)
 * @param supabase - Supabase client
 * @param companyId - Company ID
 * @param search - Optional search term (name or document)
 * @returns List of carrier organizations
 */
export async function getCarriers(
    supabase: SupabaseClient,
    companyId: string,
    search?: string
) {
    let query = supabase
        .from("organizations")
        .select(`
            id,
            trade_name,
            legal_name,
            document_number,
            addresses!inner(city, state)
        `)
        .eq("company_id", companyId)
        .eq("status", "active")
        .is("deleted_at", null);

    // Filter by carrier role using organization_roles table
    const { data: carrierIds, error: rolesError } = await supabase
        .from("organization_roles")
        .select("organization_id")
        .eq("company_id", companyId)
        .eq("role", "carrier")
        .is("deleted_at", null);

    if (rolesError) {
        console.error("Error fetching carrier roles:", rolesError);
        return [];
    }

    if (!carrierIds || carrierIds.length === 0) {
        return [];
    }

    const carrierIdList = carrierIds.map(r => r.organization_id);
    query = query.in("id", carrierIdList);

    if (search) {
        query = query.or(`trade_name.ilike.%${search}%,legal_name.ilike.%${search}%,document_number.ilike.%${search}%`);
    }

    query = query.order("trade_name", { ascending: true });

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching carriers:", error);
        return [];
    }

    return data || [];
}
