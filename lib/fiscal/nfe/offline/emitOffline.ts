
import { createAdminClient } from '@/lib/supabaseServer';
// NfeDraft removed (unused)
import { buildNfeXml } from '@/lib/nfe/xml/buildNfeXml';
import { signNfeXml } from '@/lib/nfe/sign/signNfeXml';
import { uploadNfeArtifact, downloadPfx } from './storage';
import { decryptPassword } from '@/lib/vault-helpers';
import { normalizeDetails } from './normalization';
import { buildDraftFromDb } from './mappers';
import crypto from 'crypto';
import { syncSalesDocumentFiscalStatus } from '@/lib/fiscal/nfe/sync-sales-document-fiscal-status';
import { upsertNfeEmission } from '@/lib/nfe/sefaz/services/persistence';
import { emitirNfeHomolog } from '@/lib/nfe/sefaz/services/emitir';
import { loadCompanyCertificate } from '@/lib/nfe/sefaz/services/certificateLoader';

interface EmitOfflineResult {
    success: boolean;
    nfeId: string;
    status: 'processing' | 'signed' | 'authorized' | 'error';
    message?: string;
    cStat?: string;
    xMotivo?: string;
}

export async function emitOffline(orderId: string, companyId: string, transmit: boolean = false): Promise<EmitOfflineResult> {
    const adminSupabase = createAdminClient();

    try {
        console.log(`[OfflineEmit] Starting emission for Order ${orderId}`);

        // 1. Fetch Data (Order, Client, Company, Settings, Existing Draft)
        const { data: order, error: orderError } = await adminSupabase
            .from('sales_documents')
            .select(`
                *,
                client:organizations!client_id(*, addresses(*)),
                items:sales_document_items!sales_document_items_document_id_fkey(
                    *,
                    product:items!sales_document_items_item_id_fkey(*, fiscal:item_fiscal_profiles(*)),
                    packaging:item_packaging(*),
                    fiscal_operation:fiscal_operations(*)
                ),
                payments:sales_document_payments(*),
                carrier:organizations!carrier_id(*, addresses(*))
            `)
            .eq('id', orderId)
            .single();

        if (orderError || !order) throw new Error(`Pedido não encontrado: ${orderId}`);

        // Fetch Company Data (Split queries to avoid relation issues)
        const [companyResult, settingsResult, fiscalResult] = await Promise.all([
            adminSupabase.from('companies').select(`*, addresses(*)`).eq('id', companyId).single(),
            adminSupabase.from('company_settings').select('*').eq('company_id', companyId).single(),
            adminSupabase.from('company_fiscal_settings').select('*').eq('company_id', companyId).single()
        ]);

        if (companyResult.error || !companyResult.data) {
            console.error('Company Fetch Error:', companyResult.error);
            throw new Error(`Empresa não encontrada: ${companyId}`);
        }

        const company = {
            ...companyResult.data,
            settings: settingsResult.data,
            fiscal_profile: fiscalResult.data
        };

        // Note: Fiscal profile or settings might be missing if not configured, handle gracefully?
        // Logic requires settings for cert path.


        // Check Certificate
        if (!company.settings?.cert_a1_storage_path) {
            throw new Error('Certificado A1 não configurado.');
        }

        // Get NFe record (created by emitNFe in 'processing' state or 'draft')
        // We expect it to exist because emitNFe creates it.
        const { data: nfeRecord, error: nfeError } = await adminSupabase
            .from('sales_document_nfes')
            .select('*')
            .eq('document_id', orderId)
            // We might be in 'processing' now (set by emitNFe)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (nfeError || !nfeRecord) throw new Error('Registro de NF-e não encontrado.');

        // Resolve installments source with explicit precedence:
        // 1) NF-e draft snapshot (UI card state before emission)
        // 2) sales_document_payments (legacy)
        // 3) financial_event_installments (latest non-rejected financial event)
        const normalizePaymentMethod = (method?: string | null) => {
            const raw = String(method || '').trim().toUpperCase();
            if (!raw) return 'BOLETO';
            if (raw.includes('PIX')) return 'PIX';
            if (raw.includes('DINHEIRO')) return 'DINHEIRO';
            if (raw.includes('CARTAO') || raw.includes('CARTÃO') || raw.includes('CARD')) return 'CARTAO';
            if (raw.includes('BOLETO')) return 'BOLETO';
            return raw;
        };

        const normalizeInstallmentsToPayments = (list: any[] | undefined) =>
            (Array.isArray(list) ? list : [])
                .map((inst: any) => ({
                    installment_number: Number(inst.installment_number || inst.number || 0),
                    due_date: String(inst.due_date || inst.dueDate || '').slice(0, 10),
                    amount: Number(inst.amount || 0),
                    payment_method: normalizePaymentMethod(inst.payment_method || inst.payment_condition || inst.method || null)
                }))
                .filter((inst: any) => inst.installment_number > 0 && !!inst.due_date && inst.amount > 0);

        const snapshotInstallments = normalizeInstallmentsToPayments(
            (nfeRecord as any)?.draft_snapshot?.billing?.installments
        );

        if (snapshotInstallments.length > 0) {
            (order as any).payments = snapshotInstallments;
            console.log(`[OfflineEmit] Using ${snapshotInstallments.length} installments from draft_snapshot.billing`);
        } else {
            const currentOrderPayments = normalizeInstallmentsToPayments((order as any).payments);
            if (currentOrderPayments.length > 0) {
                (order as any).payments = currentOrderPayments;
                console.log(`[OfflineEmit] Using ${currentOrderPayments.length} installments from sales_document_payments`);
            } else {
                const { data: latestEvent, error: eventError } = await adminSupabase
                    .from('financial_events')
                    .select(`
                        id,
                        status,
                        created_at,
                        installments:financial_event_installments(
                            installment_number,
                            due_date,
                            amount,
                            payment_method,
                            payment_condition
                        )
                    `)
                    .eq('company_id', companyId)
                    .eq('origin_type', 'SALE')
                    .eq('origin_id', orderId)
                    .neq('status', 'rejected')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (eventError) {
                    console.warn('[OfflineEmit] Failed to load financial_event_installments fallback:', eventError.message);
                } else {
                    const eventInstallments = normalizeInstallmentsToPayments((latestEvent as any)?.installments);
                    if (eventInstallments.length > 0) {
                        (order as any).payments = eventInstallments;
                        console.log(`[OfflineEmit] Using ${eventInstallments.length} installments from financial_event_installments`);
                    } else {
                        (order as any).payments = [];
                    }
                }
            }
        }

        const resolvedPayments = normalizeInstallmentsToPayments((order as any).payments);
        const today = new Date().toISOString().slice(0, 10);
        const isPrazo = resolvedPayments.some((p: any) => String(p.due_date) > today || Number(p.installment_number) > 1) || resolvedPayments.length > 1;
        (order as any).billing = {
            ...(order as any).billing,
            paymentMode: isPrazo ? 'prazo' : 'avista'
        };

        // 2. Prepare Key Params & Draft

        const serie = nfeRecord.nfe_series || company.settings?.nfe_series || "1";
        const nNF = nfeRecord.nfe_number || company.settings?.nfe_next_number;

        if (!nNF) {
            throw new Error('Próximo número de NF-e não configurado nas configurações da empresa.');
        }

        const cNF = generateRandomCNF();

        // Address Selection: prefer fiscal address from company_settings, then main address, then first.
        const addresses = company.addresses || [];
        const settingsAddress = (company.settings?.address_street && company.settings?.address_city && company.settings?.address_state && company.settings?.address_zip)
            ? {
                street: company.settings.address_street,
                number: company.settings.address_number || 'SN',
                neighborhood: company.settings.address_neighborhood || 'GERAL',
                city: company.settings.address_city,
                state: company.settings.address_state,
                zip: company.settings.address_zip,
                city_code_ibge: company.settings.city_code_ibge || undefined,
                is_main: true
            }
            : null;

        const selectedAddress = settingsAddress
            || addresses.find((a: { is_main: boolean }) => a.is_main)
            || addresses[0];

        const ufState = selectedAddress?.state || 'SP';
        console.log(`[OfflineEmit] Selected Address State: ${ufState} (Total: ${addresses.length})`);

        const cUF = getIbgeUf(ufState);
        const AAMM = new Date().toISOString().slice(2, 4) + new Date().toISOString().slice(5, 7);
        const rawCnpj = company.settings?.cnpj || company.document_number;
        const cnpj = rawCnpj.replace(/\D/g, '');
        const mod = '55';
        const tpEmis = '1';
        const tpAmb = company.settings?.nfe_environment === 'production' ? '1' : '2';

        // Calculate Access Key
        const preKey = `${cUF}${AAMM}${cnpj}${mod}${pad(serie, 3)}${pad(nNF, 9)}${tpEmis}${cNF}`;
        const cDV = calculateCDV(preKey);
        const chNFe = `${preKey}${cDV}`;

        console.log(`[OfflineEmit] Building Draft from DB Data...`);

        // Override company addresses to allow the Mapper to use the SAME address we selected
        // This prevents Mismatch between Key (cUF) and Body (enderEmit).
        const companyForMapper = {
            ...company,
            addresses: selectedAddress ? [selectedAddress] : []
        };

        // Build robust draft from DB
        const draft = buildDraftFromDb({
            order,
            company: companyForMapper,
            keyParams: {
                cNF,
                cUF,
                serie: String(serie),
                nNF: String(nNF),
                tpAmb
            }
        });

        // Ensure Key is set (mapper does it, but double check / override logic)
        draft.ide.cDV = cDV;
        draft.ide.chNFe = chNFe;
        draft.ide.cNF = cNF; // Sync the random number used for key with the XML body

        // CRITICAL VALIDATION: Ensure cMunFG equals emitter's cMun
        // This prevents SEFAZ rejection 539 (municipality mismatch)
        if (draft.ide.cMunFG !== draft.emit.enderEmit.cMun) {
            console.warn(`[OfflineEmit] cMunFG based on selected Address (${draft.emit.enderEmit.cMun}) diverges from ide default. Syncing...`);
            draft.ide.cMunFG = draft.emit.enderEmit.cMun;
        }

        // 4. Generate XML (Transmissible Mode)
        // 4. Generate & Sign (Online or Offline)
        console.log(`[OfflineEmit] Building XML for Key ${chNFe}`);
        const buildRes = buildNfeXml(draft, { mode: 'transmissible', tzOffset: '-03:00' });
        const xml = buildRes.xml;

        let signedXml: string;
        let protocol: string | undefined;
        let cStat: string | undefined;
        let xMotivo: string | undefined;
        let nProt: string | undefined;

        if (transmit) {
            console.log(`[OnlineEmit] Transmitting to SEFAZ...`);
            const certData = await loadCompanyCertificate(companyId);
            const idLote = Date.now().toString().slice(-15);

            // emitirNfeHomolog will Re-Build and Re-Sign, but that's fine for safety.
            // We pass the same draft.
            const result = await emitirNfeHomolog(draft, certData, idLote, {
                companyId,
                accessKey: chNFe
            });

            signedXml = result.nfeXmlAssinado;
            protocol = result.protNFeXml;
            cStat = result.cStat;
            xMotivo = result.xMotivo;

            if (!result.success && result.cStat !== '103' && result.cStat !== '105') {
                // If immediate rejection (e.g. 539, 2xx), we still have signed XML and can persist logs?
                // emitirNfeHomolog returns result even on failure.
            }

        } else {
            // 5. Sign XML (Offline)
            console.log(`[OfflineEmit] Signing XML (Local)...`);
            const pfxBuffer = await downloadPfx(company.settings.cert_a1_storage_path);
            const pfxBase64 = Buffer.from(pfxBuffer).toString('base64');

            if (!company.settings.cert_password_encrypted) {
                throw new Error('Senha do certificado não encontrada.');
            }
            const pfxPassword = decryptPassword(company.settings.cert_password_encrypted);

            const signRes = signNfeXml(xml, { pfxBase64, pfxPassword });
            signedXml = signRes.signedXml;

            // Verify signature count
            const sigCount = (signedXml.match(/<Signature[\s>]/g) || []).length;
            if (sigCount !== 1) {
                throw new Error(`Erro na assinatura: XML possui ${sigCount} assinaturas.`);
            }
        }

        // 6. Calculate Hashes
        const xmlHash = crypto.createHash('sha256').update(xml).digest('hex');
        const signedXmlHash = crypto.createHash('sha256').update(signedXml).digest('hex');

        // 7. Persist Artifacts and Update DB
        console.log(`[OfflineEmit] Uploading artifacts...`);
        const xmlPath = await uploadNfeArtifact(companyId, orderId, nfeRecord.id, 'nfe.xml', xml);
        const signedPath = await uploadNfeArtifact(companyId, orderId, nfeRecord.id, 'nfe-signed.xml', signedXml);

        let protocolPath: { path: string } | undefined;
        let nfeProcPath: { path: string } | undefined;

        if (protocol) {
            // Save protocol separately
            protocolPath = await uploadNfeArtifact(companyId, orderId, nfeRecord.id, 'nfe-prot.xml', protocol);

            // If authorized (cStat=100), build and save nfeProc
            if (cStat === '100') {
                console.log(`[OfflineEmit] Building nfeProc (authorized)...`);

                // Build nfeProc: <nfeProc><NFe>...</NFe><protNFe>...</protNFe></nfeProc>
                const cleanNFe = signedXml.replace(/<\?xml[^>]*\?>/g, '').trim();
                const cleanProtocol = protocol.replace(/<\?xml[^>]*\?>/g, '').trim();

                const nfeProcXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
${cleanNFe}
${cleanProtocol}
</nfeProc>`;

                nfeProcPath = await uploadNfeArtifact(companyId, orderId, nfeRecord.id, 'nfe-proc.xml', nfeProcXml);
                console.log(`[OfflineEmit] nfeProc saved:`, nfeProcPath.path);

                // Extract nProt to persist
                const nProtMatch = protocol.match(/<(?:\w+:)?nProt>\s*([0-9]+)\s*<\/(?:\w+:)?nProt>/i);
                const nProt = nProtMatch?.[1];

                if (nProt) {
                    await upsertNfeEmission({
                        company_id: companyId,
                        sales_document_id: orderId,
                        access_key: chNFe,
                        numero: String(nNF),
                        serie: String(serie),
                        tp_amb: tpAmb as any,
                        uf: ufState,
                        xml_signed: signedXml,
                        status: 'authorized',
                        c_stat: cStat,
                        x_motivo: xMotivo,
                        n_prot: nProt,
                        xml_nfe_proc: nfeProcXml
                    });
                    console.log(`[OfflineEmit] nfe_emissions upserted with nProt: ${nProt}`);
                }
            }
        }

        // Determine Status
        let finalStatus: 'processing' | 'signed' | 'authorized' | 'error' = transmit ? 'processing' : 'signed';

        if (transmit) {
            if (cStat === '100') finalStatus = 'authorized';
            else if (cStat === '103' || cStat === '105') finalStatus = 'processing';
            else finalStatus = 'error'; // Rejection
        }

        // Helper to parse details
        const currentDetails = normalizeDetails(nfeRecord.details);

        const newDetails = {
            ...currentDetails,
            stage: transmit ? 'TRANSMITTED' : 'SIGNED_OFFLINE',
            chNFe,
            cDV,
            tpAmb,
            serie,
            nNF,
            xml_hash_sha256: xmlHash,
            signed_xml_hash_sha256: signedXmlHash,
            cStat,
            xMotivo,
            xml_url: signedPath.path, // optional legacy
            artifacts: {
                xml: xmlPath.path,
                signed_xml: signedPath.path,
                protocol: protocolPath?.path,
                nfe_proc: nfeProcPath?.path // NEW: nfeProc when authorized
            },
            authorization: nProt ? { nProt } : undefined // Fix: Add nProt to details for legacy extraction
        };

        // Clear previous error messages
        delete (newDetails as Record<string, unknown>).message;
        delete (newDetails as Record<string, unknown>).code;

        console.log(`[OfflineEmit] Updating database to ${finalStatus}...`);
        const { error: updateError } = await adminSupabase
            .from('sales_document_nfes')
            .update({
                status: finalStatus,
                nfe_key: chNFe,
                nfe_number: Number(nNF),
                nfe_series: Number(serie),
                details: newDetails,
                updated_at: new Date().toISOString()
            })
            .eq('id', nfeRecord.id);

        if (updateError) throw updateError;

        await syncSalesDocumentFiscalStatus(adminSupabase, orderId, finalStatus);

        // CRITICAL: Increment nfe_next_number to ensure sequential numbering
        console.log(`[OfflineEmit] Incrementing NF-e number counter...`);
        const { error: incrementError } = await adminSupabase
            .from('company_settings')
            .update({
                nfe_next_number: Number(nNF) + 1
            })
            .eq('company_id', companyId);

        if (incrementError) {
            console.error('[OfflineEmit] Failed to increment nfe_next_number:', incrementError);
        }

        return {
            success: finalStatus !== 'error', // If processing or authorized, it is success in terms of emission start
            nfeId: nfeRecord.id,
            status: finalStatus,
            message: transmit ? `Transmissão: ${cStat} - ${xMotivo}` : 'XML gerado e assinado com sucesso. (Offline Mode)',
            cStat,
            xMotivo
        };

    } catch (error: unknown) {
        // Narrow error type safely
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`[OfflineEmit] Error:`, err);

        // Try to update DB with error
        try {
            await adminSupabase
                .from('sales_document_nfes')
                .update({
                    status: 'error',
                    details: {
                        stage: 'OFFLINE_EMISSION',
                        code: (err as any).code || 'UNKNOWN',
                        message: err.message,
                        stack: err.stack
                    },
                    updated_at: new Date().toISOString()
                })
                .eq('document_id', orderId)
                .in('status', ['draft', 'processing']); // Update only if not already authorized/cancelled
            await syncSalesDocumentFiscalStatus(adminSupabase, orderId, 'error');
        } catch (dbErr) {
            console.error('Failed to report error to DB:', dbErr);
        }

        return {
            success: false,
            nfeId: '',
            status: 'error',
            message: err.message
        };
    }
}

// --- Helpers ---

function generateRandomCNF(): string {
    return Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
}

function pad(val: string | number, len: number): string {
    return String(val).padStart(len, '0');
}

function getIbgeUf(uf: string): string {
    const map: Record<string, string> = {
        'RO': '11', 'AC': '12', 'AM': '13', 'RR': '14', 'PA': '15', 'AP': '16', 'TO': '17',
        'MA': '21', 'PI': '22', 'CE': '23', 'RN': '24', 'PB': '25', 'PE': '26', 'AL': '27',
        'SE': '28', 'BA': '29', 'MG': '31', 'ES': '32', 'RJ': '33', 'SP': '35', 'PR': '41',
        'SC': '42', 'RS': '43', 'MS': '50', 'MT': '51', 'GO': '52', 'DF': '53'
    };
    return map[uf.toUpperCase()] || '35'; // Default SP
}

function calculateCDV(key: string): string {
    let soma = 0;
    let peso = 2;
    for (let i = key.length - 1; i >= 0; i--) {
        soma += parseInt(key[i]) * peso;
        peso++;
        if (peso > 9) peso = 2;
    }
    const resto = soma % 11;
    const dv = (11 - resto);
    return (dv >= 10 ? 0 : dv).toString();
}
