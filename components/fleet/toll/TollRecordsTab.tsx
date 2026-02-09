"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TollRecordsToolbar } from "./TollRecordsToolbar";
import { TollRecordsTable } from "./TollRecordsTable";
import { TollRecordModal } from "./TollRecordModal";
import { listTollRecordsAction } from "@/app/actions/toll-records-actions";
import { TollRecordRow, TollRecordListFilters, PaymentMethod } from "@/lib/types/toll-records";
import { Plus } from "lucide-react";

interface TollRecordsTabProps {
    vehicleId: string;
}

export function TollRecordsTab({ vehicleId }: TollRecordsTabProps) {
    const [records, setRecords] = useState<TollRecordRow[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<TollRecordRow | undefined>();
    const [loading, setLoading] = useState(true);

    // Filter states
    const [search, setSearch] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: TollRecordListFilters = {
                search: search || undefined,
                paymentMethod: (paymentMethod !== 'all' ? paymentMethod : undefined) as PaymentMethod | undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            };
            const result = await listTollRecordsAction(vehicleId, filters);
            if (result.ok) {
                setRecords(result.data);
            } else {
                console.error('Error loading toll records:', result.error.message);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error loading toll records:', error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, [vehicleId, search, paymentMethod, startDate, endDate]);

    const handleEdit = (record: TollRecordRow) => {
        setSelectedRecord(record);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedRecord(undefined);
    };

    const handleSuccess = () => {
        loadRecords();
    };

    return (
        <div className="space-y-6">
            {/* Header with Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Pedágios</h2>
                        <p className="text-sm text-gray-500">Histórico de pedágios e estacionamentos</p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Pedágio
                </Button>
            </div>

            {/* Toolbar */}
            <TollRecordsToolbar
                search={search}
                onSearchChange={setSearch}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
            />

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : (
                    <TollRecordsTable
                        records={records}
                        onEdit={handleEdit}
                        onDelete={handleSuccess}
                    />
                )}
            </div>

            {/* Modal */}
            <TollRecordModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                vehicleId={vehicleId}
                initialData={selectedRecord}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
