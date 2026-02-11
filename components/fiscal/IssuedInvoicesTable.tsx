'use client';

import React, { useState } from 'react';
import { Receipt, Download, XCircle, RefreshCw, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { downloadNfeXml } from '@/lib/fiscal/nfe-actions';
import { createClient } from '@/utils/supabase/client';

interface Props {
    data: any[];
    companyId: string;
    isLoading: boolean;
    onInvoiceCancelled: () => void;
}

export function IssuedInvoicesTable({ data, companyId, isLoading, onInvoiceCancelled }: Props) {
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

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

    const handleCancel = async (nfeId: string) => {
        const reason = window.prompt('Informe o motivo do cancelamento (mínimo 15 caracteres):');

        if (!reason) return;

        if (reason.length < 15) {
            alert('O motivo deve ter no mínimo 15 caracteres');
            return;
        }

        setCancellingId(nfeId);
        try {
            // TODO: Implement cancelInvoice server action
            alert('Função de cancelamento em desenvolvimento');
            // await cancelInvoice(nfeId, reason);
            // toast.success('NF-e cancelada com sucesso');
            // onInvoiceCancelled();
        } catch (error: any) {
            console.error('Cancel error:', error);
            alert(error.message || 'Erro ao cancelar NF-e');
        } finally {
            setCancellingId(null);
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

    return (
        <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
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
                        <tr key={nfe.id} className="hover:bg-gray-50">
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
                                        onClick={() => handleCancel(nfe.id)}
                                        disabled={cancellingId === nfe.id}
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
    );
}
