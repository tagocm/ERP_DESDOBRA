"use client";

import { useEffect, useState, Fragment } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Search, Filter, Calendar as CalendarIcon,
    ArrowUpCircle, ArrowDownCircle, AlertCircle, ChevronDown, ChevronRight,
    Package, ArrowLeftRight, LayoutGrid
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/Badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { InventoryMovementModal } from "@/components/inventory/InventoryMovementModal";
import { inventoryService } from "@/lib/inventory-service";
import { InventoryMovement } from "@/types/inventory";

export default function InventoryMovementsPage() {
    const { toast } = useToast();
    // State
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [dateRange, setDateRange] = useState<{ from: Date, to: Date } | undefined>();

    // Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE' | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [typeFilter, dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await inventoryService.getMovements({
                type: typeFilter,
                startDate: dateRange?.from,
                endDate: dateRange?.to,
                search: searchTerm
            });
            setMovements(data);
        } catch (err) {
            console.error(err);
            toast({
                title: "Erro ao carregar movimentações",
                description: "Não foi possível carregar os dados. Tente novamente.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = (id: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    const handleOpenModal = (type: 'ENTRADA' | 'SAIDA' | 'AJUSTE') => {
        setModalType(type);
        setModalOpen(true);
    };

    const getStatusBadge = (type: string) => {
        switch (type) {
            case 'ENTRADA':
                return <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">ENTRADA</Badge>;
            case 'SAIDA':
                return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">SAÍDA</Badge>;
            case 'AJUSTE':
                return <Badge className="bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50">AJUSTE</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'ENTRADA': return <ArrowUpCircle className="w-4 h-4 text-green-600" />;
            case 'SAIDA': return <ArrowDownCircle className="w-4 h-4 text-red-600" />;
            case 'AJUSTE': return <AlertCircle className="w-4 h-4 text-sky-600" />;
            default: return null;
        }
    };

    const getReferenceLabel = (type: string | null | undefined) => {
        if (!type) return '-';
        switch (type) {
            case 'AJUSTE_MANUAL': return 'Manual';
            case 'pedido': return 'Pedido';
            case 'delivery_item': return 'Entrega';
            default: return type;
        }
    };

    const getSignedQtyBase = (mov: InventoryMovement) => {
        const qtyOut = Number(mov.qty_out || 0);
        const qtyIn = Number(mov.qty_in || 0);
        if (qtyOut > 0) return -Math.abs(qtyOut);
        if (qtyIn > 0) return Math.abs(qtyIn);
        return Number(mov.qty_base || 0);
    };

    return (
        <div className="bg-gray-50/50 min-h-screen">
            {/* ... (keep PageHeader) ... */}
            <PageHeader
                title="Movimentações de Estoque"
                subtitle="Gerencie entradas, saídas e ajustes de inventário."
                actions={
                    <div className="flex gap-3">
                        <Button
                            onClick={() => handleOpenModal('ENTRADA')}
                            className="bg-green-600 hover:bg-green-700 text-white shadow-card rounded-2xl font-semibold"
                        >
                            <ArrowUpCircle className="mr-2 h-4 w-4" />
                            Nova Entrada
                        </Button>
                        <Button
                            onClick={() => handleOpenModal('SAIDA')}
                            className="bg-red-600 hover:bg-red-700 text-white shadow-card rounded-2xl font-semibold"
                        >
                            <ArrowDownCircle className="mr-2 h-4 w-4" />
                            Nova Saída
                        </Button>
                        <Button
                            onClick={() => handleOpenModal('AJUSTE')}
                            className="bg-sky-600 hover:bg-sky-700 text-white shadow-card rounded-2xl font-semibold"
                        >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Ajuste
                        </Button>
                    </div>
                }
            />

            <div className="px-6 pb-8 space-y-6">

                {/* Filters Card */}
                <Card className="border-gray-100 bg-white">
                    <div className="p-4 flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar produto, SKU..."
                                className="pl-9 h-10 bg-white border-gray-200 focus:border-brand-500 transition-colors"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && loadData()}
                            />
                        </div>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-44 h-10 bg-white border-gray-200">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                                <SelectItem value="ENTRADA">Entrada</SelectItem>
                                <SelectItem value="SAIDA">Saída</SelectItem>
                                <SelectItem value="AJUSTE">Ajuste</SelectItem>
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("h-10 justify-start text-left font-normal border-gray-200 bg-white", !dateRange && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                                                {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                                            </>
                                        ) : (
                                            format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                                        )
                                    ) : (
                                        <span>Período</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange as any}
                                    onSelect={setDateRange as any}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>

                        <div className="flex-1"></div>
                        {/* Right side filters can go here */}
                    </div>
                </Card>

                {/* Table Card */}
                <Card className="border-gray-100 overflow-hidden bg-white">
                    <Table>
                        <TableHeader className="bg-gray-50/50 border-b border-gray-100">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="w-40 font-semibold text-gray-600">Data/Hora</TableHead>
                                <TableHead className="w-32 font-semibold text-gray-600">Type</TableHead>
                                <TableHead className="font-semibold text-gray-600">Produto</TableHead>
                                <TableHead className="text-right font-semibold text-gray-600">Quantidade</TableHead>
                                <TableHead className="font-semibold text-gray-600">Origem</TableHead>
                                <TableHead className="font-semibold text-gray-600">Usuário</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-gray-400">
                                        Carregando...
                                    </TableCell>
                                </TableRow>
                            ) : movements.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                            <LayoutGrid className="w-8 h-8 text-gray-300" />
                                            <span className="text-sm">Nenhuma movimentação encontrada</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movements.map((mov) => {
                                    const signedQtyBase = getSignedQtyBase(mov);
                                    return (
                                    <Fragment key={mov.id}>
                                        <TableRow
                                            className={cn(
                                                "cursor-pointer transition-colors hover:bg-gray-50/50 border-b border-gray-50",
                                                expandedRows.has(mov.id) && "bg-blue-50/30"
                                            )}
                                            onClick={() => toggleRow(mov.id)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center justify-center">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-2xl flex items-center justify-center transition-all duration-200",
                                                        expandedRows.has(mov.id) ? "bg-blue-100 text-blue-600 rotate-90" : "text-gray-300"
                                                    )}>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-gray-700 text-sm">
                                                {format(new Date(mov.occurred_at), "dd/MM/yyyy HH:mm")}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(mov.movement_type)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 text-sm">{mov.item?.name}</span>
                                                    <span className="text-[11px] text-gray-400 font-mono uppercase tracking-wide">{mov.item?.sku}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={cn(
                                                    "font-bold font-mono text-sm",
                                                    signedQtyBase > 0 ? "text-green-600" : "text-red-600"
                                                )}>
                                                    {signedQtyBase > 0 ? "+" : ""}{signedQtyBase}
                                                </span>
                                                <span className="text-[10px] text-gray-400 ml-1 uppercase">
                                                    {mov.uom_label || "UN"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                <span className="font-medium">{getReferenceLabel(mov.reference_type)}</span>
                                                {mov.source_ref ? (
                                                    <span className="text-[10px] ml-1 text-gray-500 block font-mono bg-gray-100 px-1 rounded w-fit">{mov.source_ref}</span>
                                                ) : mov.reference_id ? (
                                                    <span className="text-[10px] ml-1 text-gray-400 block font-mono">#{mov.reference_id.slice(0, 6)}</span>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {mov.creator?.full_name?.split(' ')[0] || '-'}
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Detail */}
                                        {expandedRows.has(mov.id) && (
                                            <TableRow className="bg-transparent hover:bg-transparent border-none">
                                                <TableCell colSpan={7} className="p-0 border-none">
                                                    <div className="p-4 pl-16 bg-blue-50/10 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in slide-in-from-top-1">
                                                        <div>
                                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Conversão</h4>
                                                            <Card className="inline-block text-xs text-gray-700">
                                                                <CardContent className="p-2">
                                                                    <span className="text-gray-500">Input:</span> <span className="font-mono font-bold">{mov.qty_display} {mov.uom_label}</span>
                                                                    {mov.conversion_factor && mov.conversion_factor !== 1 && (
                                                                        <span className="ml-2 pl-2 border-l border-gray-200 text-gray-400">
                                                                            Fator: x{mov.conversion_factor}
                                                                        </span>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Referência Completa</h4>
                                                            <div className="text-xs text-gray-700">
                                                                Tipo: <span className="font-medium">{mov.reference_type}</span>
                                                            </div>
                                                            {mov.source_ref && (
                                                                <div className="text-xs text-gray-700 mt-1">
                                                                    Ref: <span className="font-mono bg-gray-100 px-1 rounded">{mov.source_ref}</span>
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">
                                                                ID: {mov.reference_id || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Observações</h4>
                                                            <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                                                {mov.notes || "Sem observações registradas."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            <InventoryMovementModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                type={modalType}
                onSuccess={loadData}
            />
        </div>
    );
}
