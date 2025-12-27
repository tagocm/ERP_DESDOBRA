
import { ItemPackaging } from "@/types/product";
import { Button } from "@/components/ui/Button";
import { Edit2, Trash2, Package, Check, Star } from "lucide-react";

interface PackagingListProps {
    packagings: Partial<ItemPackaging>[];
    baseUom: string;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
}

export function PackagingList({ packagings, baseUom, onEdit, onDelete }: PackagingListProps) {
    if (packagings.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhuma embalagem cadastrada.</p>
                <p className="text-xs text-gray-400">Adicione caixas, fardos ou outras apresentações de venda.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Embalagem</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conteúdo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GTIN/EAN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">PESO (g)</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Padrão</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {packagings.filter((p: any) => !p.deleted_at).map((pkg) => {
                        // Find original index in the full packagings array
                        const originalIndex = packagings.findIndex(p => p === pkg);
                        return (
                            <tr key={originalIndex} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 bg-brand-50 rounded flex items-center justify-center text-brand-600">
                                            <Package className="w-4 h-4" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{pkg.label}</div>
                                            <div className="text-xs text-gray-500">{pkg.type}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {pkg.qty_in_base} x {baseUom}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {pkg.gtin_ean || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex flex-col text-xs">
                                        <span title="Peso Líquido">L: {pkg.net_weight_g ?? '-'}</span>
                                        <span title="Peso Bruto">B: {pkg.gross_weight_g ?? '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {pkg.is_default_sales_unit ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                            <Star className="w-3 h-3 mr-1 fill-yellow-500 text-yellow-500" />
                                            Padrão
                                        </span>
                                    ) : null}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {pkg.is_active !== false ? (
                                        <span className="inline-flex px-2 text-xs font-semibold leading-5 text-green-800 bg-green-100 rounded-full">
                                            Ativo
                                        </span>
                                    ) : (
                                        <span className="inline-flex px-2 text-xs font-semibold leading-5 text-gray-800 bg-gray-100 rounded-full">
                                            Inativo
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => onEdit(originalIndex)}
                                        className="text-brand-600 hover:text-brand-900 mr-4"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(originalIndex)}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
