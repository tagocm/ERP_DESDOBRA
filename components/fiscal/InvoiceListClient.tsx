'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchPendingInvoices, fetchIssuedInvoices, fetchNfeEvents, PendingInvoice } from '@/lib/fiscal/nfe-actions';
import { InvoiceFilters } from '@/components/fiscal/InvoiceFilters';
import { PendingInvoicesTable } from '@/components/fiscal/PendingInvoicesTable';
import { IssuedInvoicesTable } from '@/components/fiscal/IssuedInvoicesTable';
import { NfeEventsTable } from '@/components/fiscal/NfeEventsTable';
import { FileText, Receipt, RefreshCw, XCircle, ListTree } from 'lucide-react';

type NfeListView = 'pending' | 'issued' | 'cancelled' | 'processing' | 'events';

interface Props {
    companyId: string;
    initialView?: NfeListView;
    pendingTabLabel?: string;
    pendingEmptyTitle?: string;
    pendingEmptyDescription?: string;
    initialFilters?: {
        dateFrom?: string;
        dateTo?: string;
        clientSearch?: string;
    };
}

export function InvoiceListClient({
    companyId,
    initialView = 'pending',
    pendingTabLabel = 'Pedidos Pendentes',
    pendingEmptyTitle = 'Nenhum pedido pendente',
    pendingEmptyDescription = 'Não há pedidos confirmados sem NF-e no momento.',
    initialFilters,
}: Props) {
    const ISSUED_PAGE_SIZE = 100;
    const EVENTS_PAGE_SIZE = 50;
    const [view, setView] = useState<NfeListView>(initialView);
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
    const [issuedInvoices, setIssuedInvoices] = useState<any[]>([]);
    const [eventsData, setEventsData] = useState<any[]>([]);
    const [issuedPage, setIssuedPage] = useState(1);
    const [issuedTotal, setIssuedTotal] = useState(0);
    const [eventsPage, setEventsPage] = useState(1);
    const [eventsTotal, setEventsTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState(initialFilters || {});

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (view === 'pending') {
                const data = await fetchPendingInvoices(companyId, {
                    startDate: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                    endDate: filters.dateTo ? new Date(filters.dateTo) : undefined,
                    clientSearch: filters.clientSearch,
                });
                setPendingInvoices(data);
            } else if (view === 'events') {
                const result = await fetchNfeEvents(companyId, {
                    startDate: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                    endDate: filters.dateTo ? new Date(filters.dateTo) : undefined,
                    clientSearch: filters.clientSearch,
                }, {
                    page: eventsPage,
                    pageSize: EVENTS_PAGE_SIZE,
                });
                setEventsData(result.data);
                setEventsTotal(result.total);
            } else {
                const status =
                    view === 'issued'
                        ? 'authorized'
                        : view === 'cancelled'
                            ? 'cancelled'
                            : 'processing';

                const result = await fetchIssuedInvoices(companyId, {
                    startDate: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                    endDate: filters.dateTo ? new Date(filters.dateTo) : undefined,
                    clientSearch: filters.clientSearch,
                    status,
                }, {
                    page: issuedPage,
                    pageSize: ISSUED_PAGE_SIZE,
                });
                setIssuedInvoices(result.data);
                setIssuedTotal(result.total);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        } finally {
            setIsLoading(false);
        }
    }, [view, filters, companyId, issuedPage, eventsPage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (view === 'pending') return;
        if (view === 'events') {
            setEventsPage(1);
            return;
        }
        setIssuedPage(1);
    }, [filters, view]);

    const tabClassName = (isActive: boolean, activeClassName: string) =>
        `px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${isActive
            ? activeClassName
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`;

    const issuedEmptyState = view === 'cancelled'
        ? {
            title: 'Nenhuma NF-e cancelada',
            description: 'Ainda não há notas fiscais canceladas no período.',
        }
        : view === 'processing'
            ? {
                title: 'Nenhuma NF-e em processamento',
                description: 'Ainda não há notas fiscais em processamento no período.',
            }
            : {
                title: 'Nenhuma NF-e emitida',
                description: 'Ainda não há notas fiscais emitidas no período.',
            };

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex flex-col gap-2 border-b border-gray-200 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setView('pending')}
                        className={tabClassName(view === 'pending', 'border-blue-600 text-blue-600')}
                    >
                        <FileText className="w-4 h-4 inline-block mr-2" />
                        {pendingTabLabel}
                        {pendingInvoices.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                {pendingInvoices.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setView('issued')}
                        className={tabClassName(view === 'issued', 'border-green-600 text-green-600')}
                    >
                        <Receipt className="w-4 h-4 inline-block mr-2" />
                        NF-e Emitidas
                    </button>
                    <button
                        onClick={() => setView('cancelled')}
                        className={tabClassName(view === 'cancelled', 'border-red-600 text-red-600')}
                    >
                        <XCircle className="w-4 h-4 inline-block mr-2" />
                        NF-e Canceladas
                    </button>
                    <button
                        onClick={() => setView('processing')}
                        className={tabClassName(view === 'processing', 'border-amber-600 text-amber-600')}
                    >
                        <RefreshCw className="w-4 h-4 inline-block mr-2" />
                        NF-e em processamento
                    </button>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={() => setView('events')}
                        className={tabClassName(view === 'events', 'border-indigo-600 text-indigo-600')}
                    >
                        <ListTree className="w-4 h-4 inline-block mr-2" />
                        Eventos
                    </button>
                </div>
            </div>

            {/* Filters */}
            <InvoiceFilters
                filters={filters}
                onFilterChange={setFilters}
                companyId={companyId}
            />

            {/* Content */}
            <div className="mt-6">
                {view === 'pending' ? (
                    <PendingInvoicesTable
                        data={pendingInvoices}
                        isLoading={isLoading}
                        onInvoiceIssued={loadData}
                        emptyTitle={pendingEmptyTitle}
                        emptyDescription={pendingEmptyDescription}
                    />
                ) : view === 'events' ? (
                    <NfeEventsTable
                        data={eventsData}
                        isLoading={isLoading}
                        pagination={{
                            page: eventsPage,
                            pageSize: EVENTS_PAGE_SIZE,
                            total: eventsTotal,
                            onPageChange: setEventsPage,
                        }}
                    />
                ) : (
                    <IssuedInvoicesTable
                        data={issuedInvoices}
                        companyId={companyId}
                        isLoading={isLoading}
                        onInvoiceCancelled={loadData}
                        emptyState={issuedEmptyState}
                        pagination={{
                            page: issuedPage,
                            pageSize: ISSUED_PAGE_SIZE,
                            total: issuedTotal,
                            onPageChange: setIssuedPage,
                        }}
                    />
                )}
            </div>
        </div>
    );
}
