import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { printZPL, getPrinters, qzConnect, setupQZSecurity } from '@/lib/qz-printer';
import { downloadZpl } from '@/lib/zpl-generator';

export function useQZPrinter() {
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [isQZConnected, setIsQZConnected] = useState(false);
    const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    // Init security context
    useEffect(() => {
        setupQZSecurity();
    }, []);

    // Load saved printer from DB
    const loadSavedPrinter = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Get Company ID
        const { data: member } = await supabase
            .from('company_members')
            .select('company_id')
            .eq('auth_user_id', session.user.id)
            .limit(1)
            .maybeSingle();

        if (member?.company_id) {
            setCompanyId(member.company_id);

            // 2. Get Settings
            const { data, error } = await supabase
                .from('company_printer_settings')
                .select('zebra_printer_name')
                .eq('company_id', member.company_id)
                .maybeSingle();

            if (data?.zebra_printer_name) {
                setPrinterName(data.zebra_printer_name);
            }
        }
    }, [supabase]);

    useEffect(() => {
        loadSavedPrinter();
    }, [loadSavedPrinter]);

    // Connect to QZ
    const connectQZ = useCallback(async () => {
        try {
            await qzConnect();
            setIsQZConnected(true);
            const printers = await getPrinters();
            setAvailablePrinters(printers);
        } catch (e) {
            console.error("QZ Connect failed", e);
            setIsQZConnected(false);
        }
    }, []);

    // Print Function
    const print = async (zpl: string, updateStatus?: (msg: string) => void) => {
        // 1. Check if printer is configured
        if (!printerName) {
            setConfigOpen(true); // Open config if no printer
            return false;
        }

        // 2. Try to connect if not connected
        try {
            updateStatus?.("Conectando à impressora...");
            if (!isQZConnected) await connectQZ();

            updateStatus?.("Enviando dados...");
            await printZPL(printerName, zpl);

            updateStatus?.("Impresso com sucesso!");
            toast({ title: "Impresso com sucesso" });

            // Log job (fire and forget)
            logPrintJob(true);
            return true;

        } catch (error: any) {
            console.error("Print failed", error);

            // Fallback logic handled by caller or here?
            // User requested fallback behavior: "Se nao estiver disponivel... baixar .zpl"
            // We return false so caller can decide or we trigger fallback here.

            const shouldDownload = confirm("Não foi possível conectar à impressora Zebra (QZ Tray). Deseja baixar o arquivo ZPL?");
            if (shouldDownload) {
                downloadZpl(zpl, `etiqueta-fallback.zpl`);
            }

            logPrintJob(false, error.message);
            return false;
        }
    };

    const logPrintJob = async (success: boolean, errorMsg?: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        // Just a best-effort log
        if (!session || !companyId) return;

        await supabase.from('print_jobs').insert({
            company_id: companyId,
            user_id: session.user.id,
            status: success ? 'success' : 'error',
            error_message: errorMsg,
        });
    };

    const savePrinter = async (name: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // If we don't have companyId yet, try to fetch it again (edge case)
        let targetCompanyId = companyId;
        if (!targetCompanyId) {
            const { data: member } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('auth_user_id', session.user.id)
                .limit(1)
                .maybeSingle();
            targetCompanyId = member?.company_id;
        }

        if (targetCompanyId) {
            const { error } = await supabase
                .from('company_printer_settings')
                .upsert({
                    company_id: targetCompanyId,
                    zebra_printer_name: name,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'company_id' });

            if (!error) {
                setPrinterName(name);
                setCompanyId(targetCompanyId);
                toast({ title: "Impressora salva" });
                setConfigOpen(false);
            } else {
                console.error(error);
                toast({ title: "Erro ao salvar", variant: "destructive" });
            }
        } else {
            toast({ title: "Erro: Empresa não encontrada", variant: "destructive" });
        }
    };

    return {
        printerName,
        availablePrinters,
        isQZConnected,
        connectQZ,
        print,
        savePrinter,
        configOpen,
        setConfigOpen
    };
}
