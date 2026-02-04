import { XMLParser } from 'fast-xml-parser';
import { logger } from '@/lib/logger';

const DANFE_DEBUG = process.env.DANFE_DEBUG === '1' && process.env.NODE_ENV !== 'production';

export interface DanfeData {
    chaveAcesso?: string; // NEW: 44-digit access key
    ide: {
        cUF: string;
        cNF: string;
        natOp: string;
        mod: string;
        serie: string;
        nNF: string;
        dhEmi: string;
        dhSaiEnt?: string;
        tpNF: string; // 0-entrada, 1-saida
        idDest: string;
        cMunFG: string;
        tpImp: string; // 1-Retrato, 2-Paisagem
        tpEmis: string;
        tpAmb: string;
        finNFe: string;
        indFinal: string;
        indPres: string;
        procEmi: string;
        verProc: string;
    };
    emit: {
        cnpj: string;
        xNome: string;
        xFant?: string;
        enderEmit: {
            xLgr: string;
            nro: string;
            xBairro: string;
            cMun: string;
            xMun: string;
            uf: string;
            cep: string;
            cPais?: string;
            xPais?: string;
            fone?: string;
        };
        ie: string;
        iest?: string;
        crt: string;
    };
    dest?: {
        cnpj?: string;
        cpf?: string;
        xNome: string;
        enderDest: {
            xLgr: string;
            nro: string;
            xBairro: string;
            cMun: string;
            xMun: string;
            uf: string;
            cep: string;
            cPais?: string;
            xPais?: string;
            fone?: string;
        };
        indIEDest: string;
        ie?: string;
    };
    itens: Array<{
        nItem: number;
        cProd: string;
        cEAN: string;
        xProd: string;
        ncm: string;
        cfop: string;
        uCom: string;
        qCom: number;
        vUnCom: number;
        vProd: number;
        cEANTrib: string;
        uTrib: string;
        qTrib: number;
        vUnTrib: number;
        indTot: string;
        // Taxes (Simplified)
        vICMS?: number;
        pICMS?: number;
        vIPI?: number;
        pIPI?: number;
        pPIS?: number;
        pCOFINS?: number;
    }>;
    total: {
        vBC: number;
        vICMS: number;
        vICMSDeson: number;
        vFCP: number;
        vBCST: number;
        vST: number;
        vFCPST: number;
        vFCPSTRet: number;
        vProd: number;
        vFrete: number;
        vSeg: number;
        vDesc: number;
        vII: number;
        vIPI: number;
        vIPIDevol: number;
        vPIS: number;
        vCOFINS: number;
        vOutro: number;
        vNF: number;
    };
    transp: {
        modFrete: string;
        transporta?: {
            cnpj?: string;
            xNome?: string;
            ie?: string;
            xEnder?: string;
            xMun?: string;
            uf?: string;
        };
        veicTransp?: {
            placa?: string;
            uf?: string;
            rntc?: string;
        };
        vol?: Array<{
            qVol?: number;
            esp?: string;
            marca?: string;
            nVol?: string;
            pesoL?: number;
            pesoB?: number;
        }>;
    };
    cobr?: {
        fat?: {
            nFat?: string;
            vOrig?: number;
            vDesc?: number;
            vLiq?: number;
        };
        dup?: Array<{
            nDup?: string;
            dVenc?: string;
            vDup?: number;
        }>;
    };
    infAdic?: {
        infCpl?: string;
        infAdFisco?: string;
    };
    protNFe?: {
        chNFe: string;
        dhRecbto: string;
        nProt: string;
        cStat: string;
        xMotivo: string;
        tpAmb?: string; // NEW
    };
}

