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

type NfeCorrectionLetterRealtime = {
    id: string;
    company_id: string;
    sales_document_id: string | null;
    sequence: number;
    status: string;
    c_stat?: string | null;
    x_motivo?: string | null;
};

type NfeCancellationRealtime = {
    id: string;
    company_id: string;
    sales_document_id: string | null;
    sequence: number;
    status: string;
    c_stat?: string | null;
    x_motivo?: string | null;
};

const INTERESTING_STATUSES = new Set([
    "authorized",
    "cancelled",
    "rejected",
    "denied",
    "error"
]);

const INTERESTING_CCE_STATUSES = new Set([
    "authorized",
    "rejected",
    "failed"
]);

const INTERESTING_CANCEL_STATUSES = new Set([
    "authorized",
    "rejected",
    "failed"
]);

export function NFeStatusNotifier() {
    const { selectedCompany } = useCompany();
    const { toast } = useToast();
    const supabaseRef = useRef(createClient());
    const statusByEmissionIdRef = useRef<Map<string, string>>(new Map());
    const statusByLegacyNfeIdRef = useRef<Map<string, string>>(new Map());
    const statusByCorrectionIdRef = useRef<Map<string, string>>(new Map());
    const statusByCancellationIdRef = useRef<Map<string, string>>(new Map());
    const orderNumberCacheRef = useRef<Map<string, string>>(new Map());
    const orderCompanyCacheRef = useRef<Map<string, string>>(new Map());
    const mountedAtRef = useRef(Date.now());

    useEffect(() => {
        const supabase = supabaseRef.current;
        const companyId = selectedCompany?.id;

        if (!companyId) {
            statusByEmissionIdRef.current.clear();
            statusByLegacyNfeIdRef.current.clear();
            statusByCorrectionIdRef.current.clear();
            statusByCancellationIdRef.current.clear();
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

            const { data: corrections } = await supabase
                .from("nfe_correction_letters")
                .select("id,status")
                .eq("company_id", companyId)
                .order("updated_at", { ascending: false })
                .limit(100);

            if (!isMounted) return;
            for (const row of corrections || []) {
                if (row?.id && row?.status) {
                    statusByCorrectionIdRef.current.set(row.id, row.status);
                }
            }

            const { data: cancellations } = await supabase
                .from("nfe_cancellations")
                .select("id,status")
                .eq("company_id", companyId)
                .order("updated_at", { ascending: false })
                .limit(100);

            if (!isMounted) return;
            for (const row of cancellations || []) {
                if (row?.id && row?.status) {
                    statusByCancellationIdRef.current.set(row.id, row.status);
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

        const notifyCorrectionStatus = async (row: NfeCorrectionLetterRealtime) => {
            const previousStatus = statusByCorrectionIdRef.current.get(row.id);
            if (previousStatus === row.status) return;
            statusByCorrectionIdRef.current.set(row.id, row.status);

            if (!INTERESTING_CCE_STATUSES.has(row.status)) return;

            const orderLabel = await fetchOrderNumber(row.sales_document_id);
            const suffix = orderLabel ? ` (${orderLabel})` : "";
            const sequenceLabel = Number.isFinite(row.sequence) ? ` #${row.sequence}` : "";
            const reason = row.x_motivo || "Sem detalhes adicionais.";

            if (row.status === "authorized") {
                toast({
                    title: `CC-e autorizada${sequenceLabel}${suffix}`,
                    description: row.c_stat ? `SEFAZ cStat ${row.c_stat}.` : "Carta de correção registrada."
                });
                return;
            }

            toast({
                title: `CC-e com falha${sequenceLabel}${suffix}`,
                description: reason,
                variant: "destructive"
            });
        };

        const notifyCancellationStatus = async (row: NfeCancellationRealtime) => {
            const previousStatus = statusByCancellationIdRef.current.get(row.id);
            if (previousStatus === row.status) return;
            statusByCancellationIdRef.current.set(row.id, row.status);

            if (!INTERESTING_CANCEL_STATUSES.has(row.status)) return;

            const orderLabel = await fetchOrderNumber(row.sales_document_id);
            const suffix = orderLabel ? ` (${orderLabel})` : "";
            const sequenceLabel = Number.isFinite(row.sequence) ? ` #${row.sequence}` : "";
            const reason = row.x_motivo || "Sem detalhes adicionais.";

            if (row.status === "authorized") {
                toast({
                    title: `Cancelamento autorizado${sequenceLabel}${suffix}`,
                    description: row.c_stat ? `SEFAZ cStat ${row.c_stat}.` : "NF-e cancelada com sucesso."
                });
                return;
            }

            toast({
                title: `Falha no cancelamento${sequenceLabel}${suffix}`,
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

            const { data: recentCorrections } = await supabase
                .from("nfe_correction_letters")
                .select("id,company_id,sales_document_id,sequence,status,c_stat,x_motivo,updated_at")
                .eq("company_id", companyId)
                .gte("updated_at", windowStartIso)
                .order("updated_at", { ascending: false })
                .limit(30);

            const { data: recentCancellations } = await supabase
                .from("nfe_cancellations")
                .select("id,company_id,sales_document_id,sequence,status,c_stat,x_motivo,updated_at")
                .eq("company_id", companyId)
                .gte("updated_at", windowStartIso)
                .order("updated_at", { ascending: false })
                .limit(30);

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

            for (const row of recentCorrections || []) {
                if (!row?.id || !row?.status) continue;
                if (!INTERESTING_CCE_STATUSES.has(row.status)) continue;
                const prev = statusByCorrectionIdRef.current.get(row.id);
                if (prev === row.status) continue;
                void notifyCorrectionStatus(row as NfeCorrectionLetterRealtime);
            }

            for (const row of recentCancellations || []) {
                if (!row?.id || !row?.status) continue;
                if (!INTERESTING_CANCEL_STATUSES.has(row.status)) continue;
                const prev = statusByCancellationIdRef.current.get(row.id);
                if (prev === row.status) continue;
                void notifyCancellationStatus(row as NfeCancellationRealtime);
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
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "nfe_correction_letters",
                    filter: `company_id=eq.${companyId}`
                },
                (payload: any) => {
                    const row = payload?.new as NfeCorrectionLetterRealtime | undefined;
                    if (!row?.id || !row?.status) return;
                    void notifyCorrectionStatus(row);
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "nfe_cancellations",
                    filter: `company_id=eq.${companyId}`
                },
                (payload: any) => {
                    const row = payload?.new as NfeCancellationRealtime | undefined;
                    if (!row?.id || !row?.status) return;
                    void notifyCancellationStatus(row);
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

    useEffect(() => {
        const handler = (event: Event) => {
            const payload = (event as CustomEvent<{
                type?: string;
                message?: string;
                sequence?: number | null;
                orderNumber?: number | string | null;
            }>).detail;

            if (!payload?.type) return;

            const orderSuffix = payload.orderNumber ? ` (#${payload.orderNumber})` : "";
            const sequenceSuffix = payload.sequence ? ` #${payload.sequence}` : "";

            if (payload.type === "queued") {
                toast({
                    title: `Cancelamento enviado para fila${sequenceSuffix}${orderSuffix}`,
                    description: "Você será notificado quando a SEFAZ responder."
                });
                return;
            }

            if (payload.type === "enqueue_error") {
                toast({
                    title: `Falha ao enviar cancelamento${orderSuffix}`,
                    description: payload.message || "Não foi possível enfileirar o cancelamento da NF-e.",
                    variant: "destructive"
                });
            }
        };

        window.addEventListener("nfe-cancel-feedback", handler as EventListener);
        return () => window.removeEventListener("nfe-cancel-feedback", handler as EventListener);
    }, [toast]);

    useEffect(() => {
        const handler = (event: Event) => {
            const payload = (event as CustomEvent<{
                type?: string;
                message?: string;
                sequence?: number | null;
                orderNumber?: number | string | null;
            }>).detail;

            if (!payload?.type) return;

            const orderSuffix = payload.orderNumber ? ` (#${payload.orderNumber})` : "";
            const sequenceSuffix = payload.sequence ? ` #${payload.sequence}` : "";

            if (payload.type === "queued") {
                toast({
                    title: `CC-e enviada para fila${sequenceSuffix}${orderSuffix}`,
                    description: "Você será notificado quando a SEFAZ responder."
                });
                return;
            }

            if (payload.type === "enqueue_error") {
                toast({
                    title: `Falha ao enviar CC-e${orderSuffix}`,
                    description: payload.message || "Não foi possível enfileirar a carta de correção.",
                    variant: "destructive"
                });
            }
        };

        window.addEventListener("nfe-cce-feedback", handler as EventListener);
        return () => window.removeEventListener("nfe-cce-feedback", handler as EventListener);
    }, [toast]);

    return null;
}
