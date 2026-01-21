import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { useToast } from "@/components/ui/use-toast";
import { Play } from "lucide-react";

interface NewWorkOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** Optional initial date to pre-fill */
    initialDate?: string;
}

export function NewWorkOrderModal({ isOpen, onClose, onSuccess, initialDate }: NewWorkOrderModalProps) {
    const { selectedCompany } = useCompany();
    const supabase = createClient();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [boms, setBoms] = useState<any[]>([]);

    // Form State
    const [selectedProduct, setSelectedProduct] = useState("");
    const [selectedBom, setSelectedBom] = useState("");
    const [plannedQty, setPlannedQty] = useState<number | string>("");
    const [notes, setNotes] = useState("");
    const [scheduledDate, setScheduledDate] = useState(initialDate || new Date().toISOString().split('T')[0]);

    // Update scheduledDate if initialDate changes or opens
    useEffect(() => {
        if (isOpen && initialDate) {
            setScheduledDate(initialDate);
        } else if (isOpen && !initialDate) {
            // Default to today if no specific date passed
            setScheduledDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen, initialDate]);

    // Fetch Products on Open
    useEffect(() => {
        if (isOpen && selectedCompany) {
            // Fetch finished goods or WIP that are active
            supabase
                .from('items')
                .select('id, name, uom')
                .eq('company_id', selectedCompany.id)
                .in('type', ['finished_good', 'wip'])
                .eq('is_active', true)
                .order('name')
                .then(({ data }) => setProducts(data || []));
        }
    }, [isOpen, selectedCompany]);

    // Fetch BOMs when Product Selected
    useEffect(() => {
        if (selectedProduct) {
            supabase
                .from('bom_headers')
                .select('id, version, yield_qty, yield_uom')
                .eq('item_id', selectedProduct)
                .eq('is_active', true)
                .order('version', { ascending: false })
                .then(({ data }) => {
                    setBoms(data || []);
                    // Auto-select latest
                    if (data && data.length > 0) setSelectedBom(data[0].id);
                    else setSelectedBom("");
                });
        }
    }, [selectedProduct]);

    const handleSubmit = async () => {
        if (!selectedProduct || !selectedBom || !plannedQty || Number(plannedQty) <= 0 || !scheduledDate) {
            toast({ title: "Inválido", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.from('work_orders').insert({
                company_id: selectedCompany!.id,
                item_id: selectedProduct,
                bom_id: selectedBom,
                planned_qty: Number(plannedQty),
                produced_qty: 0,
                status: 'planned',
                scheduled_date: scheduledDate,
                notes: notes || null
            });

            if (error) throw error;

            toast({ title: "Sucesso", description: "Ordem de Produção criada.", variant: "default" });
            onSuccess();
            handleClose();

        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Falha ao criar ordem.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setProducts([]);
        setBoms([]);
        setSelectedProduct("");
        setSelectedBom("");
        setPlannedQty("");
        setNotes("");
        setScheduledDate(new Date().toISOString().split('T')[0]);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nova Ordem de Produção</DialogTitle>
                    <DialogDescription>Planeje uma nova produção baseada em ficha técnica.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Produto</Label>
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Receita / Ficha Técnica</Label>
                        <Select value={selectedBom} onValueChange={setSelectedBom} disabled={!selectedProduct || boms.length === 0}>
                            <SelectTrigger>
                                <SelectValue placeholder={boms.length === 0 ? "Sem receita ativa" : "Selecione a versão..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {boms.map(b => (
                                    <SelectItem key={b.id} value={b.id}>
                                        v{b.version} • Rendimento: {b.yield_qty} {b.yield_uom}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedProduct && boms.length === 0 && (
                            <p className="text-xs text-amber-600">Este item não possui receita ativa.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Qtd. Planejada</Label>
                            <Input
                                type="number"
                                min={0}
                                value={plannedQty}
                                onChange={e => setPlannedQty(e.target.value)}
                                className="text-right"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Data Programada</Label>
                            <Input
                                type="date"
                                value={scheduledDate}
                                onChange={e => setScheduledDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {selectedProduct && (
                        <div className="text-right text-xs text-gray-400 -mt-2">
                            Unidade: {products.find(p => p.id === selectedProduct)?.uom}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Instruções adicionais..."
                            className="h-20"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !selectedBom}>
                        {isLoading && <Play className="w-4 h-4 mr-2 animate-spin" />}
                        Criar Ordem
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
