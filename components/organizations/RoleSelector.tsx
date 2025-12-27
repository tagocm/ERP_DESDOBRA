"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabaseBrowser';
import { useCompany } from '@/contexts/CompanyContext';
import { OrganizationRole, ALL_ROLES, getRoleLabel } from '@/lib/roles';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';

interface RoleSelectorProps {
    organizationId: string;
    onRolesChange?: (roles: OrganizationRole[]) => void;
}

export function RoleSelector({ organizationId, onRolesChange }: RoleSelectorProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const [currentRoles, setCurrentRoles] = useState<OrganizationRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchRoles();
    }, [organizationId, selectedCompany]);

    async function fetchRoles() {
        if (!selectedCompany || !organizationId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('organization_roles')
                .select('role')
                .eq('company_id', selectedCompany.id)
                .eq('organization_id', organizationId)
                .is('deleted_at', null);

            if (error) throw error;

            const roles = (data || []).map((r) => r.role as OrganizationRole);
            setCurrentRoles(roles);
            onRolesChange?.(roles);
        } catch (error) {
            console.error('Error fetching roles:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function addRole(role: OrganizationRole) {
        if (!selectedCompany || currentRoles.includes(role)) return;

        setIsSaving(true);
        try {
            const { error } = await supabase.from('organization_roles').insert({
                company_id: selectedCompany.id,
                organization_id: organizationId,
                role,
            });

            if (error) throw error;

            const newRoles = [...currentRoles, role];
            setCurrentRoles(newRoles);
            onRolesChange?.(newRoles);
        } catch (error) {
            console.error('Error adding role:', error);
        } finally {
            setIsSaving(false);
        }
    }

    async function removeRole(role: OrganizationRole) {
        if (!selectedCompany) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('organization_roles')
                .update({ deleted_at: new Date().toISOString() })
                .eq('company_id', selectedCompany.id)
                .eq('organization_id', organizationId)
                .eq('role', role);

            if (error) throw error;

            const newRoles = currentRoles.filter((r) => r !== role);
            setCurrentRoles(newRoles);
            onRolesChange?.(newRoles);
        } catch (error) {
            console.error('Error removing role:', error);
        } finally {
            setIsSaving(false);
        }
    }

    const availableRoles = ALL_ROLES.filter((r) => !currentRoles.includes(r));

    if (isLoading) {
        return <div className="text-sm text-gray-500">Carregando roles...</div>;
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {currentRoles.length === 0 && (
                    <span className="text-sm text-gray-500">Nenhum role atribuído</span>
                )}
                {currentRoles.map((role) => (
                    <div key={role} className="flex items-center gap-1">
                        <RoleBadge role={role} />
                        <button
                            onClick={() => removeRole(role)}
                            disabled={isSaving}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            title="Remover role"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>

            {availableRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {availableRoles.map((role) => (
                        <Button
                            key={role}
                            variant="secondary"
                            size="sm"
                            onClick={() => addRole(role)}
                            disabled={isSaving}
                        >
                            + {getRoleLabel(role)}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}
