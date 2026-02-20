'use client';

import { GLAccount } from '@/lib/data/finance/chart-of-accounts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Link as LinkIcon, Power, AlertTriangle, CheckCircle, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { toggleRevenueCategoryStatusAction } from '@/app/actions/finance-actions';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface AccountDetailsProps {
    account: GLAccount | null;
    onManageCategories: () => void;
    onChanged?: () => void; // Refresh tree after edit/delete
}

export function AccountDetails({ account, onManageCategories, onChanged }: AccountDetailsProps) {
    const [isToggling, setIsToggling] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const isManual = account?.origin === 'MANUAL';

    if (!account) {
        return (
            <Card className="h-full border-gray-200 shadow-card bg-gray-50/50 flex items-center justify-center">
                <div className="text-center p-6">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-gray-900 font-medium">Nenhuma conta selecionada</h3>
                    <p className="text-gray-500 text-sm mt-1">Selecione uma conta na árvore para ver detalhes.</p>
                </div>
            </Card>
        );
    }

    const handleToggleStatus = async () => {
        if (!account.origin_id) return;
        setIsToggling(true);
        try {
            const result = await toggleRevenueCategoryStatusAction(account.origin_id, !account.is_active);
            if (result.success) {
                toast({ title: 'Sucesso', description: `Conta ${!account.is_active ? 'ativada' : 'inativada'} com sucesso.` });
                onChanged?.();
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: result.message });
            }
        } catch {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao alterar status.' });
        } finally {
            setIsToggling(false);
        }
    };

    const handleStartEdit = () => {
        setEditName(account.name);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditName('');
    };

    const handleSaveEdit = async () => {
        if (editName.trim().length < 3) return;
        setIsSaving(true);
        try {
            const { updateManualAccountAction } = await import('@/app/actions/finance-actions');
            const result = await updateManualAccountAction(account.id, editName.trim());
            if (result.success) {
                toast({ title: 'Sucesso', description: 'Conta renomeada com sucesso.' });
                setIsEditing(false);
                onChanged?.();
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: result.message });
            }
        } catch {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro inesperado.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Excluir a conta "${account.name}"?\n\nSe houver lançamentos vinculados, a conta será apenas inativada.`)) return;
        setIsDeleting(true);
        try {
            const { deleteManualAccountAction } = await import('@/app/actions/finance-actions');
            const result = await deleteManualAccountAction(account.id);
            if (result.success) {
                const msg = result.mode === 'soft'
                    ? 'Conta inativada (possui lançamentos vinculados).'
                    : 'Conta excluída definitivamente.';
                toast({ title: 'Concluído', description: msg });
                onChanged?.();
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: result.message });
            }
        } catch {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro inesperado.' });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="h-full border-gray-200 shadow-card flex flex-col">
            <CardHeader className="border-b border-gray-100 bg-gray-50/30 pb-4 shrink-0">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-xs bg-white text-gray-700 border-gray-200 shrink-0">
                                {account.code}
                            </Badge>
                            {!account.is_active && (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-500 shrink-0">Inativo</Badge>
                            )}
                        </div>

                        {/* Title or edit input */}
                        {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    autoFocus
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="h-8 text-sm font-semibold"
                                    disabled={isSaving}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEdit();
                                        if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                />
                                <Button size="sm" variant="ghost" onClick={handleSaveEdit}
                                    disabled={isSaving || editName.trim().length < 3}
                                    className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 shrink-0">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}
                                    disabled={isSaving}
                                    className="h-8 w-8 p-0 text-gray-400 shrink-0">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <CardTitle className="text-xl text-gray-900 truncate">{account.name}</CardTitle>
                        )}
                    </div>

                    {/* Action buttons (right side) */}
                    {!isEditing && (
                        <div className="flex gap-1.5 shrink-0">
                            {/* Manual accounts: edit + delete */}
                            {isManual && (
                                <>
                                    <Button variant="ghost" size="sm"
                                        onClick={handleStartEdit}
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                                        title="Renomear conta">
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                        title="Excluir conta">
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </Button>
                                </>
                            )}
                            {/* Product category accounts: toggle active */}
                            {account.origin === 'PRODUCT_CATEGORY' && (
                                <Button
                                    variant="outline" size="sm"
                                    onClick={handleToggleStatus}
                                    disabled={isToggling}
                                    className={cn('h-8', account.is_active
                                        ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                        : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50')}>
                                    <Power className="w-4 h-4 mr-2" />
                                    {account.is_active ? 'Inativar' : 'Ativar'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Meta Info Grid */}
                <div className="grid grid-cols-2 gap-6">
                    <DetailItem label="Natureza" value={account.nature} />
                    <DetailItem label="Tipo" value={account.type} />
                    <DetailItem label="Origem" value={
                        account.origin === 'SYSTEM' ? 'Sistema (Fixo)' :
                            account.origin === 'PRODUCT_CATEGORY' ? 'Categoria de Produto' :
                                'Manual'
                    } />
                    <DetailItem label="Status" value={
                        <div className="flex items-center gap-2">
                            {account.is_active ? (
                                <><CheckCircle className="w-4 h-4 text-emerald-500" /> <span className="text-emerald-700 font-medium">Ativo</span></>
                            ) : (
                                <><AlertTriangle className="w-4 h-4 text-gray-400" /> <span className="text-gray-500">Inativo</span></>
                            )}
                        </div>
                    } />
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Informações e Regras</h4>

                    {account.is_system_locked && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-800 text-sm">
                            <Lock className="w-5 h-5 shrink-0 text-amber-600" />
                            <div>
                                <p className="font-medium text-amber-900">Conta do Sistema</p>
                                <p className="mt-1 opacity-90">
                                    Esta conta faz parte da estrutura base do ERP e não pode ser excluída ou movida.
                                    Seus lançamentos afetam diretamente o DRE Gerencial.
                                </p>
                            </div>
                        </div>
                    )}

                    {account.origin === 'PRODUCT_CATEGORY' && (
                        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3 text-purple-800 text-sm">
                            <LinkIcon className="w-5 h-5 shrink-0 text-purple-600" />
                            <div>
                                <p className="font-medium text-purple-900">Vinculada à Categoria de Produto</p>
                                <p className="mt-1 opacity-90">
                                    Esta conta foi criada automaticamente a partir de uma Categoria de Receita.
                                    Para renomear, você deve editar a categoria correspondente.
                                </p>
                                <Button
                                    variant="ghost"
                                    className="p-0 h-auto text-purple-700 hover:text-purple-900 mt-2 font-medium hover:bg-transparent underline"
                                    onClick={onManageCategories}>
                                    Gerenciar Categorias &rarr;
                                </Button>
                            </div>
                        </div>
                    )}

                    {isManual && (
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-600">
                            <p className="font-medium text-gray-700 mb-1">Conta Manual</p>
                            <p>Criada manualmente. Pode ser renomeada ou excluída pelo botão no topo do painel.</p>
                            {!account.is_active && (
                                <p className="mt-2 text-amber-700 font-medium">⚠ Inativa: possui lançamentos vinculados e não pode ser removida.</p>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function DetailItem({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">{label}</span>
            <div className="text-sm text-gray-900 font-medium">{value}</div>
        </div>
    );
}
