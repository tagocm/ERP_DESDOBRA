/**
 * Event Detail Drawer
 * Main interface for reviewing and approving financial events
 */

"use client";

import React, { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, Save, ArrowRight } from "lucide-react";
import {
    getEventDetailsAction,
    approveEventAction,
    rejectEventAction,
    updateInstallmentsAction,
    validateEventAction,
    autoFixInstallmentsAction,
    recalculateInstallmentsAction,
    listBankAccountsAction
} from "@/app/actions/finance-events";
import { InstallmentsEditor, BankAccountOption } from "./InstallmentsEditor";
import { ValidationChecklist } from "./ValidationChecklist";
import { type FinancialEvent, type ValidationPendency } from "@/lib/finance/events-db";
import { formatCurrency, formatDate, cn, toTitleCase } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";

interface EventDetailDrawerProps {
    eventId: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function EventDetailDrawer({ eventId, onClose, onSuccess }: EventDetailDrawerProps) {
    const { toast } = useToast();
    const [event, setEvent] = useState<FinancialEvent | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendencies, setPendencies] = useState<ValidationPendency[]>([]);
    const [rejectDialog, setRejectDialog] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [accounts, setAccounts] = useState<BankAccountOption[]>([]);

    // Fetch Event Data
    useEffect(() => {
        if (eventId) {
            loadEvent(eventId);
        }
    }, [eventId]);

