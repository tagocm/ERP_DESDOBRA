'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Package } from 'lucide-react';

interface ProductSeparationListProps {
    routeId: string;
}

interface ProductItem {
    product_id: string;
    product_name: string;
    sku: string;
    unit: string;
    total_quantity: number;
}

export function ProductSeparationList({ routeId }: ProductSeparationListProps) {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadProducts();
    }, [routeId]);

    const loadProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const supabase = createClient();
            const { data, error } = await supabase.rpc('get_route_product_aggregation', {
                p_route_id: routeId
            });

            if (error) {
                console.error('RPC Error:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }
            setProducts(data || []);
        } catch (err: any) {
            console.error('Error loading products:', err);
            console.error('Error details:', {
                message: err?.message,
                name: err?.name,
                stack: err?.stack
            });
            setError(err?.message || 'Erro ao carregar produtos da rota');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando produtos...</div>;
    }

    if (error) {
        return (
            <div className="p-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-red-300" />
                <p className="text-red-600 font-medium mb-2">Erro ao carregar produtos</p>
                <p className="text-sm text-gray-500">{error}</p>
            </div>
        );
    }

    if (!products || products.length === 0) {
        return (
            <div className="p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum produto encontrado nesta rota</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Produto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">SKU</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Quantidade</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Unidade</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {products.map((product) => (
                        <tr key={`${product.product_id}-${product.unit || 'UN'}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{product.product_name}</td>
                            <td className="px-4 py-3 text-gray-600">{product.sku || '-'}</td>
                            <td className="px-4 py-3 text-center font-bold text-gray-900">{product.total_quantity}</td>
                            <td className="px-4 py-3 text-center text-gray-600">{product.unit || 'UN'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
