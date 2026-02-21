'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Lock, Link as LinkIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GLAccount } from '@/lib/data/finance/chart-of-accounts';

interface ChartTreeProps {
    data: GLAccount[];
    selectedId: string | null;
    onSelect: (account: GLAccount) => void;
    onAdd?: (parent: GLAccount) => void;
}

export function ChartTree({ data, selectedId, onSelect, onAdd }: ChartTreeProps) {
    if (!data || data.length === 0) {
        return <div className="p-4 text-center text-gray-400 text-sm">Nenhuma conta encontrada.</div>;
    }

    return (
        <div className="space-y-1">
            {data.map(node => (
                <TreeNode
                    key={node.id}
                    node={node}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onAdd={onAdd}
                    depth={0}
                />
            ))}
        </div>
    );
}

interface TreeNodeProps {
    node: GLAccount;
    selectedId: string | null;
    onSelect: (account: GLAccount) => void;
    onAdd?: (parent: GLAccount) => void;
    depth: number;
}

function TreeNode({ node, selectedId, onSelect, onAdd, depth }: TreeNodeProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.id === selectedId;
    // Only sub-folders (SINTETICA at depth >= 1) get the + button.
    // Business rule: 1.1 children are created via category modal, not manually here.
    const canAddChild = node.type === 'SINTETICA' && depth >= 1 && node.code !== '1.1';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleClick = () => {
        onSelect(node);
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAdd?.(node);
    };

    return (
        <div>
            <div
                className={cn(
                    'flex items-center py-2 px-3 rounded-full cursor-pointer transition-colors text-sm group',
                    isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700',
                    !node.is_active && 'opacity-60'
                )}
                style={{ paddingLeft: `${depth * 1.5 + 0.75}rem` }}
                onClick={handleClick}
            >
                <div className="mr-1 w-4 flex justify-center shrink-0">
                    {hasChildren && (
                        <button
                            onClick={handleToggle}
                            className="p-0.5 hover:bg-black/5 rounded text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>

                <div className="mr-2 text-gray-400 shrink-0">
                    {node.type === 'SINTETICA' ? (
                        <Folder className={cn('w-4 h-4', isSelected ? 'text-blue-500' : 'text-amber-400')} />
                    ) : (
                        <FileText className={cn('w-4 h-4', isSelected ? 'text-blue-500' : 'text-gray-400')} />
                    )}
                </div>

                <div className="flex-1 truncate flex items-center gap-2">
                    <span className="font-mono text-xs opacity-70 font-semibold w-12">{node.code}</span>
                    <span className="truncate font-medium">{node.name}</span>
                    {node.origin === 'PRODUCT_CATEGORY' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                            Categoria
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* + button: visible on hover for sub-folders only */}
                    {canAddChild && onAdd && (
                        <button
                            onClick={handleAdd}
                            title="Adicionar conta aqui"
                            className={cn(
                                'p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100',
                                isSelected
                                    ? 'text-blue-400 hover:text-blue-600 hover:bg-blue-100'
                                    : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                            )}
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {node.origin === 'PRODUCT_CATEGORY' && (
                        <div title="Vinculada à Categoria" className="bg-purple-100 text-purple-600 p-1 rounded">
                            <LinkIcon className="w-3 h-3" />
                        </div>
                    )}
                    {node.is_system_locked && (
                        <Lock className="w-3 h-3 text-gray-300" />
                    )}
                </div>
            </div>

            {hasChildren && isExpanded && (
                <div className="border-l border-gray-100/50">
                    {node.children!.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onAdd={onAdd}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
