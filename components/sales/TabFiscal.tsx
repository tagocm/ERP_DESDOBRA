
"use client";

import { useState } from "react";
import { SalesOrder, SalesOrderNfe } from "@/types/sales";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabaseBrowser";
import { emitNfeMock } from "@/lib/data/sales-orders";
import { useToast } from "@/components/ui/use-toast";
import { FileText, AlertCircle, Loader2 } from "lucide-react";

interface TabFiscalProps {
    order: SalesOrder;
}

export function TabFiscal({ order }: TabFiscalProps) {
    const supabase = createClient();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [nfes, setNfes] = useState<SalesOrderNfe[]>(order.nfes || []);
    const [emissionOpen, setEmissionOpen] = useState(false);
    const [emitReason, setEmitReason] = useState("normal");

    const refreshNfes = async () => {
        const { data } = await supabase.from('sales_document_nfes').select('*').eq('document_id', order.id);
        if (data) setNfes(data as any);
    };

    const handleEmit = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await emitNfeMock(supabase, order.id, user.id, emitReason === 'antecipada', `Emissão via sistema - Motivo: ${emitReason}`);

            toast({ title: "NF-e Emitida", description: "Nota fiscal emitida com sucesso (MOCK)." });
            setEmissionOpen(false);
            refreshNfes();
        } catch (e: any) {
            toast({ title: "Erro na Emissão", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-gray-900">Documentos Fiscais</h3>

                <Dialog open={emissionOpen} onOpenChange={setEmissionOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <FileText className="w-4 h-4 mr-2" /> Emitir NF-e
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Emitir Nota Fiscal</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Tipo de Emissão</Label>
                                <Select value={emitReason} onValueChange={(val) => setEmitReason(val)}>
                                    <option value="normal">Normal (Saída de Mercadoria)</option>
                                    <option value="antecipada">Faturamento Antecipado</option>
                                    <option value="duplicata">Desconto de Duplicata</option>
                                </Select>
                            </div>
                            <Alert variant="warning">
                                <AlertCircle className="w-4 h-4" />
                                <div>
                                    <span className="font-semibold">Atenção:</span> Esta ação irá gerar uma NF-e oficial junto à SEFAZ (Simulado neste ambiente).
                                </div>
                            </Alert>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEmissionOpen(false)}>Cancelar</Button>
                            <Button onClick={handleEmit} disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Confirmar Emissão
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <div className="col-span-2">Número/Série</div>
                    <div className="col-span-3">Chave de Acesso</div>
                    <div className="col-span-2">Emissão</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1">Tipo</div>
                    <div className="col-span-2 text-right">Ações</div>
                </div>
                <div className="divide-y">
                    {nfes.map((nfe) => (
                        <div key={nfe.id} className="grid grid-cols-12 gap-4 p-3 items-center text-sm">
                            <div className="col-span-2 font-medium">{nfe.nfe_number} / {nfe.nfe_series}</div>
                            <div className="col-span-3 text-xs font-mono text-gray-500 truncate" title={nfe.nfe_key}>
                                {nfe.nfe_key || '-'}
                            </div>
                            <div className="col-span-2 text-gray-600">
                                {nfe.issued_at ? new Date(nfe.issued_at).toLocaleDateString() : '-'}
                            </div>
                            <div className="col-span-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${nfe.status === 'authorized' ? 'bg-green-100 text-green-700' :
                                    nfe.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {nfe.status === 'authorized' ? 'Autorizada' : nfe.status}
                                </span>
                            </div>
                            <div className="col-span-1 text-xs">
                                {nfe.is_antecipada ? 'Antecipada' : 'Normal'}
                            </div>
                            <div className="col-span-2 text-right">
                                <Button variant="ghost" size="sm" className="h-7 text-xs">Visualizar</Button>
                            </div>
                        </div>
                    ))}
                    {nfes.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">Nenhuma nota fiscal emitida.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
