'use server';

// Usa getActiveCompanyId (company_members) para suportar membros que não são owners
export { getActiveCompanyId as getCompanyId } from '@/lib/auth/get-active-company';
