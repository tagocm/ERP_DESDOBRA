"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { useCompany } from "@/contexts/CompanyContext";
import { getCarriers } from "@/lib/clients-db";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select";
import { Loader2 } from "lucide-react";

interface CarrierSelectorProps {
    value?: string | null;
    onChange: (carrierId: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
}

interface Carrier {
    id: string;
    trade_name: string;
    legal_name: string | null;
    document_number: string | null;
    addresses?: Array<{ city?: string; state?: string }>;
}

export function CarrierSelector({
    value,
    onChange,
    disabled = false,
    placeholder = "Selecione a transportadora...",
}: CarrierSelectorProps) {
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [loading, setLoading] = useState(true);
    const { selectedCompany } = useCompany();
    const supabase = createClient();

    useEffect(() => {
        if (!selectedCompany) return;

        const fetchCarriers = async () => {
            setLoading(true);
            try {
                const data = await getCarriers(supabase, selectedCompany.id);
                setCarriers(data as Carrier[]);
            } catch (error) {
                console.error("Error fetching carriers:", error);
                setCarriers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCarriers();
    }, [selectedCompany]);

    const formatCarrierLabel = (carrier: Carrier) => {
        const parts = [carrier.trade_name];

        if (carrier.document_number) {
            parts.push(`(${carrier.document_number})`);
        }

        if (carrier.addresses && carrier.addresses.length > 0) {
            const addr = carrier.addresses[0];
            if (addr.city && addr.state) {
                parts.push(`- ${addr.city}/${addr.state}`);
            } else if (addr.state) {
                parts.push(`- ${addr.state}`);
            }
        }

        return parts.join(" ");
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 h-9 px-3 border border-gray-200 rounded-md bg-gray-50">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">Carregando transportadoras...</span>
            </div>
        );
    }

    if (carriers.length === 0) {
        return (
            <div className="h-9 px-3 border border-gray-200 rounded-md bg-gray-50 flex items-center">
                <span className="text-sm text-gray-500">Nenhuma transportadora cadastrada</span>
            </div>
        );
    }

    return (
        <Select
            value={value || "none"}
            onValueChange={(val) => onChange(val === "none" ? null : val)}
            disabled={disabled}
        >
            <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {carriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                        {formatCarrierLabel(carrier)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
