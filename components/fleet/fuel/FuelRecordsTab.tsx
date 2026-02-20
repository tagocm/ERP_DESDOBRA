"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { FuelRecordsToolbar } from "./FuelRecordsToolbar";
import { FuelRecordsTable } from "./FuelRecordsTable";
import { FuelRecordModal } from "./FuelRecordModal";
import { listFuelRecordsAction } from "@/app/actions/fuel-records-actions";
import { FuelRecordRow, FuelRecordListFilters, FuelType } from "@/lib/types/fuel-records";
import { FleetVehicleRow } from "@/lib/types/fleet";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface FuelRecordsTabProps {
    vehicleId: string;
    vehicleData: FleetVehicleRow;
}

export function FuelRecordsTab({ vehicleId, vehicleData }: FuelRecordsTabProps) {
    const [records, setRecords] = useState<FuelRecordRow[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<FuelRecordRow | undefined>();
    const [loading, setLoading] = useState(true);

    // Filter states
    const [search, setSearch] = useState('');
    const [fuelType, setFuelType] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: FuelRecordListFilters = {
                search: search || undefined,
                fuelType: (fuelType !== 'all' ? fuelType : undefined) as FuelType | undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
            };
            const result = await listFuelRecordsAction(vehicleId, filters);
            if (result.ok) {
                setRecords(result.data || []);
            } else {
                console.error('Error loading fuel records:', result.error.message);
                setRecords([]);
            }
        } catch (error) {
            console.error('Error loading fuel records:', error);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, [vehicleId, search, fuelType, startDate, endDate]);

    const handleEdit = (record: FuelRecordRow) => {
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
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center">
                        <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Abastecimentos</h2>
                        <p className="text-sm text-gray-500">Histórico de abastecimentos do veículo</p>
                    </div>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="rounded-2xl">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Abastecimento
                </Button>
            </div>

            {/* Toolbar */}
            <FuelRecordsToolbar
                search={search}
                onSearchChange={setSearch}
                fuelType={fuelType}
                onFuelTypeChange={setFuelType}
                startDate={startDate}
                onStartDateChange={setStartDate}
                endDate={endDate}
                onEndDateChange={setEndDate}
            />

            {/* Table */}
            <Card className="rounded-2xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Carregando...</div>
                ) : (
                    <FuelRecordsTable
                        records={records}
                        onEdit={handleEdit}
                        onDelete={handleSuccess}
                    />
                )}
            </Card>

            {/* Modal */}
            <FuelRecordModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                vehicleId={vehicleId}
                vehicleData={vehicleData}
                initialData={selectedRecord}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
