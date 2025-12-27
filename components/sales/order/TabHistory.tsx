
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseBrowser";
import { format } from "date-fns"; // Standard

interface TabHistoryProps {
    orderId: string;
}

export function TabHistory({ orderId }: TabHistoryProps) {
    const supabase = createClient();
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            const { data } = await supabase
                .from('sales_document_history')
                .select('*')
                .eq('document_id', orderId)
                .order('created_at', { ascending: false });
            if (data) setEvents(data);
        };
        fetchHistory();
    }, [orderId, supabase]);

    return (
        <div className="space-y-6">
            <h3 className="font-semibold text-gray-900 border-b pb-2">Histórico de Eventos</h3>
            <div className="relative border-l border-gray-200 ml-3 space-y-6 pb-4">
                {events.map((event) => (
                    <div key={event.id} className="mb-8 ml-6 relative">
                        <span className="absolute flex items-center justify-center w-3 h-3 bg-brand-500 rounded-full ring-4 ring-white -left-[30px] top-1">
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">{event.description}</h4>
                            <time className="text-xs text-gray-500 lowercase">
                                {new Date(event.created_at).toLocaleString()}
                            </time>
                        </div>
                        {event.metadata && (
                            <p className="mt-1 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded inline-block">
                                {JSON.stringify(event.metadata)}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                            Usuário: {event.user_id || 'Sistema'}
                        </p>
                    </div>
                ))}
                {events.length === 0 && (
                    <div className="ml-6 text-sm text-gray-500">Nenhum evento registrado.</div>
                )}
            </div>
        </div>
    );
}
