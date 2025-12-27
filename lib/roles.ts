// Role management utilities

export type OrganizationRole = 'prospect' | 'customer' | 'supplier' | 'carrier' | 'employee';

export const ROLE_LABELS: Record<OrganizationRole, string> = {
    prospect: 'Prospect',
    customer: 'Cliente',
    supplier: 'Fornecedor',
    carrier: 'Transportadora',
    employee: 'Funcionário',
};

export const ROLE_COLORS: Record<OrganizationRole, { bg: string; text: string; border: string }> = {
    prospect: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
    },
    customer: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
    },
    supplier: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
    },
    carrier: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
    },
    employee: {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
    },
};

export function getRoleLabel(role: OrganizationRole): string {
    return ROLE_LABELS[role] || role;
}

export function getRoleColor(role: OrganizationRole) {
    return ROLE_COLORS[role] || ROLE_COLORS.customer;
}

export const ALL_ROLES: OrganizationRole[] = [
    'prospect',
    'customer',
    'supplier',
    'carrier',
    'employee',
];
