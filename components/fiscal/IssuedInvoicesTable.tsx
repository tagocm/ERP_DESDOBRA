'use client';

import React, { useEffect, useState } from 'react';
import { Receipt, Download, XCircle, RefreshCw, Printer, CheckCircle2, FilePenLine, Loader2, X, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadNfeXml } from '@/lib/fiscal/nfe-actions';
import { createClient } from '@/utils/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/Checkbox';
import { ListPagination } from '@/components/ui/ListPagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';

interface Props {
    data: any[];
    companyId: string;
    isLoading: boolean;
    onInvoiceCancelled: () => void;
    emptyState?: {
        title: string;
        description: string;
    };
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
    };
}

export function IssuedInvoicesTable({ data, companyId, isLoading, onInvoiceCancelled, emptyState, pagination }: Props) {
    const { toast } = useToast();
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
    const [correctionText, setCorrectionText] = useState('');
    const [selectedCorrectionNfe, setSelectedCorrectionNfe] = useState<any | null>(null);
    const [submittingCorrectionId, setSubmittingCorrectionId] = useState<string | null>(null);
    const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [selectedCancellationNfe, setSelectedCancellationNfe] = useState<any | null>(null);
    const [submittingCancellationId, setSubmittingCancellationId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchDownloadingXml, setIsBatchDownloadingXml] = useState(false);
    const [isBatchDownloadingDanfe, setIsBatchDownloadingDanfe] = useState(false);
    const [isBatchPrinting, setIsBatchPrinting] = useState(false);

    useEffect(() => {
        const validIds = new Set(data.map((nfe) => nfe.id));
        setSelectedIds((previous) => {
            const next = new Set<string>();
            previous.forEach((id) => {
                if (validIds.has(id)) next.add(id);
            });
            return next;
        });
    }, [data]);

    const extractErrorMessage = (payload: any): string => {
        const details = payload?.details;
        const errorDetails = payload?.error?.details;
        if (typeof errorDetails?.details === 'string' && errorDetails.details.trim()) return errorDetails.details;
        if (typeof errorDetails === 'string' && errorDetails.trim()) return errorDetails;
        if (typeof errorDetails?.message === 'string' && errorDetails.message.trim()) return errorDetails.message;
        if (typeof details === 'string' && details.trim()) return details;
        if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message;
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
        if (typeof details?.details === 'string' && details.details.trim()) return details.details;
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
        return 'Erro ao gerar DANFE';
    };

    const extractApiErrorMessage = (payload: any, fallback: string): string => {
        if (typeof payload === 'string' && payload.trim()) return payload;
        if (typeof payload?.error?.details?.message === 'string' && payload.error.details.message.trim()) return payload.error.details.message;
        if (typeof payload?.error?.details?.hint === 'string' && payload.error.details.hint.trim()) return payload.error.details.hint;
        if (typeof payload?.details === 'string' && payload.details.trim()) return payload.details;
        if (typeof payload?.error?.details === 'string' && payload.error.details.trim()) return payload.error.details;
        if (typeof payload?.error?.code === 'string' && payload.error.code.trim()) return `${fallback} (${payload.error.code})`;
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
        if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message;
        return fallback;
    };

    const handleSync = async (nfeId: string, accessKey: string) => {
        if (!accessKey) {
            toast({
                title: 'Chave de acesso ausente',
                description: 'Não foi possível consultar sem a chave de acesso da NF-e.',
                variant: 'destructive',
            });
            return;
        }

        setSyncingId(nfeId);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch('/api/nfe/query-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`
                },
                body: JSON.stringify({ accessKey, companyId })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(extractApiErrorMessage(result, 'Erro ao consultar status'));
            }

            if (result.success) {
                toast({
                    title: 'Status da NF-e atualizado',
                    description: `${result.status} - ${result.xMotivo}`,
                });
                onInvoiceCancelled(); // Refresh list
            } else {
                toast({
                    title: 'Consulta realizada',
                    description: result.xMotivo || 'SEFAZ consultada com sucesso.',
                });
                if (result.status !== 'processing') {
                    onInvoiceCancelled(); // Refresh list if status changed
                }
            }

        } catch (error: any) {
            console.error('Sync error:', error);
            toast({
                title: 'Erro ao sincronizar NF-e',
                description: error?.message || 'Falha ao consultar status da NF-e.',
                variant: 'destructive',
            });
        } finally {
            setSyncingId(null);
        }
    };

    const handlePrintDanfe = async (nfeId: string) => {
        setPrintingId(nfeId);
        try {
            const response = await fetch('/api/fiscal/nfe/danfe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: nfeId })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error('[DANFE Client] API Error:', err);
                throw new Error(extractErrorMessage(err));
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');

            // Clean up? usually not for _blank unless we track it
        } catch (error: any) {
            console.error('DANFE Error:', error);
            toast({
                title: 'Erro ao gerar DANFE',
                description: error?.message || 'Falha ao gerar DANFE da NF-e.',
                variant: 'destructive',
            });
        } finally {
            setPrintingId(null);
        }
    };

    const fetchCorrectionLetterArtifact = async (nfeId: string) => {
        const response = await fetch('/api/fiscal/nfe/correction-letter/artifact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emissionId: nfeId }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.success || !payload?.data?.xml) {
            throw new Error(payload?.details || payload?.error || 'Carta de correção não disponível para esta NF-e.');
        }

        return payload.data as {
            id: string;
            accessKey: string;
            number: string | number | null;
            series: string | number | null;
            sequence: number;
            xml: string;
        };
    };

    const handlePrintCorrectionLetter = async (nfeId: string) => {
        setPrintingId(nfeId);
        try {
            const artifact = await fetchCorrectionLetterArtifact(nfeId);
            const response = await fetch('/api/fiscal/nfe/events/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'correction_letter',
                    id: artifact.id,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(extractApiErrorMessage(payload, 'PDF da carta de correção não disponível.'));
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const printWindow = window.open(blobUrl, '_blank');
            if (!printWindow) {
                window.URL.revokeObjectURL(blobUrl);
                throw new Error('O navegador bloqueou a abertura da janela de impressão.');
            }

            setTimeout(() => {
                try {
                    printWindow.focus();
                    printWindow.print();
                } catch {
                    // noop
                }
            }, 200);
        } catch (error: any) {
            console.error('CC-e Print Error:', error);
            toast({
                title: 'Erro ao imprimir CC-e',
                description: error?.message || 'Não foi possível imprimir a carta de correção.',
                variant: 'destructive',
            });
        } finally {
            setPrintingId(null);
        }
    };

    const handleVerifySefaz = async (nfe: any) => {
        const nfeId = nfe?.id;
        if (!nfeId) {
            toast({
                title: 'NF-e inválida',
                description: 'Não foi possível identificar a nota fiscal selecionada.',
                variant: 'destructive',
            });
            return;
        }

        setVerifyingId(nfeId);
        try {
            const response = await fetch('/api/fiscal/nfe/consulta-situacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: nfeId,
                    accessKey: nfe?.nfe_key || null,
                    salesDocumentId: nfe?.document?.id || null,
                    nfeNumber: nfe?.nfe_number || null,
                    nfeSeries: nfe?.nfe_series || null,
                })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(extractApiErrorMessage(result, 'Erro ao consultar SEFAZ'));
            }

            const parts = [
                `cStat ${result.cStat} - ${result.xMotivo}`,
                result.nProt ? `Prot. ${result.nProt}` : null,
                result.dhRecbto ? `Data ${new Date(result.dhRecbto).toLocaleString('pt-BR')}` : null,
            ].filter(Boolean);

            toast({
                title: 'Consulta SEFAZ concluída',
                description: parts.join(' | '),
            });

            if (result.status !== 'processing') {
                onInvoiceCancelled();
            }
        } catch (error: any) {
            console.error('[Verify SEFAZ] Error:', error);
            toast({
                title: 'Erro ao consultar SEFAZ',
                description: error?.message || 'Falha ao consultar situação da NF-e.',
                variant: 'destructive',
            });
        } finally {
            setVerifyingId(null);
        }
    };

    const handleDownload = async (nfeId: string) => {
        setDownloadingId(nfeId);
        try {
            const result = await downloadNfeXml(nfeId);

            if (result.inlineXml) {
                const xmlBlob = new Blob([result.inlineXml], { type: 'application/xml;charset=utf-8' });
                const blobUrl = window.URL.createObjectURL(xmlBlob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = result.filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
                return;
            }

            // Get signed URL from Supabase Storage
            const supabase = createClient();
            const { data: signedUrl } = await supabase.storage
                .from('company-assets')
                .createSignedUrl(result.path, 60);

            if (!signedUrl?.signedUrl) {
                throw new Error('Falha ao gerar URL de download');
            }

            // Fetch the file content as blob to force download
            const response = await fetch(signedUrl.signedUrl);
            if (!response.ok) {
                throw new Error('Falha ao buscar arquivo');
            }

            const blob = await response.blob();

            // Create blob URL and trigger download
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = result.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);

        } catch (error: any) {
            console.error('Download error:', error);
            toast({
                title: 'Erro ao baixar XML',
                description: error?.message || 'Falha ao baixar XML da NF-e.',
                variant: 'destructive',
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadCorrectionLetterXml = async (nfeId: string) => {
        setDownloadingId(nfeId);
        try {
            const artifact = await fetchCorrectionLetterArtifact(nfeId);
            const blob = new Blob([artifact.xml], { type: 'application/xml;charset=utf-8' });
            const blobUrl = window.URL.createObjectURL(blob);
            const filename = `CCe-${artifact.accessKey}-seq-${String(artifact.sequence || 1).padStart(2, '0')}.xml`;
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (error: any) {
            console.error('CC-e Download error:', error);
            toast({
                title: 'Erro ao baixar XML da CC-e',
                description: error?.message || 'Falha ao baixar XML da carta de correção.',
                variant: 'destructive',
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePrintAll = async (nfeId: string) => {
        await handlePrintDanfe(nfeId);
        await handlePrintCorrectionLetter(nfeId);
    };

    const handleDownloadAllXml = async (nfeId: string) => {
        await handleDownload(nfeId);
        await handleDownloadCorrectionLetterXml(nfeId);
    };

    const toggleSelect = (nfeId: string, checked: boolean) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (checked) next.add(nfeId);
            else next.delete(nfeId);
            return next;
        });
    };

    const toggleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(data.map((nfe) => nfe.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleBatchDownload = async (bundle: 'xml' | 'danfe') => {
        if (selectedIds.size === 0) return;
        if (bundle === 'xml') setIsBatchDownloadingXml(true);
        else setIsBatchDownloadingDanfe(true);
        try {
            const response = await fetch('/api/fiscal/nfe/batch-zip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds), bundle }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.error || 'Falha ao gerar ZIP do lote.');
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${bundle === 'xml' ? 'xml' : 'danfe'}_lote_${new Date().toISOString().slice(0, 10)}.zip`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (error: any) {
            console.error('[Batch ZIP] error:', error);
            toast({
                title: `Falha ao baixar ${bundle === 'xml' ? 'XML' : 'DANFE'}`,
                description: error?.message || 'Não foi possível baixar os arquivos selecionados.',
                variant: 'destructive',
            });
        } finally {
            if (bundle === 'xml') setIsBatchDownloadingXml(false);
            else setIsBatchDownloadingDanfe(false);
        }
    };

    const handleBatchPrintDanfe = async () => {
        if (selectedIds.size === 0) return;
        setIsBatchPrinting(true);
        try {
            const ids = Array.from(selectedIds);
            for (const id of ids) {
                const response = await fetch('/api/fiscal/nfe/danfe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id }),
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err?.details || err?.error || `Falha ao gerar DANFE da NF-e ${id}.`);
                }

                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const printWindow = window.open(blobUrl, '_blank');
                if (!printWindow) {
                    window.URL.revokeObjectURL(blobUrl);
                    throw new Error('O navegador bloqueou a abertura da DANFE para impressão.');
                }

                setTimeout(() => {
                    try {
                        printWindow.focus();
                        printWindow.print();
                    } catch {
                        // noop
                    }
                }, 300);
            }
        } catch (error: any) {
            console.error('[Batch Print DANFE] error:', error);
            toast({
                title: 'Falha ao imprimir DANFE',
                description: error?.message || 'Não foi possível abrir as DANFEs selecionadas para impressão.',
                variant: 'destructive',
            });
        } finally {
            setIsBatchPrinting(false);
        }
    };

    const openCancellationModal = (nfe: any) => {
        setSelectedCancellationNfe(nfe);
        setCancellationReason('');
        setCancellationModalOpen(true);
    };

    const handleCancel = async () => {
        if (!selectedCancellationNfe?.id) return;

        const normalized = cancellationReason.trim();
        if (normalized.length < 15) {
            toast({
                title: 'Motivo inválido',
                description: 'O motivo do cancelamento deve ter no mínimo 15 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        if (normalized.length > 255) {
            toast({
                title: 'Motivo inválido',
                description: 'O motivo do cancelamento deve ter no máximo 255 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        setCancellingId(selectedCancellationNfe.id);
        setSubmittingCancellationId(selectedCancellationNfe.id);
        try {
            const response = await fetch('/api/fiscal/nfe/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emissionId: selectedCancellationNfe.id,
                    accessKey: selectedCancellationNfe.nfe_key || null,
                    salesDocumentId: selectedCancellationNfe?.document?.id || null,
                    nfeNumber: selectedCancellationNfe?.nfe_number || null,
                    nfeSeries: selectedCancellationNfe?.nfe_series || null,
                    reason: normalized,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error || 'Falha ao enfileirar cancelamento da NF-e.');
            }

            window.dispatchEvent(new CustomEvent('nfe-cancel-feedback', {
                detail: {
                    type: 'queued',
                    sequence: result.sequence,
                    orderNumber: selectedCancellationNfe?.document?.document_number || null,
                }
            }));

            setCancellationModalOpen(false);
            setSelectedCancellationNfe(null);
            setCancellationReason('');
            onInvoiceCancelled();
        } catch (error: any) {
            console.error('[NFE Cancel] enqueue error:', error);
            const message = error?.message || 'Falha ao enfileirar cancelamento da NF-e.';
            const normalizedMessage = String(message).toLowerCase();
            const isAlreadyCancelled =
                normalizedMessage.includes('já está cancelada') ||
                normalizedMessage.includes('ja esta cancelada') ||
                normalizedMessage.includes('já cancelada') ||
                normalizedMessage.includes('ja cancelada');

            if (isAlreadyCancelled) {
                setCancellationModalOpen(false);
                setSelectedCancellationNfe(null);
                setCancellationReason('');
                onInvoiceCancelled();
            }

            window.dispatchEvent(new CustomEvent('nfe-cancel-feedback', {
                detail: {
                    type: isAlreadyCancelled ? 'already_cancelled' : 'enqueue_error',
                    message,
                    orderNumber: selectedCancellationNfe?.document?.document_number || null,
                }
            }));
        } finally {
            setCancellingId(null);
            setSubmittingCancellationId(null);
        }
    };

    const openCorrectionModal = (nfe: any) => {
        setSelectedCorrectionNfe(nfe);
        setCorrectionText('');
        setCorrectionModalOpen(true);
    };

    const handleSubmitCorrection = async () => {
        if (!selectedCorrectionNfe?.id) return;

        const normalized = correctionText.trim();
        if (normalized.length < 15) {
            toast({
                title: 'Descrição inválida',
                description: 'A descrição da carta de correção deve ter no mínimo 15 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        if (normalized.length > 1000) {
            toast({
                title: 'Descrição inválida',
                description: 'A descrição da carta de correção deve ter no máximo 1000 caracteres.',
                variant: 'destructive',
            });
            return;
        }

        setSubmittingCorrectionId(selectedCorrectionNfe.id);
        try {
            const response = await fetch('/api/fiscal/nfe/correction-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emissionId: selectedCorrectionNfe.id,
                    accessKey: selectedCorrectionNfe.nfe_key || null,
                    salesDocumentId: selectedCorrectionNfe?.document?.id || null,
                    nfeNumber: selectedCorrectionNfe?.nfe_number || null,
                    nfeSeries: selectedCorrectionNfe?.nfe_series || null,
                    correctionText: normalized,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error || 'Falha ao enfileirar carta de correção.');
            }

            window.dispatchEvent(new CustomEvent('nfe-cce-feedback', {
                detail: {
                    type: 'queued',
                    sequence: result.sequence,
                    orderNumber: selectedCorrectionNfe?.document?.document_number || null,
                }
            }));

            setCorrectionModalOpen(false);
            setSelectedCorrectionNfe(null);
            setCorrectionText('');
        } catch (error: any) {
            console.error('[CC-e] enqueue error:', error);
            window.dispatchEvent(new CustomEvent('nfe-cce-feedback', {
                detail: {
                    type: 'enqueue_error',
                    message: error?.message || 'Falha ao enfileirar carta de correção.',
                    orderNumber: selectedCorrectionNfe?.document?.document_number || null,
                }
            }));
        } finally {
            setSubmittingCorrectionId(null);
        }
    };

    if (isLoading) {
        return <div className="text-center py-12">Carregando...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {emptyState?.title || 'Nenhuma NF-e emitida'}
                </h3>
                <p className="text-gray-500">
                    {emptyState?.description || 'Ainda não há notas fiscais emitidas no período.'}
                </p>
            </div>
        );
    }

    const allSelected = data.length > 0 && selectedIds.size === data.length;
    const someSelected = selectedIds.size > 0;
    const isIndeterminate = someSelected && !allSelected;
    const hasBatchActionLoading = isBatchDownloadingXml || isBatchDownloadingDanfe || isBatchPrinting;
    return (
        <>
            {someSelected && (
                <div className="mb-4 p-4 bg-brand-50 border border-brand-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-100 text-brand-700 px-3 py-1 rounded-2xl text-sm font-semibold">
                            {selectedIds.size} {selectedIds.size === 1 ? 'NF-e selecionada' : 'NF-es selecionadas'}
                        </div>

                        <div className="h-4 w-px bg-brand-200 mx-1" />

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBatchDownload('xml')}
                            disabled={hasBatchActionLoading}
                            className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                        >
                            {isBatchDownloadingXml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            {isBatchDownloadingXml ? 'Baixando XML...' : 'Baixar XML'}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBatchDownload('danfe')}
                            disabled={hasBatchActionLoading}
                            className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                        >
                            {isBatchDownloadingDanfe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            {isBatchDownloadingDanfe ? 'Baixando DANFE...' : 'Baixar DANFE'}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchPrintDanfe}
                            disabled={hasBatchActionLoading}
                            className="bg-white border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800 h-8 font-medium gap-2"
                        >
                            {isBatchPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                            {isBatchPrinting ? 'Abrindo DANFEs...' : 'Imprimir DANFE'}
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        disabled={hasBatchActionLoading}
                        className="text-brand-700 hover:text-brand-800 hover:bg-brand-100"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Limpar seleção
                    </Button>
                </div>
            )}
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            <th className="px-4 py-3 text-center">
                                <Checkbox
                                    checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Selecionar todas as NF-e"
                                />
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Nº NF-e
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Data Emissão
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cliente
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pedido
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Ações
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((nfe) => (
                            <tr
                                key={nfe.id}
                                className={`transition-colors ${selectedIds.has(nfe.id) ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-gray-50'}`}
                            >
                                <td className="px-4 py-4 text-center">
                                    <Checkbox
                                        checked={selectedIds.has(nfe.id)}
                                        onCheckedChange={(checked) => toggleSelect(nfe.id, checked)}
                                        aria-label={`Selecionar NF-e ${nfe.nfe_number || nfe.id}`}
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-medium text-gray-900">
                                        {nfe.nfe_number}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">
                                        Série {nfe.nfe_series}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-gray-900">
                                        {new Date(nfe.issued_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-gray-900">
                                        {nfe.document?.client?.trade_name || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-gray-500">
                                        #{nfe.document?.document_number || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <span className="text-sm font-medium text-gray-900">
                                        {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                        }).format(nfe.document?.total_amount || 0)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <span
                                        className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${nfe.status === 'authorized'
                                            ? 'bg-green-100 text-green-800'
                                            : nfe.status === 'cancelled'
                                                ? 'bg-red-100 text-red-800'
                                                : nfe.status === 'processing'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                    >
                                        {nfe.status === 'authorized'
                                            ? 'Autorizada'
                                            : nfe.status === 'cancelled'
                                                ? 'Cancelada'
                                                : nfe.status === 'processing'
                                                    ? 'Processando'
                                                    : nfe.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                                    {/* Sync Button for Processing Status */}
                                    {nfe.status === 'processing' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0 rounded-full border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
                                            onClick={() => handleVerifySefaz(nfe)}
                                            disabled={verifyingId === nfe.id}
                                            title="Sincronizar com SEFAZ"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${verifyingId === nfe.id ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}

                                    {/* Print actions - Only for Authorized or Issued */}
                                    {(nfe.status === 'authorized' || nfe.status === 'issued') && (
                                        <>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 rounded-full border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                                                        disabled={printingId === nfe.id}
                                                        title="Imprimir"
                                                    >
                                                        <Printer className={`w-4 h-4 ${printingId === nfe.id ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handlePrintDanfe(nfe.id)}>
                                                        Imprimir DANFE
                                                    </DropdownMenuItem>
                                                    {nfe.has_correction_letter && (
                                                        <DropdownMenuItem onSelect={() => handlePrintCorrectionLetter(nfe.id)}>
                                                            Imprimir Carta de Correção
                                                        </DropdownMenuItem>
                                                    )}
                                                    {nfe.has_correction_letter && (
                                                        <DropdownMenuItem onSelect={() => handlePrintAll(nfe.id)}>
                                                            Imprimir Tudo
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 rounded-full border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-sm"
                                                        disabled={downloadingId === nfe.id}
                                                        title="Baixar XML"
                                                    >
                                                        <Download className={`w-4 h-4 ${downloadingId === nfe.id ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onSelect={() => handleDownload(nfe.id)}>
                                                        Baixar XML da NF-e
                                                    </DropdownMenuItem>
                                                    {nfe.has_correction_letter && (
                                                        <DropdownMenuItem onSelect={() => handleDownloadCorrectionLetterXml(nfe.id)}>
                                                            Baixar XML da Carta de Correção
                                                        </DropdownMenuItem>
                                                    )}
                                                    {nfe.has_correction_letter && (
                                                        <DropdownMenuItem onSelect={() => handleDownloadAllXml(nfe.id)}>
                                                            Baixar Tudo (XML)
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </>
                                    )}

                                    {/* General Actions Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 text-gray-500"
                                            >
                                                <MoreHorizontal className="w-5 h-5" />
                                                <span className="sr-only">Abrir menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onSelect={() => handleVerifySefaz(nfe)}
                                                disabled={verifyingId === nfe.id}
                                            >
                                                <RefreshCw className={`mr-2 h-4 w-4 ${verifyingId === nfe.id ? 'animate-spin' : ''}`} />
                                                <span>Consultar SEFAZ</span>
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onSelect={() => openCorrectionModal(nfe)}
                                                disabled={nfe.status !== 'authorized'}
                                            >
                                                <FilePenLine className="mr-2 h-4 w-4" />
                                                <span>Carta de Correção</span>
                                            </DropdownMenuItem>

                                            <DropdownMenuItem
                                                onSelect={() => openCancellationModal(nfe)}
                                                disabled={!(nfe.status === 'authorized' || nfe.status === 'processing')}
                                                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                            >
                                                <XCircle className="mr-2 h-4 w-4" />
                                                <span>Cancelar NF-e</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ListPagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onPageChange={pagination.onPageChange}
                label="notas"
                disabled={isLoading}
            />

            <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
                <DialogContent className="sm:max-w-[680px]">
                    <DialogHeader className="space-y-2">
                        <DialogTitle>Carta de Correção Eletrônica (CC-e)</DialogTitle>
                        <DialogDescription>
                            Envie uma correção formal para a NF-e sem cancelar a nota.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">Regras da CC-e (SEFAZ)</p>
                        <ul className="mt-2 list-disc pl-5 space-y-1">
                            <li>Use para corrigir informações que não alterem valores, impostos ou dados essenciais da NF-e.</li>
                            <li>Não pode corrigir CNPJ/CPF do destinatário, data de emissão/saída, nem campos que mudem cálculo tributário.</li>
                            <li>Descrição com mínimo de 15 e máximo de 1000 caracteres.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="cce-description" className="text-sm font-medium text-gray-700">
                            Descrição da Correção
                        </label>
                        <Textarea
                            id="cce-description"
                            value={correctionText}
                            onChange={(event) => setCorrectionText(event.target.value)}
                            placeholder="Descreva objetivamente a correção solicitada..."
                            rows={6}
                            maxLength={1000}
                        />
                        <p className="text-xs text-gray-500 text-right">
                            {correctionText.trim().length}/1000
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCorrectionModalOpen(false)}
                            disabled={!!submittingCorrectionId}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmitCorrection}
                            disabled={!!submittingCorrectionId || correctionText.trim().length < 15}
                        >
                            {submittingCorrectionId ? 'Enviando...' : 'Enviar CC-e'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancellationModalOpen} onOpenChange={setCancellationModalOpen}>
                <DialogContent className="sm:max-w-[680px]">
                    <DialogHeader className="space-y-2">
                        <DialogTitle>Cancelar NF-e</DialogTitle>
                        <DialogDescription>
                            Solicite o cancelamento da nota fiscal na SEFAZ com justificativa obrigatória.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                        <p className="font-semibold">Regras do cancelamento</p>
                        <ul className="mt-2 list-disc pl-5 space-y-1">
                            <li>Somente NF-e autorizada pode ser cancelada.</li>
                            <li>A justificativa deve ter entre 15 e 255 caracteres.</li>
                            <li>Após autorizado, o status fiscal do pedido será atualizado para cancelado.</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="nfe-cancel-reason" className="text-sm font-medium text-gray-700">
                            Motivo do Cancelamento
                        </label>
                        <Textarea
                            id="nfe-cancel-reason"
                            value={cancellationReason}
                            onChange={(event) => setCancellationReason(event.target.value)}
                            placeholder="Descreva o motivo do cancelamento da NF-e..."
                            rows={5}
                            maxLength={255}
                        />
                        <p className="text-xs text-gray-500 text-right">
                            {cancellationReason.trim().length}/255
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCancellationModalOpen(false)}
                            disabled={!!submittingCancellationId}
                        >
                            Voltar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleCancel}
                            disabled={!!submittingCancellationId || cancellationReason.trim().length < 15}
                        >
                            {submittingCancellationId ? 'Enviando...' : 'Confirmar Cancelamento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
