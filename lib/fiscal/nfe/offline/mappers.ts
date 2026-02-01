
import { NfeDraft, NfeIde, NfeEmit, NfeDest, NfeItem, NfePag, NfeEndereco, NfeProd, NfeImposto } from '@/lib/nfe/domain/types';
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
    const requireField = (val: any, fieldName: string) => {
        if (!val) throw new Error(`Campo obrigatório faltando: ${fieldName}`);
        return val;
    };

    // --- 1. EMIT (Build first to extract cMun for cMunFG) ---
    const crt = settings.tax_regime === 'simples_nacional' ? '1' : '3';

    // FIX: Use is_main instead of is_default (bug critical - was using wrong field)
    const emitAddr = company.addresses?.find((a: any) => a.is_main) || company.addresses?.[0];

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
        cnpj: requireField(strip(settings.cnpj || company.document_number), 'CNPJ Emitente'),
        xNome: requireField(truncate(settings.legal_name || company.name, 60), 'Razão Social Emitente'),
        xFant: truncate(settings.trade_name || company.slug, 60),
        ie: requireField(strip(settings.ie), 'Inscrição Estadual Emitente'),
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
    const emitState = company.addresses?.[0]?.state || 'SP';
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
    const destName = requireField(client.name || client.legal_name, 'Nome/Razão Social Destinatário');

    // Fallback to document_number if document is missing (DB schema variance)
    const clientCnpj = requireField(strip(client.document || client.document_number), 'CPF/CNPJ Destinatário');

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
        const fiscal = prod.fiscal || {};

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

            // If factor exists, calculate qTrib and vUnTrib correctly
            // qTrib = qCom * factor
            // vUnTrib = vUnCom / factor
            const factor = Number(snapshot.factor_in_base) || 1;

            // qTrib is essentially qty_base if consistency holds, but let's calculate to be sure
            // or use item.qty_base if trusted. Snapshot factor is safer.
        }
        // 2. Legacy Strategy (Packaging)
        else if (pkg) {
            // Use TYPE (code like 'BOX', 'PACK') not LABEL (descriptive like 'Caixa 12xPc')
            uCom = (pkg.type || 'UN').trim().toUpperCase();
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
            itemName: requireField(prod.name || item.product_name, `Nome do Produto (Item ${idx + 1})`),
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
            cProd: requireField(truncate(prod.sku || prod.code || item.product_id, 60), `Código do Produto (Item ${idx + 1})`),
            xProd: descResult.xProd, // Use generated description
            ncm: requireField(strip(fiscal.ncm), `NCM do Product (Item ${idx + 1})`),
            cfop: requireField(strip(fiscal.cfop_internal || '5102'), `CFOP do Produto (Item ${idx + 1})`),
            uCom: uCom,
            qCom: qCom,
            vUnCom: vUnCom,
            vProd: requireField(Number(item.total_amount) || (qCom * vUnCom), `Valor Total (Item ${idx + 1})`),
            cean: 'SEM GTIN',
            ceanTrib: 'SEM GTIN',
            uTrib: uTrib,
            qTrib: qTrib,
            vUnTrib: vUnTrib,
            infAdProd: descResult.infAdProd || undefined // Additional info if overflow
        };

        // Tax Data (Simplified for now - using generic fallback if snapshots missing)
        // If we have calculated taxes in item (from order items table), use them.
        // sales_document_items columns: icms_base, icms_rate, icms_value, etc.

        const imposto: NfeImposto = {
            vTotTrib: 0 // Calculate approximate?
        };

        // ICMS
        if (crt === '1') {
            // Simples Nacional
            const csosn = fiscal.csosn_internal || '102'; // Default
            imposto.icms = {
                orig: (String(fiscal.origin || '0') as any),
                csosn: csosn,
                // If 101, needs credits, etc. 
                // Allow fallback to 102 (no credits) for safety unless data is present.
            };
        } else {
            // Normal Regime
            const cst = fiscal.cst_icms_internal || '00';
            imposto.icms = {
                orig: (String(fiscal.origin || '0') as any),
                cst: cst,
                modBC: '3', // Valor da Operação
                vBC: Number(item.icms_base || 0),
                pICMS: Number(item.icms_rate || 0),
                vICMS: Number(item.icms_value || 0)
            };
        }

        // PIS/COF
        imposto.pis = {
            cst: fiscal.cst_pis_internal || '07', // 07 Isento Default
            vBC: 0,
            pPIS: 0,
            vPIS: 0
        };
        imposto.cofins = {
            cst: fiscal.cst_cofins_internal || '07',
            vBC: 0,
            pCOFINS: 0,
            vCOFINS: 0
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

    const pag: NfePag = {
        detPag: [{
            tPag: tPag === '99' ? '15' : tPag, // Fallback 99 -> 15 (Boleto) to avoid Schema/Desc issues
            vPag: totalAmount
        }]
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
function mapAddress(addr: any, settings: any, contextName: string): NfeEndereco {
    if (!addr) {
        throw new Error(`Endereço obrigatório faltando para: ${contextName}`);
    }

    const requireAddr = (val: any, field: string) => {
        if (!val) throw new Error(`Campo de endereço '${field}' faltando para: ${contextName}`);
        return val;
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
