
import { NfeDraft, NfeIde, NfeEmit, NfeDest, NfeItem, NfePag, NfeEndereco, NfeProd, NfeImposto, NfeCobr } from '@/lib/nfe/domain/types';
import { buildNfeProductDescription, resolveUomAbbrev } from '@/lib/fiscal/nfe-description';

interface MapperContext {
    order: any;
    company: any;
    keyParams: {
        cNF: string;
        cUF: string;
        serie: string;
        nNF: string;
        tpAmb: '1' | '2';
    };
}

export function buildDraftFromDb(ctx: MapperContext): NfeDraft {
    const { order, company, keyParams } = ctx;
    const settings = company.settings;

    // --- Helpers ---
    const strip = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const truncate = (s: string, len: number) => (s || '').substring(0, len);
    const requireString = (val: unknown, fieldName: string) => {
        if (!val && val !== 0) throw new Error(`Campo obrigatório faltando: ${fieldName}`);
        return String(val);
    };
    const requireNumber = (val: unknown, fieldName: string) => {
        if (val === undefined || val === null || val === '') throw new Error(`Campo obrigatório faltando: ${fieldName}`);
        const n = Number(val);
        if (isNaN(n)) throw new Error(`Valor numérico inválido para: ${fieldName}`);
        return n;
    };
    const toNumber = (val: unknown, fallback = 0) => {
        if (val === null || val === undefined || val === '') return fallback;
        const n = Number(val);
        return Number.isFinite(n) ? n : fallback;
    };
    const round2 = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;
    const normalizeTwoDigits = (value: unknown, fallback: string) =>
        String(value ?? fallback).replace(/\D/g, '').padStart(2, '0').slice(-2);
    const normalizeThreeDigits = (value: unknown, fallback: string) =>
        String(value ?? fallback).replace(/\D/g, '').padStart(3, '0').slice(-3);
    const normalizeCBenef = (value: unknown) =>
        String(value ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .toUpperCase();
    const isValidCBenef = (value: string) =>
        value === 'SEM CBENEF' || value.length === 8 || value.length === 10;
    const spCstRequiringCBenef = new Set(['20', '30', '40', '41', '50', '51', '53', '70', '90']);

    // --- 1. EMIT (Build first to extract cMun for cMunFG) ---
    const crt = settings.tax_regime === 'simples_nacional' ? '1' : '3';

    // FIX: Use is_main instead of is_default (bug critical - was using wrong field)
    const emitAddr = company.addresses?.find((a: { is_main: boolean }) => a.is_main) || company.addresses?.[0];

    if (!emitAddr) throw new Error('Dados de endereço do emitente não encontrados.');

    // DEBUG: Log selected address to verify it's pulling real data
    console.log('[NFE Draft] Endereço Emissor Selecionado:', {
        rua: emitAddr.street,
        numero: emitAddr.number,
        bairro: emitAddr.neighborhood,
        cidade: emitAddr.city,
        uf: emitAddr.state,
        cep: emitAddr.zip
    });

    const emit: NfeEmit = {
        cnpj: requireString(strip(settings.cnpj || company.document_number), 'CNPJ Emitente'),
        xNome: requireString(truncate(settings.legal_name || company.name, 60), 'Razão Social Emitente'),
        xFant: truncate(settings.trade_name || company.slug, 60),
        ie: requireString(strip(settings.ie), 'Inscrição Estadual Emitente'),
        crt: crt as any,
        enderEmit: mapAddress(emitAddr, company.settings, 'Emitente')
    };

    // Extract emitter municipality code for cMunFG
    const emitterCMun = emit.enderEmit.cMun;

    if (!emitterCMun || emitterCMun.length !== 7) {
        throw new Error('Município do emitente (cMun) não informado/inválido. Não é possível gerar cMunFG.');
    }

    // --- 2. IDE (Use emitter's cMun for cMunFG) ---
    // Rule: idDest: 1=Internal, 2=Interstate
    const emitState = emit.enderEmit.uf || 'SP';
    const destState = order.client.addresses?.[0]?.state || 'SP';
    const idDest = (emitState === destState) ? '1' : '2';

    const ide: NfeIde = {
        cUF: keyParams.cUF,
        cNF: keyParams.cNF,
        natOp: 'VENDA DE MERCADORIA', // Default or from order type
        mod: '55',
        serie: keyParams.serie,
        nNF: keyParams.nNF,
        dhEmi: new Date().toISOString(),
        tpNF: '1', // Saída
        idDest: idDest as any,
        cMunFG: emitterCMun, // ← FIX: Use emitter's cMun
        tpImp: '1', // Portrait
        tpEmis: '1', // Normal
        tpAmb: keyParams.tpAmb,
        finNFe: '1', // Normal
        indFinal: '1', // Consumer Final (Default to 1 for simplificaiton)
        indPres: '1', // Presencial (Default)
        procEmi: '0', // App Contribuinte
        verProc: 'ERP_DESDOBRA_1.0'
    };

    // --- 3. DEST ---
    const client = order.client;
    const clientAddr = client.addresses?.[0]; // Use first address

    // Homologation environment allows overriding destination name for test safety, 
    // but we use Watermark in DANFE for compliance. We keep real name in XML.
    const isHomolog = keyParams.tpAmb === '2';
    const destName = requireString(client.name || client.legal_name, 'Nome/Razão Social Destinatário');

    // Fallback to document_number if document is missing (DB schema variance)
    const clientCnpj = requireString(strip(client.document || client.document_number), 'CPF/CNPJ Destinatário');

    let indIEDest: "1" | "2" | "9" = "9"; // Default Non-contributor
    if (client.state_registration && client.state_registration.toLowerCase() !== 'isento') {
        indIEDest = "1"; // Contributor
    } else if (client.state_registration && client.state_registration.toLowerCase() === 'isento') {
        indIEDest = "2"; // Exempt
    }

    const dest: NfeDest = {
        cpfOuCnpj: clientCnpj,
        // SEFAZ Homologation: In tpAmb=2, recipient name MUST be this exact text (error 598)
        xNome: truncate(
            isHomolog ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : destName,
            60
        ),
        indIEDest,
        ie: (indIEDest === '1') ? strip(client.state_registration) : undefined,
        enderDest: mapAddress(clientAddr, null, 'Destinatário')
    };

    // --- 4. ITEMS ---
    const itens: NfeItem[] = order.items.map((item: any, idx: number) => {
        const prod = item.product;
        const fiscalRaw = prod?.fiscal;
        const fiscal = Array.isArray(fiscalRaw) ? (fiscalRaw[0] || {}) : (fiscalRaw || {});
        const fiscalOp = item.fiscal_operation || {};
        const emitUf = String(emit.enderEmit.uf || '').toUpperCase();

        // Product Data
        const pkg = item.packaging;
        // Logic: Snapshot > Packaging > Product
        const snapshot = (item as any).sales_unit_snapshot;

        let uCom = 'UN';
        let uTrib = 'UN';
        const qCom = Number(item.quantity);
        const vUnCom = Number(item.unit_price);

        // 1. Snapshot Strategy (Gold Standard)
        if (snapshot && snapshot.sell_unit_code) {
            uCom = snapshot.sell_unit_code;
            uTrib = snapshot.base_unit_code || uCom;

            // qTrib = qCom * factor
            // vUnTrib = vUnCom / factor
            const _factor = Number(snapshot.factor_in_base) || 1;

            // qTrib is essentially qty_base if consistency holds, but let's calculate to be sure
            // or use item.qty_base if trusted. Snapshot factor is safer.
        }
        // 2. Legacy Strategy (Packaging)
        else if (pkg) {
            // Use TYPE (code like 'BOX', 'PACK') not LABEL (descriptive like 'Caixa 12xPc')
            uCom = resolveUomAbbrev(null, pkg.type, null).toUpperCase();
            uTrib = (prod.un || item.uom || 'UN').trim(); // Fallback
        }
        // 3. Fallback (Product)
        else {
            uCom = (prod.un || item.uom || 'UN').trim();
            uTrib = uCom;
        }

        // Sanitize strings (limit 6 chars and trim after truncation to avoid trailing spaces)
        uCom = truncate(uCom, 6).trim();
        uTrib = truncate(uTrib, 6).trim();

        // Calculate Trib Values
        // If snapshot is used, we have the factor. If legacy, we rely on qty_base check or default 1.
        let qTrib = 0;
        let vUnTrib = 0;

        if (snapshot && snapshot.factor_in_base) {
            const factor = Number(snapshot.factor_in_base);
            qTrib = qCom * factor;
            vUnTrib = vUnCom / factor;
        } else {
            // Fallback: use stored qty_base if available and different
            const qtyBase = Number(item.qty_base);

            if (qtyBase && qtyBase !== qCom) {
                qTrib = qtyBase;
                // factor = qtyBase / qCom
                vUnTrib = (Number(item.total_amount) / qtyBase);
            } else {
                qTrib = qCom;
                vUnTrib = vUnCom;
            }
        }

        // Build product description with explicit unit conversion
        const descResult = buildNfeProductDescription({
            itemName: requireString(prod.name || item.product_name, `Nome do Produto (Item ${idx + 1})`),
            salesUomAbbrev: item.sales_uom_abbrev_snapshot || resolveUomAbbrev(
                (item.packaging as any)?.uoms?.abbrev,
                item.packaging?.type,
                uCom
            ),
            baseUomAbbrev: item.base_uom_abbrev_snapshot || uTrib,
            conversionFactor: item.conversion_factor_snapshot || (pkg?.qty_in_base),
            qtySales: qCom,
            qtyBase: qTrib !== qCom ? qTrib : null, // Only include if different
            packagingLabel: item.sales_unit_label_snapshot || pkg?.label
        });

        const nfeProd: NfeProd = {
            cProd: requireString(truncate(prod?.sku || prod?.code || item.item_id || item.product_id, 60), `Código do Produto (Item ${idx + 1})`),
            xProd: descResult.xProd, // Use generated description
            ncm: requireString(strip(item.ncm_snapshot || fiscal.ncm), `NCM do Product (Item ${idx + 1})`),
            cfop: requireString(strip(item.cfop_code || fiscalOp.cfop || fiscal.cfop_internal || '5102'), `CFOP do Produto (Item ${idx + 1})`),
            uCom: uCom,
            qCom: qCom,
            vUnCom: vUnCom,
            vProd: requireNumber(Number(item.total_amount) || (qCom * vUnCom), `Valor Total (Item ${idx + 1})`),
            cean: 'SEM GTIN',
            ceanTrib: 'SEM GTIN',
            uTrib: uTrib,
            qTrib: qTrib,
            vUnTrib: vUnTrib,
            infAdProd: descResult.infAdProd || undefined // Additional info if overflow
        };

        const imposto: NfeImposto = {
            vTotTrib: 0 // Calculate approximate?
        };

        const itemTotal = Number(item.total_amount) || (qCom * vUnCom);
        const itemOrigin = String(item.origin_snapshot ?? fiscal.origin ?? '0') as any;
        let itemCstIcms: string | null = null;

        // ICMS
        if (crt === '1') {
            // Simples Nacional
            const csosn = normalizeThreeDigits(item.csosn || fiscalOp.icms_csosn || fiscal.csosn_internal, '102');
            imposto.icms = {
                orig: itemOrigin,
                csosn: csosn,
                // If 101, needs credits, etc. 
                // Allow fallback to 102 (no credits) for safety unless data is present.
            };
        } else {
            // Normal Regime
            const cst = normalizeTwoDigits(item.cst_icms || fiscalOp.icms_cst || fiscal.cst_icms_internal, '00');
            itemCstIcms = cst;
            const reductionBcPercent = toNumber(fiscalOp.icms_reduction_bc_percent, 0);
            const icmsRate = toNumber((item as any).icms_aliquot, toNumber(fiscalOp.icms_rate_percent, 0));
            const icmsIsTaxed = ['00', '10', '20', '70', '90'].includes(cst);
            const calculatedBase = icmsIsTaxed
                ? round2(itemTotal * (1 - Math.min(Math.max(reductionBcPercent, 0), 100) / 100))
                : 0;
            const itemIcmsBase = toNumber((item as any).icms_base, calculatedBase);
            const itemIcmsValue = toNumber((item as any).icms_value, round2(itemIcmsBase * (icmsRate / 100)));

            imposto.icms = {
                orig: itemOrigin,
                cst: cst,
                modBC: String(fiscalOp.icms_modal_bc || '3') as any,
                pRedBC: ['20', '70'].includes(cst)
                    ? reductionBcPercent
                    : (reductionBcPercent > 0 ? reductionBcPercent : undefined),
                vBC: itemIcmsBase,
                pICMS: icmsRate,
                vICMS: itemIcmsValue
            };
        }

        // cBenef (tag prod.cBenef): required in some UF/CST combinations (e.g. SP).
        const rawCBenef = normalizeCBenef(
            (item as any).cBenef
            || (item as any).cbenef
            || (item as any).c_benef
            || (fiscalOp as any).cBenef
            || (fiscalOp as any).cbenef
            || (fiscal as any).cBenef
            || (fiscal as any).cbenef
        );
        if (rawCBenef && isValidCBenef(rawCBenef)) {
            nfeProd.cBenef = rawCBenef;
        } else if (emitUf === 'SP' && itemCstIcms && spCstRequiringCBenef.has(itemCstIcms)) {
            nfeProd.cBenef = 'SEM CBENEF';
        }

        // PIS/COF
        const pisCst = normalizeTwoDigits(item.pis_cst || fiscalOp.pis_cst || fiscal.cst_pis_internal, '07');
        const pisRate = toNumber(item.pis_aliquot, toNumber(fiscalOp.pis_rate_percent, 0));
        const pisTaxed = ['01', '02'].includes(pisCst);
        const pisBase = pisTaxed ? itemTotal : 0;
        imposto.pis = {
            cst: pisCst,
            vBC: pisBase,
            pPIS: pisTaxed ? pisRate : 0,
            vPIS: toNumber(item.pis_value, pisTaxed ? round2(pisBase * (pisRate / 100)) : 0)
        };

        const cofinsCst = normalizeTwoDigits(item.cofins_cst || fiscalOp.cofins_cst || fiscal.cst_cofins_internal, '07');
        const cofinsRate = toNumber(item.cofins_aliquot, toNumber(fiscalOp.cofins_rate_percent, 0));
        const cofinsTaxed = ['01', '02'].includes(cofinsCst);
        const cofinsBase = cofinsTaxed ? itemTotal : 0;
        imposto.cofins = {
            cst: cofinsCst,
            vBC: cofinsBase,
            pCOFINS: cofinsTaxed ? cofinsRate : 0,
            vCOFINS: toNumber(item.cofins_value, cofinsTaxed ? round2(cofinsBase * (cofinsRate / 100)) : 0)
        };

        return {
            nItem: idx + 1,
            prod: nfeProd,
            imposto
        };
    });

    // --- 5. PAG ---
    // Map order payment mode to tPag
    // tPag codes: 01=Dinheiro, 03=Cartão Créd, 04=Cartão Déb, 15=Boleto, 17=PIX, 90=Sem Pagamento, 99=Outros

    const NFE_DEBUG = process.env.NFE_DEBUG === '1';
    const totalAmount = Number(order.total_amount || 0);
    const hasPayments = order.payments && order.payments.length > 0;

    if (NFE_DEBUG) {
        console.log('[NFE_DEBUG] Payment Detection Input:', {
            order_id: order.id,
            total_amount: totalAmount,
            has_payments: hasPayments,
            payment_count: order.payments?.length || 0,
            first_payment_method: order.payments?.[0]?.payment_method,
            billing_payment_mode: order.billing?.paymentMode
        });
    }

    // Step 1: Try to detect from payment_method
    let tPag = '90'; // Default: Sem Pagamento
    let detectionSource = 'default';

    if (hasPayments) {
        const method = order.payments[0].payment_method?.toLowerCase();

        if (method) {
            if (method.includes('boleto')) {
                tPag = '15';
                detectionSource = 'payment_method:boleto';
            } else if (method.includes('pix')) {
                tPag = '17';
                detectionSource = 'payment_method:pix';
            } else if (method.includes('credito') || method.includes('crédito')) {
                tPag = '03';
                detectionSource = 'payment_method:credito';
            } else if (method.includes('debito') || method.includes('débito')) {
                tPag = '04';
                detectionSource = 'payment_method:debito';
            } else if (method.includes('dinheiro')) {
                tPag = '01';
                detectionSource = 'payment_method:dinheiro';
            }
        }
    }

    // Step 2: Fallback to billing.paymentMode if still '90'
    if (tPag === '90' && order.billing?.paymentMode) {
        const mode = order.billing.paymentMode;
        if (mode === 'avista') {
            tPag = '01'; // Dinheiro (generic for "à vista")
            detectionSource = 'billing:avista';
        } else if (mode === 'prazo') {
            tPag = '15'; // Boleto (generic for installments)
            detectionSource = 'billing:prazo';
        }
    }

    // Step 3: CRITICAL - Prevent tPag=90 when total_amount > 0
    if (tPag === '90' && totalAmount > 0) {
        if (hasPayments) {
            // Has payment records but method unrecognized -> safe fallback to Boleto
            tPag = '15';
            detectionSource = 'fallback:has_payments_boleto';
        } else {
            // No payment records but has value -> use "Outros"
            tPag = '99';
            detectionSource = 'fallback:outros';
        }

        if (NFE_DEBUG) {
            console.warn('[NFE_DEBUG] tPag=90 prevented for non-zero amount! Applied fallback:', {
                original: '90',
                corrected: tPag,
                reason: detectionSource
            });
        }
    }

    if (NFE_DEBUG) {
        console.log('[NFE_DEBUG] Final Payment Mapping:', {
            tPag,
            detection_source: detectionSource,
            vPag: totalAmount
        });
    }

    // --- 5.1. COBR / DUPLICATAS ---
    const payments = (order.payments || [])
        .filter((payment: any) => payment && payment.amount > 0 && payment.due_date)
        .sort((a: any, b: any) => {
            const ia = Number(a.installment_number || 0);
            const ib = Number(b.installment_number || 0);
            if (ia !== ib) return ia - ib;
            return String(a.due_date).localeCompare(String(b.due_date));
        });

    let cobr: NfeCobr | undefined;
    const emissionDate = String(ide.dhEmi || '').slice(0, 10);
    const hasFutureDueDate = payments.some((payment: any) => {
        const due = String(payment.due_date || '').slice(0, 10);
        return !!due && !!emissionDate && due > emissionDate;
    });
    const hasInstallmentNumberGt1 = payments.some((payment: any) => Number(payment.installment_number || 0) > 1);
    const hasMultipleInstallments = payments.length > 1;
    const shouldEmitCobr =
        payments.length > 0 &&
        (hasFutureDueDate || hasMultipleInstallments || hasInstallmentNumberGt1);

    if (shouldEmitCobr) {
        const totalDuplicatas = payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);

        cobr = {
            fat: {
                nFat: String(ide.nNF || ''),
                vOrig: totalDuplicatas,
                vDesc: 0,
                vLiq: totalDuplicatas
            },
            dup: payments.map((payment: any) => ({
                nDup: String(Number(payment.installment_number || 0)).padStart(3, '0'),
                dVenc: String(payment.due_date).slice(0, 10),
                vDup: Number(payment.amount || 0)
            }))
        };
    } else if (NFE_DEBUG && totalAmount > 0) {
        console.warn('[NFE_DEBUG] XML emitido sem cobr/dup (sem parcelas financeiras vinculadas).', {
            order_id: order.id,
            total_amount: totalAmount,
            payments_count: payments.length,
            payment_terms_id: order.payment_terms_id,
            payment_mode_id: order.payment_mode_id
        });
    }

    // --- 5.2. PAG ---
    const normalizedTPag = tPag === '99' ? '15' : tPag; // Preserve legacy fallback.
    const pagDet: NonNullable<NfePag['detPag']>[number] = {
        indPag: shouldEmitCobr ? '1' : '0',
        tPag: normalizedTPag,
        vPag: totalAmount
    };

    // Some electronic means require card/PIX group details (SEFAZ 391).
    if (['03', '04', '17', '18', '19'].includes(normalizedTPag)) {
        pagDet.card = {
            tpIntegra: '2'
        };
    }

    const pag: NfePag = {
        detPag: [pagDet]
    };

    // --- 6. TRANSP ---
    // Map freight mode
    const modeMap: Record<string, string> = {
        'cif': '0', 'sender': '0', 'own_delivery': '0',
        'fob': '1', 'recipient': '1', 'exw': '1',
        'third_party': '2',
        'none': '9'
    };
    const modFrete = (modeMap[order.freight_mode?.toLowerCase()] || '9') as any;

    const vol = (order.volumes_qty || order.volumes_gross_weight_kg) ? [{
        qVol: order.volumes_qty,
        esp: order.volumes_species,
        marca: order.volumes_brand,
        nVol: order.volumes_number, // Ensure this exists on order or is ignored
        pesoL: order.volumes_net_weight_kg || 0,
        pesoB: order.volumes_gross_weight_kg || 0
    }] : undefined;

    return {
        ide,
        emit,
        dest,
        itens,
        cobr,
        pag,
        transp: {
            modFrete,
            vol
        }
    };
}

