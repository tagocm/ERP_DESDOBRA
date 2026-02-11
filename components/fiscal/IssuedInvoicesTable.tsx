'use client';

import React, { useEffect, useState } from 'react';
import { Receipt, Download, XCircle, RefreshCw, Printer, CheckCircle2, FilePenLine, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadNfeXml } from '@/lib/fiscal/nfe-actions';
import { createClient } from '@/utils/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/Checkbox';
import { ListPagination } from '@/components/ui/ListPagination';

interface Props {
    data: any[];
    companyId: string;
    isLoading: boolean;
    onInvoiceCancelled: () => void;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
    };
}

export function IssuedInvoicesTable({ data, companyId, isLoading, onInvoiceCancelled, pagination }: Props) {
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
        if (typeof details === 'string' && details.trim()) return details;
        if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
        if (typeof details?.details === 'string' && details.details.trim()) return details.details;
        if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
        return 'Erro ao gerar DANFE';
    };

    const handleSync = async (nfeId: string, accessKey: string) => {
        if (!accessKey) {
            alert('Chave de acesso não encontrada');
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

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao consultar status');
            }

            if (result.success) {
                alert(`NF-e atualizada: ${result.status} - ${result.xMotivo}`);
                onInvoiceCancelled(); // Refresh list
            } else {
                alert(`Consulta realizada: ${result.xMotivo}`);
                if (result.status !== 'processing') {
                    onInvoiceCancelled(); // Refresh list if status changed
                }
            }

        } catch (error: any) {
            console.error('Sync error:', error);
            alert(error.message || 'Erro ao sincronizar NF-e');
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
            alert(`Erro ao gerar DANFE: ${error.message}\n\nVerifique o console (F12) para mais detalhes.`);
        } finally {
            setPrintingId(null);
        }
    };

    const handleVerifySefaz = async (nfeId: string) => {
        setVerifyingId(nfeId);
        try {
            const response = await fetch('/api/fiscal/nfe/consulta-situacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: nfeId })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.details || result.error || 'Erro ao consultar SEFAZ');
            }

            // Show result
            alert(
                `Consulta SEFAZ:\n\n` +
                `Status: ${result.cStat} - ${result.xMotivo}\n` +
                (result.nProt ? `Protocolo: ${result.nProt}\n` : '') +
                (result.dhRecbto ? `Data: ${new Date(result.dhRecbto).toLocaleString('pt-BR')}` : '')
            );

            // Refresh if status changed
            if (result.success) {
                window.location.reload();
            }
        } catch (error: any) {
            console.error('[Verify SEFAZ] Error:', error);
            alert(`Erro ao consultar SEFAZ: ${error.message}`);
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
            alert(error.message || 'Erro ao fazer download do XML');
        } finally {
            setDownloadingId(null);
        }
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
            window.dispatchEvent(new CustomEvent('nfe-cancel-feedback', {
                detail: {
                    type: 'enqueue_error',
                    message: error?.message || 'Falha ao enfileirar cancelamento da NF-e.',
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
                    Nenhuma NF-e emitida
                </h3>
                <p className="text-gray-500">
                    Ainda não há notas fiscais emitidas no período.
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
                                        className="text-blue-600 hover:text-blue-700"
                                        onClick={() => handleSync(nfe.id, nfe.nfe_key)}
                                        disabled={syncingId === nfe.id}
                                        title="Atualizar Status na SEFAZ"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${syncingId === nfe.id ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}

                                {/* Print DANFE - Only for Authorized or Issued */}
                                {(nfe.status === 'authorized' || nfe.status === 'issued') && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePrintDanfe(nfe.id)}
                                        disabled={printingId === nfe.id}
                                        title="Imprimir DANFE (PDF)"
                                    >
                                        <Printer className={`w-4 h-4 ${printingId === nfe.id ? 'animate-spin' : ''}`} />
                                    </Button>
                                )}

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownload(nfe.id)}
                                    disabled={downloadingId === nfe.id || !nfe.nfe_key}
                                    title="Baixar XML"
                                >
                                    <Download className="w-4 h-4" />
                                </Button>

                                {/* Verify on SEFAZ - For authorized notes */}
                                    {nfe.status === 'authorized' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-blue-600 hover:text-blue-700"
                                            onClick={() => handleVerifySefaz(nfe.id)}
                                            disabled={verifyingId === nfe.id}
                                            title="Verificar na SEFAZ"
                                        >
                                            <CheckCircle2 className={`w-4 h-4 ${verifyingId === nfe.id ? 'animate-spin' : ''}`} />
                                        </Button>
                                    )}

                                    {nfe.status === 'authorized' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-amber-700 hover:text-amber-800"
                                            onClick={() => openCorrectionModal(nfe)}
                                            disabled={submittingCorrectionId === nfe.id}
                                            title="Carta de Correção (CC-e)"
                                        >
                                            <FilePenLine className={`w-4 h-4 ${submittingCorrectionId === nfe.id ? 'animate-pulse' : ''}`} />
                                        </Button>
                                    )}

                                    {nfe.status === 'authorized' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openCancellationModal(nfe)}
                                            disabled={cancellingId === nfe.id}
                                            title="Cancelar NF-e"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </Button>
                                    )}
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
