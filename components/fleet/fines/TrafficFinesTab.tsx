"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TrafficFinesToolbar } from "./TrafficFinesToolbar";
import { TrafficFinesTable } from "./TrafficFinesTable";
import { TrafficFineModal } from "./TrafficFineModal";
import { listTrafficFinesAction } from "@/app/actions/traffic-fines-actions";
import { TrafficFineRow, TrafficFineListFilters } from "@/lib/types/traffic-fines";
import { Plus } from "lucide-react";

interface TrafficFinesTabProps {
    vehicleId: string;
}

export function TrafficFinesTab({ vehicleId }: TrafficFinesTabProps) {
    const [records, setRecords] = useState<TrafficFineRow[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<TrafficFineRow | undefined>();
    const [loading, setLoading] = useState(true);

    // Filter states
    const [search, setSearch] = useState('');
    const [deductedStatus, setDeductedStatus] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: TrafficFineListFilters = {
                search: search || undefined,
                deductedStatus: (deductedStatus !== 'all' ? deductedStatus : undefined) as TrafficFineListFilters['deductedStatus'],
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            };
            const result = await listTrafficFinesAction(vehicleId, filters);
            if (result.ok) {
                setRecords(result.data);
            } else {
                console.error('Error loading traffic fines:', result.error.message);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error loading traffic fines:', error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, [vehicleId, search, deductedStatus, startDate, endDate]);

    const handleEdit = (record: TrafficFineRow) => {
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
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Multas de Trânsito</h2>
                        <p className="text-sm text-gray-500">Histórico de multas e infrações</p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="rounded-xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Multa
                </Button>
            </div>

            {/* Toolbar */}
            <TrafficFinesToolbar
                search={search}
                onSearchChange={setSearch}
                deductedStatus={deductedStatus}
                onDeductedStatusChange={setDeductedStatus}
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
                    <TrafficFinesTable
                        records={records}
                        onEdit={handleEdit}
                        onDelete={handleSuccess}
                    />
                )}
            </div>

            {/* Modal */}
            <TrafficFineModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                vehicleId={vehicleId}
                initialData={selectedRecord}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
