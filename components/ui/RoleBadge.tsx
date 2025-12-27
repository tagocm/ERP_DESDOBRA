import { OrganizationRole, getRoleLabel, getRoleColor } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface RoleBadgeProps {
    role: OrganizationRole;
    size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
    const colors = getRoleColor(role);
    const label = getRoleLabel(role);

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border font-medium',
                colors.bg,
                colors.text,
                colors.border,
                size === 'sm' && 'px-2 py-0.5 text-xs',
                size === 'md' && 'px-3 py-1 text-sm'
            )}
        >
            {label}
        </span>
    );
}
