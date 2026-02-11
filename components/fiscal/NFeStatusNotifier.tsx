"use client";

import { useEffect, useRef } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { createClient } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/ui/use-toast";

type NfeEmissionRealtime = {
    id: string;
    company_id: string;
    sales_document_id: string | null;
    status: string;
    c_stat?: string | null;
    x_motivo?: string | null;
    error_message?: string | null;
};

type SalesDocumentNfeRealtime = {
    id: string;
    document_id: string | null;
    status: string;
    details?: {
        cStat?: string;
        xMotivo?: string;
    } | null;
};

const INTERESTING_STATUSES = new Set([
    "authorized",
    "cancelled",
    "rejected",
    "denied",
    "error"
]);

export function NFeStatusNotifier() {
    const { selectedCompany } = useCompany();
    const { toast } = useToast();
    const supabaseRef = useRef(createClient());
    const statusByEmissionIdRef = useRef<Map<string, string>>(new Map());
    const statusByLegacyNfeIdRef = useRef<Map<string, string>>(new Map());
    const orderNumberCacheRef = useRef<Map<string, string>>(new Map());
    const orderCompanyCacheRef = useRef<Map<string, string>>(new Map());
    const mountedAtRef = useRef(Date.now());

    useEffect(() => {
        const supabase = supabaseRef.current;
        const companyId = selectedCompany?.id;

        if (!companyId) {
            statusByEmissionIdRef.current.clear();
            statusByLegacyNfeIdRef.current.clear();
            orderNumberCacheRef.current.clear();
            orderCompanyCacheRef.current.clear();
            return;
        }

        let isMounted = true;
        mountedAtRef.current = Date.now();

        const hydrateBaseline = async () => {
            const { data: emissions } = await supabase
                .from("nfe_emissions")
                .select("id,status")
                .eq("company_id", companyId)
                .order("updated_at", { ascending: false })
                .limit(100);

            if (!isMounted) return;
            for (const row of emissions || []) {
                if (row?.id && row?.status) {
                    statusByEmissionIdRef.current.set(row.id, row.status);
                }
            }

            const { data: legacyNfes } = await supabase
                .from("sales_document_nfes")
                .select("id,status")
                .order("updated_at", { ascending: false })
                .limit(100);

            if (!isMounted) return;
            for (const row of legacyNfes || []) {
                if (row?.id && row?.status) {
                    statusByLegacyNfeIdRef.current.set(row.id, row.status);
                }
            }
        };

        const fetchOrderNumber = async (salesDocumentId?: string | null) => {
            if (!salesDocumentId) return null;
            const cached = orderNumberCacheRef.current.get(salesDocumentId);
            if (cached) return cached;

            const { data } = await supabase
                .from("sales_documents")
                .select("document_number,company_id")
                .eq("id", salesDocumentId)
                .maybeSingle();

            const orderLabel = data?.document_number ? `#${data.document_number}` : null;
            if (orderLabel) {
                orderNumberCacheRef.current.set(salesDocumentId, orderLabel);
            }
            if (data?.company_id) {
                orderCompanyCacheRef.current.set(salesDocumentId, data.company_id);
            }
            return orderLabel;
        };

        const isOrderFromCurrentCompany = async (salesDocumentId?: string | null) => {
            if (!salesDocumentId) return false;
            const cachedCompanyId = orderCompanyCacheRef.current.get(salesDocumentId);
            if (cachedCompanyId) return cachedCompanyId === companyId;

            const { data } = await supabase
                .from("sales_documents")
                .select("company_id")
                .eq("id", salesDocumentId)
                .maybeSingle();

            if (data?.company_id) {
                orderCompanyCacheRef.current.set(salesDocumentId, data.company_id);
            }
            return data?.company_id === companyId;
        };

        const notifyStatus = async (row: NfeEmissionRealtime) => {
            const previousStatus = statusByEmissionIdRef.current.get(row.id);
            if (previousStatus === row.status) return;
            statusByEmissionIdRef.current.set(row.id, row.status);

            if (!INTERESTING_STATUSES.has(row.status)) return;

            const orderLabel = await fetchOrderNumber(row.sales_document_id);
            const suffix = orderLabel ? ` (${orderLabel})` : "";
            const reason = row.x_motivo || row.error_message || "Sem detalhes adicionais.";

            if (row.status === "authorized") {
                toast({
                    title: `NF-e autorizada${suffix}`,
                    description: row.c_stat ? `SEFAZ cStat ${row.c_stat}.` : "Autorização concluída."
                });
                return;
            }

            if (row.status === "cancelled") {
                toast({
                    title: `NF-e cancelada${suffix}`,
                    description: reason,
                    variant: "destructive"
                });
                return;
            }

            toast({
                title: `NF-e com falha${suffix}`,
                description: reason,
                variant: "destructive"
            });
        };

        const notifyLegacyStatus = async (row: SalesDocumentNfeRealtime) => {
            const sameCompany = await isOrderFromCurrentCompany(row.document_id);
            if (!sameCompany) return;

            const previousStatus = statusByLegacyNfeIdRef.current.get(row.id);
            if (previousStatus === row.status) return;
            statusByLegacyNfeIdRef.current.set(row.id, row.status);

            if (!INTERESTING_STATUSES.has(row.status)) return;

            const orderLabel = await fetchOrderNumber(row.document_id);
            const suffix = orderLabel ? ` (${orderLabel})` : "";
            const reason = row.details?.xMotivo || "Sem detalhes adicionais.";
            const cStat = row.details?.cStat;

            if (row.status === "authorized") {
                toast({
                    title: `NF-e autorizada${suffix}`,
                    description: cStat ? `SEFAZ cStat ${cStat}.` : "Autorização concluída."
                });
                return;
            }

            if (row.status === "cancelled") {
                toast({
                    title: `NF-e cancelada${suffix}`,
                    description: reason,
                    variant: "destructive"
                });
                return;
            }

            toast({
                title: `NF-e com falha${suffix}`,
                description: reason,
                variant: "destructive"
            });
        };

        const pollRecentStatuses = async () => {
            const windowStartIso = new Date(mountedAtRef.current - (10 * 60 * 1000)).toISOString();

            const [{ data: recentEmissions }, { data: recentLegacy }] = await Promise.all([
                supabase
                    .from("nfe_emissions")
                    .select("id,company_id,sales_document_id,status,c_stat,x_motivo,error_message,updated_at")
                    .eq("company_id", companyId)
                    .gte("updated_at", windowStartIso)
                    .order("updated_at", { ascending: false })
                    .limit(30),
                supabase
                    .from("sales_document_nfes")
                    .select("id,document_id,status,details,updated_at")
                    .gte("updated_at", windowStartIso)
                    .order("updated_at", { ascending: false })
                    .limit(30)
            ]);

            for (const row of recentEmissions || []) {
                if (!row?.id || !row?.status) continue;
                if (!INTERESTING_STATUSES.has(row.status)) continue;
                const prev = statusByEmissionIdRef.current.get(row.id);
                if (prev === row.status) continue;
                void notifyStatus(row as NfeEmissionRealtime);
            }

            for (const row of recentLegacy || []) {
                if (!row?.id || !row?.status) continue;
                if (!INTERESTING_STATUSES.has(row.status)) continue;
                const prev = statusByLegacyNfeIdRef.current.get(row.id);
                if (prev === row.status) continue;
                void notifyLegacyStatus(row as SalesDocumentNfeRealtime);
            }
        };

        hydrateBaseline();

        const channel = supabase
            .channel(`nfe-emissions-notifier-${companyId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "nfe_emissions",
                    filter: `company_id=eq.${companyId}`
                },
                (payload: any) => {
                    const row = payload?.new as NfeEmissionRealtime | undefined;
                    if (!row?.id || !row?.status) return;
                    void notifyStatus(row);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "sales_document_nfes"
                },
                (payload: any) => {
                    const row = payload?.new as SalesDocumentNfeRealtime | undefined;
                    if (!row?.id || !row?.status) return;
                    void notifyLegacyStatus(row);
                }
            )
            .subscribe();

        const pollTimer = setInterval(() => {
            void pollRecentStatuses();
        }, 10000);

        void pollRecentStatuses();

        return () => {
            isMounted = false;
            clearInterval(pollTimer);
            void supabase.removeChannel(channel);
        };
    }, [selectedCompany?.id, toast]);

    useEffect(() => {
        const handler = (event: Event) => {
            const payload = (event as CustomEvent<{
                type?: string;
                message?: string;
                orderNumber?: number | string | null;
            }>).detail;

            if (!payload?.type) return;

            const orderSuffix = payload.orderNumber ? ` (#${payload.orderNumber})` : "";

            if (payload.type === "queued") {
                toast({
                    title: `NF-e enviada para fila${orderSuffix}`,
                    description: "Você será notificado quando a SEFAZ responder."
                });
                return;
            }

            if (payload.type === "enqueue_error") {
                toast({
                    title: `Falha ao enviar NF-e${orderSuffix}`,
                    description: payload.message || "Não foi possível enfileirar a emissão.",
                    variant: "destructive"
                });
            }
        };

        window.addEventListener("nfe-emit-feedback", handler as EventListener);
        return () => window.removeEventListener("nfe-emit-feedback", handler as EventListener);
    }, [toast]);

    return null;
}
