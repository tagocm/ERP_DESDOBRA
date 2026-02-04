import qz from 'qz-tray';
// import { sha256 } from 'js-sha256'; // removed unused import
// Actually qz-tray handles the websocket.
// We don't need sha256 for printing, only for signing if we implemented it manually but qz-tray handles it via callbacks.

export type PrinterConfig = {
    name: string;
    isConnected: boolean;
};

export const QZ_CONFIG = {
    retries: 3,
    delay: 1000
};

export const qzConnect = async (): Promise<void> => {
    if (qz.websocket.isActive()) return;

    try {
        await qz.websocket.connect(QZ_CONFIG);
        // isConnected state is managed by qz itself usually, or we can use qz.websocket.isActive()
    } catch (err) {
        console.error("QZ Tray Connection Error:", err);
        throw err;
    }
};

export const getPrinters = async (): Promise<string[]> => {
    if (!qz.websocket.isActive()) {
        await qzConnect();
    }
    return await qz.printers.find();
};

export const printZPL = async (printerName: string, zplData: string) => {
    if (!qz.websocket.isActive()) {
        await qzConnect();
    }

    const config = qz.configs.create(printerName);

    // Send raw ZPL
    // 'format': 'command' or 'raw' is implicit when sending strings usually, but strictly:
    // data is an array
    const data = [zplData];

    return await qz.print(config, data);
};

// Security / Signing stub
// In a real prod env, these would call your backend
export const setupQZSecurity = () => {
    // Trusted CA chain (this is where you'd put the certificate)
    // Trusted CA chain (this is where you'd put the certificate)
    qz.security.setCertificatePromise((resolve: (cert: string | undefined) => void, _reject: (err?: unknown) => void) => {
        // Resolve with undefined/null to indicate no certificate (unsigned)
        // This will trigger a popup in QZ Tray asking the user to trust the connection
        resolve(undefined);
    });

    qz.security.setSignaturePromise((toSign: string) => {
        return (resolve: (signed: string) => void, _reject: (err?: unknown) => void) => {
            resolve(toSign);
        };
    });
};