    const loadEvent = async (id: string) => {
        setLoading(true);
        try {
            const res = await getEventDetailsAction(id);
            if (res.success && res.data) {
                setEvent(res.data);
                const valRes = await validateEventAction(id);
                if (valRes.success) setPendencies(valRes.data || []);

                if (res.data.company_id) {
                    const accRes = await listBankAccountsAction(res.data.company_id);
                    if (accRes.success) setAccounts(accRes.data || []);
                }
            } else {
                toast({ title: "Erro", description: res.error, variant: "destructive" });
                onClose();
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Erro", description: "Falha ao carregar evento", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveInstallments = async () => {
        if (!event || !event.installments) return;
        setSaving(true);
        try {
            const res = await updateInstallmentsAction(event.id, event.installments);
            if (res.success) {
                toast({ title: "Parcelas salvas com sucesso!" });
                loadEvent(event.id);
            } else {
                toast({ title: "Erro ao salvar", description: res.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!event) return;
        setSaving(true);
        try {
            const res = await approveEventAction(event.id);
            if (res.success) {
                toast({
                    title: "Evento Aprovado",
                    description: `Título ${res.data?.direction} gerado com sucesso.`,
                    action: <Button variant="outline" size="sm" onClick={() => window.open(`/app/financeiro/${res.data?.direction === 'AR' ? 'recebimentos' : 'pagamentos'}`, '_blank')}>Ver Título</Button>
                } as any);
                onSuccess();
                onClose();
            } else {
                toast({ title: "Não foi possível aprovar", description: res.error, variant: "destructive" });
                const valRes = await validateEventAction(event.id);
                if (valRes.success) setPendencies(valRes.data || []);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!event) return;
        setSaving(true);
        try {
            const res = await rejectEventAction(event.id, rejectReason);
            if (res.success) {
                toast({ title: "Evento rejeitado" });
                setRejectDialog(false);
                onSuccess();
                onClose();
            } else {
                toast({ title: "Erro ao rejeitar", description: res.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const [recalculateOpen, setRecalculateOpen] = useState(false);

    const handleAutoFix = async (key: string) => {
        if (!event) return;
        if (key === 'installments_sum_mismatch') {
            const res = await autoFixInstallmentsAction(event.id);
            if (res.success) {
                toast({ title: "Parcelas recalculadas para bater com o total" });
                loadEvent(event.id);
            }
        }
    };

    const handleRecalculate = async () => {
        setRecalculateOpen(true);
    };

    const handleConfirmRecalc = async (condition: string) => {
        if (!event) return;
        setSaving(true);
        try {
            const res = await recalculateInstallmentsAction(event.id, condition);
            if (res.success) {
                toast({ title: "Parcelas recalculadas com sucesso!" });
                loadEvent(event.id);
                setRecalculateOpen(false);
            } else {
                toast({ title: "Erro ao recalcular", description: res.error, variant: "destructive" });
            }
        } finally {
            setSaving(false);
        }
    };

    const getOperationalStatusLabel = (status: string | null | undefined, type: string) => {
        if (!status) return 'Desconhecido';
        const map: Record<string, string> = {
            'pending': 'Aguardando',
            'separation': 'Em Separação',
            'expedition': 'Expedição',
            'delivered': 'Entregue',
            'not_loaded': 'Não Carregado',
            'loaded': 'Carregado',
            'draft': 'Rascunho',
            'sent': 'Enviado',
            'received': 'Recebido',
            'cancelled': 'Cancelado',
            'confirmed': 'Confirmado',
        };
        return map[status] || toTitleCase(status);
    };

    const getOperationalStatusColor = (status: string | null | undefined) => {
        switch (status) {
            case 'separation':
            case 'expedition':
            case 'sent':
                return "bg-blue-50 text-blue-700 border-blue-200";
            case 'delivered':
            case 'received':
            case 'loaded':
                return "bg-green-50 text-green-700 border-green-200";
            case 'pending':
            case 'draft':
                return "bg-gray-100 text-gray-600 border-gray-200";
            case 'not_loaded':
            case 'cancelled':
                return "bg-red-50 text-red-700 border-red-200";
            default:
                return "bg-gray-50 text-gray-700 border-gray-200";
        }
    };

    if (!eventId) return null;

    // Use the custom Sheet API (isOpen, onClose, title, children)
    return (
        <>
            <Sheet
                isOpen={!!eventId}
                onClose={onClose}
                title="Detalhes do Lançamento"
                side="right"
            >
                <div className="flex flex-col h-full space-y-6">
                    <div className="flex items-center gap-2 -mt-4 mb-2">
                        <Badge variant={event?.status === 'em_atencao' ? 'destructive' : 'outline'}>
                            {event?.status === 'em_atencao' ? 'EM ATENÇÃO' : event?.status?.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500 font-mono">#{eventId.slice(0, 8)}</span>
                    </div>

                    {loading || !event ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <>
                            {/* Event Header Card */}
                            <div className="bg-white border rounded-xl shadow-sm p-4 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Origem</label>
                                    <div className="font-semibold text-gray-900">{event.origin_reference}</div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-xs text-gray-500 uppercase">{event.origin_type}</span>
                                        <Badge variant="outline" className={cn("text-[8px] h-4 px-1", getOperationalStatusColor(event.operational_status))}>
                                            {getOperationalStatusLabel(event.operational_status, event.origin_type)}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Parceiro</label>
                                    <div className="font-semibold text-gray-900 truncate" title={event.partner_name || ''}>{event.partner_name}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Emissão</label>
                                    <div>{formatDate(event.issue_date)}</div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total</label>
                                    <div className="font-black text-lg text-gray-900">{formatCurrency(event.total_amount)}</div>
                                </div>
                            </div>

                            {/* Installments Editor */}
                            <div className="bg-white border rounded-xl shadow-sm p-4">
                                <InstallmentsEditor
                                    installments={event.installments || []}
                                    totalAmount={event.total_amount}
                                    accounts={accounts}
                                    onChange={(newInstallments) => setEvent({ ...event, installments: newInstallments })}
                                    onRecalculate={handleRecalculate}
                                    readonly={event.status === 'aprovado' || event.status === 'reprovado'}
                                />

                                <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSaveInstallments}
                                        disabled={saving || event.status === 'aprovado'}
                                        className="text-gray-600 border-gray-200 hover:bg-gray-50"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Alterações
                                    </Button>
                                </div>
                            </div>

                            {/* Validation Checklist */}
                            <ValidationChecklist
                                pendencies={pendencies}
                                onAutoFix={handleAutoFix}
                                isProcessing={saving}
                            />

                            {/* Footer Actions */}
                            <div className="pt-6 border-t mt-auto flex flex-col sm:flex-row gap-3 justify-end">
                                <Button variant="ghost" onClick={onClose} disabled={saving}>
                                    Fechar
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => setRejectDialog(true)}
                                    disabled={saving || event.status === 'aprovado'}
                                >
                                    Reprovar
                                </Button>

                                <Button
                                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto font-bold shadow-md shadow-green-200"
                                    onClick={handleApprove}
                                    disabled={saving || event.status === 'aprovado' || pendencies.some(p => p.severity === 'error')}
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Aprovar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Sheet>

            {/* Reject Dialog */}
            <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reprovar Lançamento</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Motivo da reprovação (obrigatório)</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Descreva o motivo..."
                            className="mt-2"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancelar</Button>
                        <Button
                            variant="danger"
                            onClick={handleReject}
                            disabled={rejectReason.length < 10 || saving}
                        >
                            Confirmar Reprovação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <RecalculateLogic
                isOpen={recalculateOpen}
                onClose={() => setRecalculateOpen(false)}
                onConfirm={handleConfirmRecalc}
                isProcessing={saving}
            />
        </>
    );
}

function RecalculateLogic({ isOpen, onClose, onConfirm, isProcessing }: { isOpen: boolean, onClose: () => void, onConfirm: (cond: string) => void, isProcessing: boolean }) {
    const [condition, setCondition] = useState("");

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Recalcular Parcelas</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label>Condição de Pagamento</Label>
                        <Input
                            placeholder="Ex: 30/60/90, 3x30, À vista"
                            value={condition}
                            onChange={e => setCondition(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Formatos aceitos: "30/60/90" (dias fixos), "3x30" (intervalo), "À vista"
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => onConfirm(condition)} disabled={!condition || isProcessing}>
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Recalcular
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
