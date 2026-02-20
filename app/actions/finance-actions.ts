'use server';

import {
    createRevenueCategory,
    updateRevenueCategory,
    toggleRevenueCategoryStatus,
    deleteRevenueCategory,
    getRevenueCategories,
    getAccountsTree,
    createManualAccount,
    updateManualAccount,
    deleteManualAccount
} from '@/lib/data/finance/chart-of-accounts';
import { revalidatePath } from 'next/cache';

export async function createRevenueCategoryAction(name: string) {
    try {
        await createRevenueCategory({ name });
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateRevenueCategoryAction(id: string, name: string) {
    try {
        await updateRevenueCategory(id, name);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function toggleRevenueCategoryStatusAction(id: string, isActive: boolean) {
    try {
        await toggleRevenueCategoryStatus(id, isActive);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteRevenueCategoryAction(id: string) {
    try {
        await deleteRevenueCategory(id);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function fetchRevenueCategoriesAction() {
    try {
        const categories = await getRevenueCategories();
        return { success: true, data: categories };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function getAccountsTreeAction() {
    try {
        const tree = await getAccountsTree();
        return { success: true, data: tree };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function createManualAccountAction(parentId: string, name: string) {
    try {
        const account = await createManualAccount(parentId, name);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true, data: account };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function updateManualAccountAction(id: string, name: string) {
    try {
        await updateManualAccount(id, name);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteManualAccountAction(id: string) {
    try {
        const result = await deleteManualAccount(id);
        revalidatePath('/app/configuracoes/preferencias');
        return { success: true, mode: result.mode };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
