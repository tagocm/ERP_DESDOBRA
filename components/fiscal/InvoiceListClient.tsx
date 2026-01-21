'use client';

import { useState, useEffect } from 'react';
import { fetchPendingInvoices, fetchIssuedInvoices, PendingInvoice } from '@/lib/fiscal/nfe-actions';
import { InvoiceFilters } from '@/components/fiscal/InvoiceFilters';
import { PendingInvoicesTable } from '@/components/fiscal/PendingInvoicesTable';
import { IssuedInvoicesTable } from '@/components/fiscal/IssuedInvoicesTable';
import { Button } from '@/components/ui/Button';
import { FileText, Receipt } from 'lucide-react';

interface Props {
    companyId: string;
    initialView?: 'pending' | 'issued';
    initialFilters?: {
        dateFrom?: string;
        dateTo?: string;
        clientSearch?: string;
    };
}

export function InvoiceListClient({ companyId, initialView = 'pending', initialFilters }: Props) {
    const [view, setView] = useState<'pending' | 'issued'>(initialView);
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
    const [issuedInvoices, setIssuedInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState(initialFilters || {});

    useEffect(() => {
        loadData();
    }, [view, filters]);

    async function loadData() {
        setIsLoading(true);
        try {
            if (view === 'pending') {
                const data = await fetchPendingInvoices(companyId, {
                    startDate: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                    endDate: filters.dateTo ? new Date(filters.dateTo) : undefined,
                });
                setPendingInvoices(data);
            } else {
                const data = await fetchIssuedInvoices(companyId, {
                    startDate: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
                    endDate: filters.dateTo ? new Date(filters.dateTo) : undefined,
                });
                setIssuedInvoices(data);
            }
        } catch (error) {
            console.error('Error loading invoices:', error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex gap-2 border-b border-gray-200">
                <button
                    onClick={() => setView('pending')}
                    className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${view === 'pending'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <FileText className="w-4 h-4 inline-block mr-2" />
                    Pedidos Pendentes
                    {pendingInvoices.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            {pendingInvoices.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setView('issued')}
                    className={`px-4 py-2 -mb-px border-b-2 font-medium text-sm transition-colors ${view === 'issued'
                        ? 'border-green-600 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                >
                    <Receipt className="w-4 h-4 inline-block mr-2" />
                    NF-e Emitidas
                </button>
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
                    />
                ) : (
                    <IssuedInvoicesTable
                        data={issuedInvoices}
                        companyId={companyId}
                        isLoading={isLoading}
                        onInvoiceCancelled={loadData}
                    />
                )}
            </div>
        </div>
    );
}
