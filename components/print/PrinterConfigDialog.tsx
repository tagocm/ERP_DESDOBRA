import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PrinterConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // We pass the hook values here to share state
    printerHook: any;
}

export function PrinterConfigDialog({ open, onOpenChange, printerHook }: PrinterConfigDialogProps) {
    const {
        availablePrinters,
        isQZConnected,
        connectQZ,
        printerName,
        savePrinter
    } = printerHook;

    const [selected, setSelected] = useState<string>(printerName || "");
    const [connecting, setConnecting] = useState(false);

    useEffect(() => {
        if (printerName) setSelected(printerName);
    }, [printerName]);

    useEffect(() => {
        if (open && !isQZConnected && !connecting) {
            setConnecting(true);
            connectQZ().finally(() => setConnecting(false));
        }
    }, [open, isQZConnected, connectQZ, connecting]);

    const handleSave = async () => {
        if (!selected) return;
        await savePrinter(selected);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="w-5 h-5 text-blue-600" />
                        Configurar Impressora Zebra
                    </DialogTitle>
                    <DialogDescription>
                        Selecione a impressora Zebra conectada via QZ Tray para impressão direta.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    {!isQZConnected ? (
                        <div className="text-center space-y-4">
                            <div className="bg-amber-50 text-amber-800 p-4 rounded-md text-sm">
                                O <strong>QZ Tray</strong> não foi detectado. Certifique-se de que ele está instalado e rodando em seu computador.
                            </div>
                            <Button variant="outline" onClick={() => connectQZ()} disabled={connecting}>
                                {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Tentar Conectar Novamente
                            </Button>
                            <div className="text-xs text-gray-500">
                                <a href="https://qz.io/download/" target="_blank" className="underline hover:text-blue-600">Baixar QZ Tray</a>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Impressora Selecionada</label>
                            <Select value={selected} onValueChange={setSelected}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma impressora..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePrinters.map((p: string) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">
                                Listando impressoras locais detectadas pelo QZ Tray.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!selected || !isQZConnected}>
                        Salvar Preferência
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
