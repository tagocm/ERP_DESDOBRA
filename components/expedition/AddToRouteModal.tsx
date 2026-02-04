"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DeliveryRoute } from "@/types/sales";
import { Package, DollarSign, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AddToRouteModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: string; // yyyy-MM-dd format
    availableRoutes: DeliveryRoute[];
    onSelectRoute: (routeId: string) => void;
    onCreateRoute: (routeName: string) => void;
}

export function AddToRouteModal({
    open,
    onOpenChange,
    date,
    availableRoutes,
    onSelectRoute,
    onCreateRoute,
}: AddToRouteModalProps) {
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newRouteName, setNewRouteName] = useState("");

    // Convert string date to Date object for display
    const dateObj = new Date(date + 'T12:00:00'); // Add time to avoid timezone issues

    const handleSelectRoute = (routeId: string) => {
        onSelectRoute(routeId);
        onOpenChange(false);
    };

    const handleCreateRoute = () => {
        if (!newRouteName.trim()) return;
        onCreateRoute(newRouteName.trim());
        setNewRouteName("");
        setIsCreatingNew(false);
        onOpenChange(false);
    };

    const handleCancel = () => {
        setIsCreatingNew(false);
        setNewRouteName("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adicionar à rota</DialogTitle>
                    <DialogDescription>
                        Escolha uma rota existente ou crie uma nova para{" "}
                        <strong>{format(dateObj, "dd 'de' MMMM", { locale: ptBR })}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!isCreatingNew ? (
                        <>
                            {/* Existing Routes */}
                            {availableRoutes.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-700">Rotas existentes</h4>
                                    <div className="space-y-2 max-h-72 overflow-y-auto">
                                        {availableRoutes.map(route => {
                                            const orderCount = route.orders?.length || 0;
                                            const totalValue = route.orders?.reduce((sum, ro) => sum + (ro.sales_order?.total_amount || 0), 0) || 0;

                                            return (
                                                <button
                                                    key={route.id}
                                                    onClick={() => handleSelectRoute(route.id)}
                                                    className="w-full p-3 border border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                                                >
                                                    <div className="font-medium text-gray-900 mb-1">{route.name}</div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <Package className="w-3 h-3" />
                                                            <span>{orderCount} {orderCount === 1 ? 'pedido' : 'pedidos'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <DollarSign className="w-3 h-3" />
                                                            <span>
                                                                {new Intl.NumberFormat('pt-BR', {
                                                                    style: 'currency',
                                                                    currency: 'BRL',
                                                                }).format(totalValue)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Create New Route Button */}
                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    className="w-full border-dashed border-2 gap-2"
                                    onClick={() => setIsCreatingNew(true)}
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar nova rota
                                </Button>
                            </div>
                        </>
                    ) : (
                        /* Create New Route Form */
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Nome da nova rota
                                </label>
                                <Input
                                    placeholder="Ex: Zona Sul, Entrega Rápida..."
                                    value={newRouteName}
                                    onChange={(e) => setNewRouteName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoute()}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsCreatingNew(false);
                                        setNewRouteName("");
                                    }}
                                >
                                    Voltar
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleCreateRoute}
                                    disabled={!newRouteName.trim()}
                                >
                                    Criar e Adicionar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {!isCreatingNew && (
                    <DialogFooter>
                        <Button variant="ghost" onClick={handleCancel}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
