
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface PackagingListProps {
    packagings: Partial<ItemPackaging>[];
    baseUom: string;
    onEdit: (index: number) => void;
    onDelete: (index: number) => void;
}

export function PackagingList({ packagings, baseUom, onEdit, onDelete }: PackagingListProps) {
    if (packagings.length === 0) {
        return (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3 opacitiy-50" />
                <p className="text-sm font-semibold text-gray-500">Nenhuma embalagem cadastrada</p>
                <p className="text-xs text-gray-400 mt-1">Adicione caixas ou fardos para organizar sua logística.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white shadow-sm">
            <Table>
                <TableHeader className="bg-gray-50/50">
                    <TableRow className="hover:bg-transparent border-gray-100">
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider">Embalagem</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Conteúdo</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider">GTIN/EAN</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 tracking-wider">PESOS (g)</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Padrão</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</TableHead>
                        <TableHead className="px-6 h-11 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {packagings.filter((p: any) => !p.deleted_at).map((pkg) => {
                        const originalIndex = packagings.findIndex(p => p === pkg);
                        return (
                            <TableRow key={originalIndex} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <TableCell className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-9 w-9 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 shadow-sm border border-brand-100/50">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-bold text-gray-900 leading-tight">{pkg.label}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{pkg.type}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                                        {pkg.qty_in_base} <span className="mx-1 opacity-40">×</span> {baseUom}
                                    </span>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-sm font-medium text-gray-500 tabular-nums">
                                    {pkg.gtin_ean || <span className="opacity-20">—</span>}
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">Líq: <span className="text-gray-600 font-bold ml-1">{pkg.net_weight_g ?? '-'}</span></span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase leading-none">Brut: <span className="text-gray-900 font-bold ml-1">{pkg.gross_weight_g ?? '-'}</span></span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    {pkg.is_default_sales_unit ? (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                            Principal
                                        </div>
                                    ) : null}
                                </TableCell>
                                <TableCell className="px-6 py-4 text-center">
                                    {pkg.is_active !== false ? (
                                        <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 rounded-full">
                                            Ativo
                                        </span>
                                    ) : (
                                        <span className="inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 rounded-full">
                                            Inativo
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="px-6 py-4 text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onEdit(originalIndex)}
                                            className="h-8 w-8 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-gray-400 transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onDelete(originalIndex)}
                                            className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </tbody >
            </Table >
        </div >
    );
}
