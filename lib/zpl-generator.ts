
import { format } from "date-fns";

// Minimal type for ZPL generation - only what's needed for labels
// Accepts null values and normalizes them inside the function
type OrderForLabel = {
    id: string;
    document_number: string | null;
    client?: { trade_name?: string | null } | null;
};

export function generateVolumeLabelZPL(
    order: OrderForLabel,
    route: { id: string, name: string, scheduled_date?: string | null },
    volumeIndex: number,
    totalVolumes: number
): string {
    const clientName = (order.client?.trade_name || "CONSUMIDOR").substring(0, 25);
    const orderNum = order.document_number || "S/N";  // Normalize null to "S/N"
    const routeName = (route.name || "Rota").substring(0, 25);
    const dateStr = route.scheduled_date
        ? format(new Date(route.scheduled_date + 'T12:00:00'), 'dd/MM/yyyy')
        : format(new Date(), 'dd/MM/yyyy');

    const qrData = `${order.id}|${route.id}|vol=${volumeIndex}|tot=${totalVolumes}`;

    // ZPL for 100mm x 50mm label (approx)
    // Using standard fonts and QR code
    return `^XA
^PW800
^LL400
^FO30,30^A0N,50,50^FD${clientName}^FS
^FO30,100^A0N,30,30^FDPedido: ${orderNum}^FS
^FO30,140^A0N,30,30^FD${routeName} - ${dateStr}^FS
^FO30,220^GB250,60,60^FS
^FO40,230^A0N,40,40^FR^FDVOL ${volumeIndex} / ${totalVolumes}^FS
^FO500,50^BQN,2,7^FDQA,${qrData}^FS
^XZ`;
}

export function downloadZpl(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