// --- Helpers ---
const strip = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

// --- Address Mapper ---
// --- Address Mapper ---
interface AddressData {
    street?: string;
    number?: string;
    neighborhood?: string;
    city_code_ibge?: string;
    city?: string;
    state?: string;
    zip?: string;
}

function mapAddress(addr: AddressData | null, settings: any, contextName: string): NfeEndereco {
    if (!addr) {
        throw new Error(`Endereço obrigatório faltando para: ${contextName}`);
    }

    const requireAddr = (val: unknown, field: string) => {
        if (!val) throw new Error(`Campo de endereço '${field}' faltando para: ${contextName}`);
        return String(val);
    }

    return {
        xLgr: requireAddr((addr.street || '').substring(0, 60), 'Logradouro'),
        nro: requireAddr((addr.number || 'SN').substring(0, 60), 'Número'),
        xBairro: requireAddr((addr.neighborhood || 'GERAL').substring(0, 60), 'Bairro'),
        cMun: requireAddr(strip(addr.city_code_ibge || settings?.city_code_ibge), 'Código Município'),
        xMun: requireAddr((addr.city || 'Municipio').substring(0, 60), 'Cidade'),
        uf: requireAddr((addr.state || 'SP').substring(0, 2), 'UF'),
        cep: requireAddr(strip(addr.zip), 'CEP'),
        cPais: '1058',
        xPais: 'BRASIL'
    };
}
