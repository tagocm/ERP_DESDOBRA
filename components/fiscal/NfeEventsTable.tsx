'use client';

import { useState } from 'react';
import { Download, FilePenLine, FileText, Loader2, Receipt, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/use-toast';
import { ListPagination } from '@/components/ui/ListPagination';

type NfeEventType = 'cancellation' | 'correction_letter';

interface NfeEventRow {
    id: string;
    type: NfeEventType;
    accessKey: string | null;
    nfeNumber: number | null;
    nfeSeries: number | null;
    sequence: number | null;
    status: string;
    cStat: string | null;
    xMotivo: string | null;
    occurredAt: string;
    document: {
        id: string;
        document_number: number | null;
        total_amount: number | null;
        client: {
            trade_name: string | null;
            document_number: string | null;
        } | null;
    } | null;
}

interface Props {
    data: NfeEventRow[];
    isLoading: boolean;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
    };
}

function extractApiErrorMessage(payload: any, fallback: string): string {
    if (typeof payload === 'string' && payload.trim()) return payload;
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message;
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
    if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message;
    if (typeof payload?.details === 'string' && payload.details.trim()) return payload.details;
    if (typeof payload?.error?.details === 'string' && payload.error.details.trim()) return payload.error.details;
    return fallback;
}

function getStatusLabel(status: string): string {
    if (status === 'authorized') return 'Autorizado';
    if (status === 'pending') return 'Na fila';
    if (status === 'processing') return 'Processando';
    if (status === 'rejected') return 'Rejeitado';
    if (status === 'failed') return 'Falhou';
    return status;
}

function getStatusClassName(status: string): string {
    if (status === 'authorized') return 'bg-green-100 text-green-700';
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'processing') return 'bg-blue-100 text-blue-700';
    if (status === 'rejected' || status === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
}

function getTypeLabel(type: NfeEventType): string {
    return type === 'cancellation' ? 'Cancelamento' : 'Carta de correção';
}

function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
}

function buildXmlFileName(event: NfeEventRow): string {
    const sequence = String(event.sequence || 1).padStart(2, '0');
    const accessKey = event.accessKey || 'sem-chave';
    if (event.type === 'cancellation') {
        return `CancNFe-${accessKey}-seq-${sequence}.xml`;
    }
    return `CCe-${accessKey}-seq-${sequence}.xml`;
}

function buildPdfFileName(event: NfeEventRow): string {
    const sequence = String(event.sequence || 1).padStart(2, '0');
    const nfeNumber = String(event.nfeNumber || 'sem-numero');
    if (event.type === 'cancellation') {
        return `cancelamento_nfe_${nfeNumber}_seq_${sequence}.pdf`;
    }
    return `cce_nfe_${nfeNumber}_seq_${sequence}.pdf`;
}

function extractFileNameFromDisposition(disposition: string | null | undefined): string | null {
    if (!disposition) return null;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1].trim().replace(/^"(.*)"$/, '$1'));
    }
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) {
        return plainMatch[1].trim();
    }
    return null;
}

export function NfeEventsTable({ data, isLoading, pagination }: Props) {
    const { toast } = useToast();
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

    const handleDownloadEventXml = async (event: NfeEventRow) => {
        setDownloadingId(event.id);
        try {
            const response = await fetch('/api/fiscal/nfe/events/artifact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: event.type,
                    id: event.id,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.success || !payload?.data?.xml) {
                throw new Error(extractApiErrorMessage(payload, 'XML do evento não disponível para download.'));
            }

            const xml = String(payload.data.xml || '');
            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = buildXmlFileName(event);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (error: any) {
            toast({
                title: 'Falha ao baixar XML do evento',
                description: error?.message || 'Não foi possível baixar o XML deste evento.',
                variant: 'destructive',
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDownloadEventPdf = async (event: NfeEventRow) => {
        setDownloadingPdfId(event.id);
        try {
            const response = await fetch('/api/fiscal/nfe/events/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: event.type,
                    id: event.id,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(extractApiErrorMessage(payload, 'PDF do evento não disponível para download.'));
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = extractFileNameFromDisposition(response.headers.get('content-disposition')) || buildPdfFileName(event);
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (error: any) {
            toast({
                title: 'Falha ao baixar PDF do evento',
                description: error?.message || 'Não foi possível baixar o PDF deste evento.',
                variant: 'destructive',
            });
        } finally {
            setDownloadingPdfId(null);
        }
    };

    if (isLoading) {
        return <div className="text-center py-12">Carregando...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum evento encontrado</h3>
                <p className="text-gray-500">Ainda não há eventos de cancelamento ou cartas de correção no período.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NF-e</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seq.</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Evento</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retorno</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((event) => {
                            const canDownload = event.status !== 'pending' && event.status !== 'processing';
                            return (
                                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            {event.type === 'cancellation' ? (
                                                <XCircle className="w-4 h-4 text-red-600" />
                                            ) : (
                                                <FilePenLine className="w-4 h-4 text-amber-600" />
                                            )}
                                            <span className="text-sm text-gray-900">{getTypeLabel(event.type)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {event.nfeNumber ? `#${event.nfeNumber}` : '-'}
                                        {event.nfeSeries ? <span className="text-gray-500 ml-2">Série {event.nfeSeries}</span> : null}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {event.document?.client?.trade_name || '-'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700">
                                        {event.document?.document_number ? `#${event.document.document_number}` : '-'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700">
                                        {event.sequence ? `#${event.sequence}` : '-'}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700">
                                        {formatDateTime(event.occurredAt)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusClassName(event.status)}`}>
                                            {getStatusLabel(event.status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-700">
                                        {event.cStat ? `cStat ${event.cStat}` : ''}
                                        {event.cStat && event.xMotivo ? ' - ' : ''}
                                        {event.xMotivo || '-'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-8 p-0 rounded-full border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-card"
                                                onClick={() => handleDownloadEventXml(event)}
                                                disabled={downloadingId === event.id || !canDownload}
                                                title={canDownload ? 'Baixar XML do evento' : 'XML disponível após processamento do evento'}
                                            >
                                                {downloadingId === event.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-8 p-0 rounded-full border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all shadow-card"
                                                onClick={() => handleDownloadEventPdf(event)}
                                                disabled={downloadingPdfId === event.id || !canDownload}
                                                title={canDownload ? 'Baixar PDF do evento' : 'PDF disponível após processamento do evento'}
                                            >
                                                {downloadingPdfId === event.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                                                ) : (
                                                    <FileText className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ListPagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onPageChange={pagination.onPageChange}
                label="eventos"
            />
        </div>
    );
}
