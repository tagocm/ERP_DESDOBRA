'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, Loader2, Plus, X } from 'lucide-react';
import { ChartTree } from './ChartTree';
import { AccountDetails } from './AccountDetails';
import { ManageCategoriesModal } from './ManageCategoriesModal';
import { GLAccount } from '@/lib/data/finance/chart-of-accounts';
import { useToast } from '@/components/ui/use-toast';

export function ChartOfAccountsTab() {
    const [treeData, setTreeData] = useState<GLAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<GLAccount | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Inline add state
    const [addingToParent, setAddingToParent] = useState<GLAccount | null>(null);
    const [newAccountName, setNewAccountName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { toast } = useToast();

    const fetchTree = async () => {
        setLoading(true);
        try {
            const { getAccountsTreeAction } = await import('@/app/actions/finance-actions');
            const result = await getAccountsTreeAction();
            if (result.success && result.data) {
                setTreeData(result.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTree();
    }, []);

    // Keep selected account in sync after tree refresh
    useEffect(() => {
        if (selectedAccount && treeData.length > 0) {
            const findAccount = (nodes: GLAccount[]): GLAccount | null => {
                for (const node of nodes) {
                    if (node.id === selectedAccount.id) return node;
                    if (node.children) {
                        const found = findAccount(node.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            const updated = findAccount(treeData);
            if (updated) setSelectedAccount(updated);
        }
    }, [treeData]);

    const handleSelect = (account: GLAccount) => {
        setSelectedAccount(account);
    };

    const handleAddToParent = (parent: GLAccount) => {
        setAddingToParent(parent);
        setNewAccountName('');
    };

    const handleCancelAdd = () => {
        setAddingToParent(null);
        setNewAccountName('');
    };

    const handleSaveAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addingToParent || newAccountName.trim().length < 3) return;

        setIsSaving(true);
        try {
            const { createManualAccountAction } = await import('@/app/actions/finance-actions');
            const result = await createManualAccountAction(addingToParent.id, newAccountName.trim());
            if (result.success) {
                toast({ title: 'Conta criada', description: `A conta foi adicionada em "${addingToParent.name}".` });
                setAddingToParent(null);
                setNewAccountName('');
                await fetchTree();
            } else {
                toast({ variant: 'destructive', title: 'Erro', description: result.message });
            }
        } catch {
            toast({ variant: 'destructive', title: 'Erro', description: 'Erro inesperado ao criar conta.' });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredTree = treeData; // TODO: recursive filter on searchTerm

    return (
        <div className="grid grid-cols-12 gap-6 h-full min-h-0">
            {/* Left Column: Tree */}
            <Card className="col-span-5 border-gray-200 shadow-card flex flex-col min-h-0 bg-white">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 bg-gray-50/30 space-y-3 shrink-0">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Estrutura do Plano de Contas</h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar conta..."
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-200" />
                        </div>
                    ) : (
                        <ChartTree
                            data={filteredTree}
                            selectedId={selectedAccount?.id || null}
                            onSelect={handleSelect}
                            onAdd={handleAddToParent}
                        />
                    )}
                </div>

                {/* Inline Add Form — pinned to bottom of card */}
                {addingToParent && (
                    <div className="border-t border-blue-100 bg-blue-50/50 p-3 shrink-0">
                        <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            Nova conta em <span className="font-mono">{addingToParent.code}</span> — {addingToParent.name}
                        </p>
                        <form onSubmit={handleSaveAccount} className="flex gap-2">
                            <Input
                                autoFocus
                                placeholder="Nome da conta..."
                                value={newAccountName}
                                onChange={(e) => setNewAccountName(e.target.value)}
                                className="h-8 text-sm bg-white flex-1"
                                disabled={isSaving}
                            />
                            <Button
                                type="submit"
                                size="sm"
                                className="h-8"
                                disabled={isSaving || newAccountName.trim().length < 3}
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                onClick={handleCancelAdd}
                                disabled={isSaving}
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </form>
                    </div>
                )}
            </Card>

            {/* Right Column: Details */}
            <div className="col-span-7 h-full min-h-0 overflow-hidden">
                <AccountDetails
                    account={selectedAccount}
                    onManageCategories={() => setIsManageModalOpen(true)}
                    onChanged={async () => {
                        setSelectedAccount(null);
                        await fetchTree();
                    }}
                />
            </div>

            <ManageCategoriesModal
                isOpen={isManageModalOpen}
                onClose={() => setIsManageModalOpen(false)}
                onChanged={fetchTree}
            />
        </div>
    );
}
