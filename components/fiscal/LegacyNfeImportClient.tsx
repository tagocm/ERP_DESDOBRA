'use client';

import React from 'react';
import Link from 'next/link';
import { UploadCloud, FileCode2, Loader2, CheckCircle2, AlertCircle, Files } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useToast } from '@/components/ui/use-toast';

type QueueStatus = 'pending' | 'uploading' | 'success' | 'duplicate' | 'error';

type QueueItem = {
    id: string;
    file: File;
    name: string;
    size: number;
    status: QueueStatus;
    message: string | null;
    accessKey: string | null;
};

type ImportSummary = {
    imported: number;
    duplicated: number;
    errors: number;
};

const LegacyImportApiResultSchema = z.object({
    fileName: z.string(),
    fileSize: z.number(),
    result: z.enum(['SUCCESS', 'DUPLICATE', 'ERROR']),
    message: z.string(),
    accessKey: z.string().nullable(),
});

const LegacyImportApiSuccessSchema = z.object({
    success: z.literal(true),
    imported: z.number().int().nonnegative(),
    duplicated: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
    results: z.array(LegacyImportApiResultSchema),
});

const LegacyImportApiErrorSchema = z.object({
    error: z.string(),
});

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function LegacyNfeImportClient() {
    const { toast } = useToast();
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [isImporting, setIsImporting] = React.useState(false);
    const [queue, setQueue] = React.useState<QueueItem[]>([]);
    const [summary, setSummary] = React.useState<ImportSummary | null>(null);

    const addFiles = React.useCallback((fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;

        const nextItems: QueueItem[] = files.map((file) => ({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            size: file.size,
            status: file.name.toLowerCase().endsWith('.xml') ? 'pending' : 'error',
            message: file.name.toLowerCase().endsWith('.xml') ? null : 'Formato inválido. Envie somente arquivos .xml.',
            accessKey: null,
        }));

        setQueue((current) => [...current, ...nextItems]);
    }, []);

    const onDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        if (event.dataTransfer.files?.length) {
            addFiles(event.dataTransfer.files);
        }
    }, [addFiles]);

    const onPickFiles = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            addFiles(event.target.files);
            event.target.value = '';
        }
    }, [addFiles]);

    const importPendingFiles = React.useCallback(async () => {
        const pending = queue.filter((item) => item.status === 'pending' || item.status === 'error');
        const filesToImport = pending.filter((item) => item.file.name.toLowerCase().endsWith('.xml'));

        if (filesToImport.length === 0) {
            toast({
                title: 'Nenhum XML na fila',
                description: 'Adicione ao menos um arquivo XML válido para importar.',
                variant: 'destructive',
            });
            return;
        }

        setIsImporting(true);
        setSummary(null);
        setQueue((current) =>
            current.map((item) =>
                filesToImport.some((candidate) => candidate.id === item.id)
                    ? { ...item, status: 'uploading', message: null }
                    : item,
            ),
        );

        try {
            const formData = new FormData();
            filesToImport.forEach((item) => formData.append('files', item.file));

            const response = await fetch('/api/fiscal/nfe/legacy-import', {
                method: 'POST',
                body: formData,
            });

            const payloadUnknown: unknown = await response.json().catch(() => ({}));
            if (!response.ok) {
                const payload = LegacyImportApiErrorSchema.safeParse(payloadUnknown);
                const message = payload.success ? payload.data.error : 'Falha ao importar XML legado.';
                throw new Error(message);
            }

            const payload = LegacyImportApiSuccessSchema.parse(payloadUnknown);

            setSummary({
                imported: payload.imported,
                duplicated: payload.duplicated,
                errors: payload.errors,
            });

            setQueue((current) => {
                let resultIndex = 0;
                return current.map((item) => {
                    if (!filesToImport.some((candidate) => candidate.id === item.id)) {
                        return item;
                    }

                    const result = payload.results?.[resultIndex];
                    resultIndex += 1;

                    if (!result) {
                        return {
                            ...item,
                            status: 'error',
                            message: 'Retorno inválido da importação.',
                        };
                    }

                    const statusMap: Record<'SUCCESS' | 'DUPLICATE' | 'ERROR', QueueStatus> = {
                        SUCCESS: 'success',
                        DUPLICATE: 'duplicate',
                        ERROR: 'error',
                    };

                    return {
                        ...item,
                        status: statusMap[result.result],
                        message: result.message,
                        accessKey: result.accessKey,
                    };
                });
            });

            toast({
                title: 'Importação concluída',
                description: `${payload.imported} importadas, ${payload.duplicated} ignoradas e ${payload.errors} com erro.`,
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro ao importar XML legado.';
            toast({
                title: 'Erro na importação',
                description: message,
                variant: 'destructive',
            });
            setQueue((current) =>
                current.map((item) =>
                    item.status === 'uploading'
                        ? { ...item, status: 'error', message }
                        : item,
                ),
            );
        } finally {
            setIsImporting(false);
        }
    }, [queue, toast]);

    const hasQueue = queue.length > 0;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="border-b border-gray-100 px-6 py-4">
                    <CardTitle>Importar XML legado</CardTitle>
                    <CardDescription>Arraste arquivos XML de NF-e autorizadas do sistema antigo para incluir no ERP.</CardDescription>
                </CardHeader>

                <CardContent className="p-6">
                    <div
                        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                            isDragging ? 'border-brand-500 bg-brand-50/40' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                        }`}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(event) => {
                            event.preventDefault();
                            setIsDragging(false);
                        }}
                        onDrop={onDrop}
                    >
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                            <UploadCloud className="h-6 w-6" />
                        </div>
                        <p className="text-base font-semibold text-gray-900">
                            Arraste seus XMLs aqui
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                            Você pode enviar múltiplos arquivos <code>.xml</code>.
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xml,text/xml,application/xml"
                            multiple
                            className="hidden"
                            onChange={onPickFiles}
                        />
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => inputRef.current?.click()}
                                disabled={isImporting}
                            >
                                <Files className="mr-2 h-4 w-4" />
                                Selecionar arquivos
                            </Button>
                            <Button
                                type="button"
                                onClick={importPendingFiles}
                                disabled={isImporting}
                            >
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                                Importar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {hasQueue && (
                <Card>
                    <CardHeader className="border-b border-gray-100 px-6 py-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Fila de importação</h4>
                    </CardHeader>

                    <CardContent className="max-h-96 overflow-y-auto p-0">
                        {queue.map((item) => {
                            const statusColor =
                                item.status === 'success'
                                    ? 'text-green-700 bg-green-50'
                                    : item.status === 'duplicate'
                                        ? 'text-amber-700 bg-amber-50'
                                        : item.status === 'error'
                                            ? 'text-red-700 bg-red-50'
                                            : item.status === 'uploading'
                                                ? 'text-brand-700 bg-brand-50'
                                                : 'text-gray-700 bg-gray-100';

                            const statusLabel =
                                item.status === 'success'
                                    ? 'Importado'
                                    : item.status === 'duplicate'
                                        ? 'Duplicado'
                                        : item.status === 'error'
                                            ? 'Erro'
                                            : item.status === 'uploading'
                                                ? 'Enviando'
                                                : 'Pendente';

                            return (
                                <div key={item.id} className="border-b border-gray-100 px-6 py-4 last:border-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <FileCode2 className="h-4 w-4 text-gray-400" />
                                                <span className="truncate text-sm font-medium text-gray-900">{item.name}</span>
                                                <span className="text-xs text-gray-500">{formatFileSize(item.size)}</span>
                                            </div>
                                            {item.message && (
                                                <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                                            )}
                                            {item.accessKey && (
                                                <p className="mt-1 font-mono text-[11px] text-gray-500">Chave: {item.accessKey}</p>
                                            )}
                                        </div>
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusColor}`}>
                                            {item.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                            {item.status === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
                                            {item.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                            {statusLabel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {summary && (
                <div className="flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4">
                    <p className="text-sm font-medium text-brand-900">
                        {summary.imported} importadas • {summary.duplicated} ignoradas • {summary.errors} com erro
                    </p>
                    <Link href="/app/fiscal/nfe?view=issued">
                        <Button variant="secondary">Ver NF-es importadas</Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
