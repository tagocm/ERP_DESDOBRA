import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Check, MapPin, FileText } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from 'next/navigation';

interface LoadingChecklistProps {
    route: any;
}

export function LoadingChecklist({ route }: LoadingChecklistProps) {
    const { toast } = useToast();
    const router = useRouter();

    // Local state for optimistic updates
    const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    // Initialize state from props
    useEffect(() => {
        if (route.orders) {
            const initial: Record<string, boolean> = {};
            route.orders.forEach((o: any) => {
                if (o.sales_order) {
                    initial[o.sales_order.id] = o.sales_order.loading_checked || false;
                }
            });
            setCheckedState(initial);
        }
    }, [route.orders]);

    const handleToggleLoading = async (orderId: string, currentState: boolean) => {
        // Optimistic update
        const newState = !currentState;
        setCheckedState(prev => ({ ...prev, [orderId]: newState }));
        setLoadingStates(prev => ({ ...prev, [orderId]: true }));

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch('/api/expedition/loading-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    checked: newState,
                    userId: session?.user?.id
                })
            });

            if (!response.ok) {
                // Revert on error
                setCheckedState(prev => ({ ...prev, [orderId]: currentState }));
                throw new Error('Erro ao atualizar checklist');
            }

            toast({
                title: newState ? "Marcado como carregado" : "Marcação removida",
                description: newState ? "Pedido conferido com sucesso." : "O pedido voltou para pendente."
            });

            // Soft refresh to sync server state in background
            router.refresh();
        } catch (err) {
            console.error(err);
            toast({ title: "Erro", description: 'Erro ao atualizar checklist', variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const orders = route.orders || [];

    if (orders.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum pedido nesta rota</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-100">
            {orders.map((routeOrder: any) => {
                const order = routeOrder.sales_order;
                if (!order) return null;

                // Use local state if available, fallback to props
                const isChecked = checkedState[order.id] ?? order.loading_checked ?? false;
                const isLoading = loadingStates[order.id];

                return (
                    <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <button
                                onClick={() => handleToggleLoading(order.id, isChecked)}
                                disabled={isLoading}
                                className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border-2 transition-all duration-200 ${isChecked
                                    ? 'bg-green-500 border-green-500 shadow-sm scale-105'
                                    : 'bg-white border-gray-300 hover:border-green-500'
                                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                {isChecked && <Check className="w-4 h-4 text-white animate-in zoom-in duration-200" />}
                            </button>

                            {/* Order Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-semibold transition-colors ${isChecked ? 'text-green-900' : 'text-gray-900'}`}>
                                        {order.client?.trade_name || 'Cliente Desconhecido'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        #{order.document_number}
                                    </span>
                                </div>

                                {order.client?.addresses?.[0]?.city && (
                                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                                        <MapPin className="w-3 h-3" />
                                        {order.client.addresses[0].city}
                                    </div>
                                )}

                                {/* Items */}
                                <div className="text-sm text-gray-600">
                                    {order.items && order.items.length > 0 ? (
                                        <ul className="space-y-1">
                                            {order.items.map((item: any) => (
                                                <li key={item.id} className="flex justify-between">
                                                    <span>{item.product?.name || 'Produto'}</span>
                                                    <span className="font-medium">{item.quantity} un</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <span className="text-gray-400">Sem itens</span>
                                    )}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex-shrink-0">
                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${isChecked
                                    ? 'bg-green-100 text-green-700 shadow-sm'
                                    : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {isChecked && <Check className="w-3 h-3" />}
                                    {isChecked ? 'Carregado' : 'Pendente'}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
