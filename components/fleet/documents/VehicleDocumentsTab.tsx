"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { VehicleDocumentsToolbar } from "./VehicleDocumentsToolbar";
import { VehicleDocumentsTable } from "./VehicleDocumentsTable";
import { VehicleDocumentModal } from "./VehicleDocumentModal";
import { listVehicleDocumentsAction, VehicleDocumentRow, VehicleDocumentFilters } from "@/app/actions/vehicle-documents-actions";
import { Plus, FileText } from "lucide-react";

interface VehicleDocumentsTabProps {
    vehicleId: string;
}

export function VehicleDocumentsTab({ vehicleId }: VehicleDocumentsTabProps) {
    const [records, setRecords] = useState<VehicleDocumentRow[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<VehicleDocumentRow | undefined>();
    const [loading, setLoading] = useState(true);

    // Filter states
    const [search, setSearch] = useState('');
    const [type, setType] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: VehicleDocumentFilters = {
                search: search || undefined,
                type: (type !== 'all' ? type : undefined),
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            };
            const result = await listVehicleDocumentsAction(vehicleId, filters);
            if (result.ok && result.data) {
                setRecords(result.data);
            } else {
                console.error('Error loading vehicle documents:', result.error?.message);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error loading vehicle documents:', error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, [vehicleId, search, type, startDate, endDate]);

    const handleEdit = (record: VehicleDocumentRow) => {
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
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Documentos do Veículo</h2>
                        <p className="text-sm text-gray-500">Histórico de IPVA e Licenciamento</p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="rounded-xl bg-brand-600 hover:bg-brand-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Lançamento
                </Button>
            </div>

            {/* Toolbar */}
            <VehicleDocumentsToolbar
                search={search}
                onSearchChange={setSearch}
                type={type}
                onTypeChange={setType}
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
                    <VehicleDocumentsTable
                        records={records}
                        onEdit={handleEdit}
                        onDelete={handleSuccess}
                    />
                )}
            </div>

            {/* Modal */}
            <VehicleDocumentModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                vehicleId={vehicleId}
                initialData={selectedRecord}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