export function parseNfe(xml: string): DanfeData {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseTagValue: false // Keep everything as string to avoid stripping zeros from CNPJ/CPF/Keys
    });

    // Deal with potentially enveloped XML (nfeProc, enviNFe, or raw NFe)
    const parsed = parser.parse(xml);

    if (DANFE_DEBUG) logger.debug('[parseNfe] Parsed root keys:', Object.keys(parsed).join(', '));

    // Normalize Root - be extremely flexible to handle various structures
    let NFe = null;
    const nfeProc = parsed.nfeProc;

    // Try different paths to find the NFe node
    if (nfeProc?.NFe) {
        if (DANFE_DEBUG) logger.debug('[parseNfe] Found NFe in nfeProc.NFe');
        NFe = nfeProc.NFe;
    } else if (parsed.enviNFe?.NFe) {
        if (DANFE_DEBUG) logger.debug('[parseNfe] Found NFe in enviNFe.NFe');
        NFe = parsed.enviNFe.NFe;
    } else if (parsed.NFe) {
        if (DANFE_DEBUG) logger.debug('[parseNfe] Found NFe at root');
        NFe = parsed.NFe;
    } else {
        // Last resort: maybe it's directly the infNFe? (malformed but try to recover)
        if (DANFE_DEBUG) logger.debug('[parseNfe] No NFe found, checking if root is infNFe');
        if (parsed.infNFe) {
            if (DANFE_DEBUG) logger.debug('[parseNfe] Root is directly infNFe (malformed XML)');
            NFe = { infNFe: parsed.infNFe };
        }
    }

    const infNFe = NFe?.infNFe;

    if (!infNFe) {
        logger.warn('[parseNfe] Failed to find infNFe (invalid XML structure)', {
            rootKeys: Object.keys(parsed),
            nfeProcKeys: nfeProc ? Object.keys(nfeProc) : 'null',
            NFe: NFe ? Object.keys(NFe) : 'null'
        });
        throw new Error("Estrutura NFe/infNFe inválida no XML.");
    }

    if (DANFE_DEBUG) logger.debug('[parseNfe] Successfully found infNFe');
    const protNFe = nfeProc?.protNFe?.infProt || parsed.protNFe?.infProt;

    // Extract chave de acesso (44 digits) from infNFe/@Id or from protNFe
    let chaveAcesso: string | null = null;
    const infNFeId = infNFe['@_Id'];
    if (infNFeId) {
        // Remove "NFe" prefix if present
        chaveAcesso = infNFeId.replace(/^NFe/, '');
    } else if (protNFe?.chNFe) {
        chaveAcesso = protNFe.chNFe;
    }

    // Helper to extract array
    const toArray = (x: any) => Array.isArray(x) ? x : (x ? [x] : []);

    // --- Parsing Sections ---
    const ide = infNFe.ide;
    const emit = infNFe.emit;
    const dest = infNFe.dest;
    const det = toArray(infNFe.det);
    const total = infNFe.total?.ICMSTot || {};
    const transp = infNFe.transp || {};
    const cobr = infNFe.cobr || {};
    const infAdic = infNFe.infAdic || {};

    // Helper for numbers
    const num = (v: any) => parseFloat(v) || 0;

    return {
        chaveAcesso: chaveAcesso || undefined, // NEW: 44-digit access key
        protNFe: protNFe ? { // NEW: Full protocol info
            nProt: protNFe.nProt,
            dhRecbto: protNFe.dhRecbto,
            cStat: protNFe.cStat,
            xMotivo: protNFe.xMotivo,
            chNFe: protNFe.chNFe,
            tpAmb: protNFe.tpAmb
        } : undefined,
        ide: { ...ide },
        emit: {
            cnpj: emit.CNPJ,
            xNome: emit.xNome,
            xFant: emit.xFant,
            ie: emit.IE,
            iest: emit.IEST,
            crt: emit.CRT,
            enderEmit: {
                xLgr: emit.enderEmit.xLgr,
                nro: emit.enderEmit.nro,
                xBairro: emit.enderEmit.xBairro,
                cMun: emit.enderEmit.cMun,
                xMun: emit.enderEmit.xMun,
                uf: emit.enderEmit.UF,
                cep: emit.enderEmit.CEP,
                cPais: emit.enderEmit.cPais,
                xPais: emit.enderEmit.xPais,
                fone: emit.enderEmit.fone
            }
        },
        dest: dest ? {
            cnpj: dest.CNPJ,
            cpf: dest.CPF,
            xNome: dest.xNome,
            indIEDest: dest.indIEDest,
            ie: dest.IE,
            enderDest: {
                xLgr: dest.enderDest.xLgr,
                nro: dest.enderDest.nro,
                xBairro: dest.enderDest.xBairro,
                cMun: dest.enderDest.cMun,
                xMun: dest.enderDest.xMun,
                uf: dest.enderDest.UF,
                cep: dest.enderDest.CEP,
                cPais: dest.enderDest.cPais,
                xPais: dest.enderDest.xPais,
                fone: dest.enderDest.fone
            }
        } : undefined,
        itens: det.map((d: any) => {
            const { NCM, CFOP, ...restProd } = d.prod;
            return {
                nItem: parseInt(d["@_nItem"]),
                // Spread remaining prod fields (without NCM/CFOP)
                ...restProd,
                // Add NCM and CFOP in lowercase
                ncm: NCM,
                cfop: CFOP,
                qCom: num(d.prod.qCom),
                vUnCom: num(d.prod.vUnCom),
                vProd: num(d.prod.vProd),
                // Taxes
                imposto: d.imposto, // NEW: Keep full imposto object for renderer
                vICMS: num(d.imposto?.ICMS?.[Object.keys(d.imposto?.ICMS || {})[0]]?.vICMS),
                pICMS: num(d.imposto?.ICMS?.[Object.keys(d.imposto?.ICMS || {})[0]]?.pICMS),
                vIPI: num(d.imposto?.IPI?.IPITrib?.vIPI),
                pIPI: num(d.imposto?.IPI?.IPITrib?.pIPI),
            };
        }),
        total: {
            vBC: num(total.vBC),
            vICMS: num(total.vICMS),
            vICMSDeson: num(total.vICMSDeson),
            vFCP: num(total.vFCP),
            vBCST: num(total.vBCST),
            vST: num(total.vST),
            vFCPST: num(total.vFCPST),
            vFCPSTRet: num(total.vFCPSTRet),
            vProd: num(total.vProd),
            vFrete: num(total.vFrete),
            vSeg: num(total.vSeg),
            vDesc: num(total.vDesc),
            vII: num(total.vII),
            vIPI: num(total.vIPI),
            vIPIDevol: num(total.vIPIDevol),
            vPIS: num(total.vPIS),
            vCOFINS: num(total.vCOFINS),
            vOutro: num(total.vOutro),
            vNF: num(total.vNF),
        },
        transp: {
            modFrete: transp.modFrete,
            transporta: transp.transporta ? {
                cnpj: transp.transporta.CNPJ,
                xNome: transp.transporta.xNome,
                ie: transp.transporta.IE,
                xEnder: transp.transporta.xEnder,
                xMun: transp.transporta.xMun,
                uf: transp.transporta.UF
            } : undefined,
            veicTransp: transp.veicTransp ? {
                placa: transp.veicTransp.placa,
                uf: transp.veicTransp.UF,
                rntc: transp.veicTransp.RNTC
            } : undefined,
            vol: toArray(transp.vol).map((v: any) => ({
                qVol: num(v.qVol),
                esp: v.esp,
                marca: v.marca,
                nVol: v.nVol,
                pesoL: num(v.pesoL),
                pesoB: num(v.pesoB)
            }))
        },
        cobr: {
            fat: cobr.fat ? {
                nFat: cobr.fat.nFat,
                vOrig: num(cobr.fat.vOrig),
                vDesc: num(cobr.fat.vDesc),
                vLiq: num(cobr.fat.vLiq)
            } : undefined,
            dup: toArray(cobr.dup).map((d: any) => ({
                nDup: d.nDup,
                dVenc: d.dVenc,
                vDup: num(d.vDup)
            }))
        },
        infAdic: {
            infCpl: infAdic.infCpl,
            infAdFisco: infAdic.infAdFisco
        }
    };
}
