import { DanfeData } from './danfeParser';
import bwipjs from 'bwip-js';

async function generateBarcodeBase64(text: string, type: 'code128' | 'qrcode'): Promise<string> {
    try {
        const buffer = await bwipjs.toBuffer({
            bcid: type,
            text: text,
            scale: 3,
            height: 10,
            includetext: false,
            textxalign: 'center',
        });
        return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (e) {
        console.error('Barcode Error:', e);
        return '';
    }
}

function formatCnpj(v: string) {
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatCep(v: string) {
    return v.replace(/^(\d{5})(\d{3})/, "$1-$2");
}

function formatDate(v: string) {
    if (!v) return '';
    return new Date(v).toLocaleDateString('pt-BR');
}

function formatDateTime(v: string) {
    if (!v) return '';
    return new Date(v).toLocaleString('pt-BR');
}

function formatMoeda(v: number) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function formatChave(chave: string) {
    return chave.replace(/(\d{4})/g, '$1 ').trim();
}

function formatParcelaNumero(valor?: string) {
    if (!valor) return '-';
    const digits = String(valor).replace(/\D/g, '');
    if (!digits) return valor;
    const normalized = digits.padStart(5, '0').slice(-5);
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

// Helper to get CST or CSOSN based on CRT
function getCST(item: any, crt: string): string {
    const icms = item.imposto?.ICMS;
    if (!icms) return '';

    const icmsKey = Object.keys(icms)[0];
    if (!icmsKey) return '';

    const icmsData = icms[icmsKey];

    // CRT=1 → Simples → CSOSN (3 dígitos)
    if (crt === '1' && icmsData.CSOSN) {
        return icmsData.CSOSN;
    }

    // CRT=2 or 3 → Normal → CST
    if (icmsData.CST) {
        return icmsData.CST;
    }

    const orig = icmsData.orig || '0';
    const cst = icmsData.CST || '00';
    return `${orig}${cst}`;
}

export async function renderDanfeHtml(data: DanfeData): Promise<string> {
    const chave = data.chaveAcesso || data.protNFe?.chNFe || '';
    const barcodeImg = chave ? await generateBarcodeBase64(chave, 'code128') : '';
    const isHomologacao = data.ide.tpAmb === '2' || data.protNFe?.tpAmb === '2';

    const css = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        @page {
            size: 210mm 297mm;
            margin: 2mm;
        }

        body {
            font-family: 'Inter', Arial, sans-serif;
            font-size: 7pt;
            line-height: 1.2;
            color: #000;
        }

        .page {
            width: 206mm;
            min-height: 292mm;
            margin: 0 auto;
            background: white;
            display: flex;
            flex-direction: column;
        }

        /* Borders */
        .border { border: 0.5mm solid #000; }
        .border-thin { border: 0.2mm solid #000; }
        .border-top { border-top: 0.2mm solid #000; }
        .border-bottom { border-bottom: 0.2mm solid #000; }
        .border-left { border-left: 0.2mm solid #000; }
        .border-right { border-right: 0.2mm solid #000; }

        /* Layout */
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .gap-1 { gap: 1mm; }

        /* Field */
        .field {
            padding: 0.5mm 0.8mm;
            min-height: 6.5mm;
            position: relative;
        }
        .field-label {
            font-size: 5.5pt;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 0.2mm;
            color: #333;
        }
        .field-value {
            font-size: 7.3pt;
            font-weight: 600;
            color: #000;
            min-height: 2.2mm; /* Garante altura mesmo sem valor */
        }
        .field-small .field-value { font-size: 6.5pt; }

        /* Header blocks */
        .canhoto {
            height: 24mm;
            border: 0.5mm solid #000;
            margin-bottom: 2mm;
            display: flex;
        }

        .header {
            display: flex;
            height: 32mm;
            border: 0.5mm solid #000;
        }

        .emitente-box {
            width: 65mm;
            border-right: 0.2mm solid #000;
            padding: 0.5mm;
        }

        .danfe-box {
            flex: 1;
            border-right: 0.2mm solid #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 1.5mm;
        }

        .barcode-box {
            width: 105mm;
            padding: 1.5mm;
            display: flex;
            flex-direction: column;
        }

        .danfe-title {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 1mm;
        }

        .danfe-subtitle {
            font-size: 8pt;
            margin-bottom: 2mm;
        }

        .entrada-saida {
            display: flex;
            align-items: center;
            gap: 3mm;
            margin-top: 2mm;
        }

        .entrada-saida-box {
            width: 12mm;
            height: 12mm;
            border: 0.5mm solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14pt;
            font-weight: bold;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6pt;
        }
        
        th {
            background: #f0f0f0;
            font-weight: 700;
            text-transform: uppercase;
            padding: 0.7mm;
            border: 0.2mm solid #000;
            text-align: center;
        }
        
        td {
            padding: 0.6mm;
            border: 0.2mm solid #000;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        /* Section headers */
        .section-title {
            background: #000;
            color: #fff;
            padding: 0.6mm 1.6mm;
            font-size: 6.5pt;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 0.6mm;
        }

        /* Watermark */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100pt;
            font-weight: bold;
            color: rgba(255, 0, 0, 0.08);
            z-index: 9999;
            pointer-events: none;
            white-space: nowrap;
        }

        .w-4 { width: 4%; }
        .w-10 { width: 10%; }
        .w-15 { width: 15%; }
        .w-16 { width: 16%; }
        .w-20 { width: 20%; }
        .w-25 { width: 25%; }
        .w-30 { width: 30%; }
        .w-35 { width: 35%; }
        .w-40 { width: 40%; }
        .w-50 { width: 50%; }
        .w-60 { width: 60%; }
        .w-70 { width: 70%; }

        .parcelas-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0;
            border: 0.2mm solid #000;
            border-top: none; 
        }

        .parcela-card {
            border-right: 0.2mm solid #000;
            border-bottom: 0.2mm solid #000;
            padding: 0.5mm 0.8mm 0.6mm 0.8mm;
            min-height: 9mm;
        }

        .parcela-card:nth-child(4n) {
            border-right: none;
        }

        .parcela-line-label {
            font-size: 5.5pt;
            font-weight: 600;
            text-transform: uppercase;
            color: #333;
            margin-bottom: 0.2mm;
            line-height: 1.1;
        }

        .parcela-line-value {
            font-size: 6.8pt;
            font-weight: 700;
            margin-bottom: 0.3mm;
            line-height: 1.1;
        }
    `;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>${css}</style>
</head>
<body>
    ${(isHomologacao || !data.protNFe?.nProt) ? '<div class="watermark">SEM VALOR FISCAL</div>' : ''}
    
    <div class="page">
        <!-- CANHOTO -->
        <!-- CANHOTO + LINHA DE CORTE -->
        <div class="canhoto">
            <!-- Lado Esquerdo: Texto + Campos Assinatura -->
            <div style="flex: 1; display: flex; flex-direction: column;">
                <!-- Linha Superior: Texto Legal (Altura reduzida para caber apenas o label) -->
                <div class="field-label" style="padding: 1mm 1mm 0 1mm; height: 6mm; display: flex; align-items: flex-start; margin-bottom: 0; border-bottom: 0.2mm solid #000;">
                    RECEBEMOS DE ${data.emit.xNome} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
                </div>
                <!-- Linha Inferior: Campos (Data e Assinatura) ocupa o restante -->
                <div style="display: flex; flex: 1;">
                    <!-- Data de Recebimento -->
                    <div style="width: 35mm; border-right: 0.2mm solid #000; padding: 1mm;">
                        <div class="field-label">DATA DE RECEBIMENTO</div>
                    </div>
                    <!-- Assinatura -->
                    <div style="flex: 1; padding: 1mm;">
                        <div class="field-label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
                    </div>
                </div>
            </div>
            
            <!-- Lado Direito: Resumo NF-e (Largura aumentada) -->
            <div style="width: 42mm; border-left: 0.5mm solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #fff;">
                <div style="font-size: 10pt; font-weight: bold; margin-bottom: 1mm;">NF-e</div>
                <div style="font-size: 10pt; font-weight: bold;">Nº ${data.ide.nNF}</div>
                <div style="font-size: 8pt; font-weight: normal;">SÉRIE ${data.ide.serie}</div>
            </div>
        </div>
        <!-- Linha pontilhada de corte -->
        <div style="border-bottom: 0.5mm dashed #000; margin-bottom: 2mm; width: 100%;"></div>

        <!-- CABEÇALHO PRINCIPAL -->
        <div class="header">
            <!-- EMITENTE COM LOGO -->
            <div class="emitente-box">
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%; align-items: center; justify-content: flex-start; padding-top: 1.5mm;">
                    <!-- Logo container reduzido (50x15mm) -->
                    <div style="width: 50mm; height: 15mm; margin-bottom: 1mm; display: flex; align-items: center; justify-content: center; ${!(data as any).logoUrl ? 'border: 0.3mm solid #ddd;' : ''}">
                        ${(data as any).logoUrl
            ? `<img src="${(data as any).logoUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`
            : '<div style="font-size: 8pt; font-weight: bold; color: #999;">LOGO</div>'
        }
                    </div>
                    <!-- Dados do emitente logo abaixo -->
                    <div style="text-align: center; width: 100%;">
                        <div style="font-size: 6pt; font-weight: bold; line-height: 1.1; margin-bottom: 0.5mm;">${data.emit.xNome}</div>
                        <div style="font-size: 5pt; line-height: 1.2; margin-bottom: 0.5mm;">
                            ${data.emit.enderEmit.xLgr}, ${data.emit.enderEmit.nro} - ${data.emit.enderEmit.xBairro}<br>
                            ${data.emit.enderEmit.xMun}/${data.emit.enderEmit.uf} - CEP ${formatCep(data.emit.enderEmit.cep)}
                        </div>
                        <div style="font-size: 5pt; font-weight: 600; line-height: 1.2;">
                            CNPJ: ${formatCnpj(data.emit.cnpj)} | IE: ${data.emit.ie}
                        </div>
                    </div>
                </div>
            </div>

            <!-- DANFE -->
            <div class="danfe-box" style="padding: 1mm 0 1mm 0; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div class="danfe-title" style="margin-bottom: 0.5mm;">DANFE</div>
                    <div class="danfe-subtitle">Documento Auxiliar da Nota Fiscal Eletrônica</div>
                </div>
                
                <div style="display: flex; align-items: center; justify-content: center; gap: 3mm; margin-top: -1mm; margin-bottom: 0;">
                    <div style="font-size: 6pt; text-align: right; line-height: 1.2;">
                        0 - ENTRADA<br>
                        1 - SAÍDA
                    </div>
                    <div style="border: 0.5mm solid #000; width: 8mm; height: 8mm; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: bold;">
                        ${data.ide.tpNF}
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 0;">
                    <div style="font-size: 8pt; font-weight: bold;">Nº ${data.ide.nNF}</div>
                    <div style="font-size: 8pt; font-weight: bold;">SÉRIE ${data.ide.serie}</div>
                </div>
            </div>

            <!-- BARCODE E CHAVE -->
            <div class="barcode-box">
                <div style="height: 15mm; display: flex; align-items: center; justify-content: center; margin-bottom: 1mm;">
                    ${barcodeImg ? `<img src="${barcodeImg}" style="max-width: 100%; max-height: 100%;">` : ''}
                </div>
                <div class="field">
                    <div class="field-label" style="text-align: center; margin-bottom: 0.5mm;">CHAVE DE ACESSO</div>
                    <div style="font-size: 7pt; font-weight: 700; letter-spacing: 0.3mm; text-align: center; white-space: nowrap; overflow: visible;">
                        ${formatChave(chave)}
                    </div>
                </div>
                <div style="font-size: 5.5pt; text-align: center; margin-top: 1mm; line-height: 1.3;">
                    Consulta de autenticidade no portal nacional da NF-e<br>
                    www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora
                </div>
            </div>
        </div>

        <!-- NATUREZA DA OPERAÇÃO E PROTOCOLO -->
        <div class="flex border-thin" style="border-top: none;">
            <div class="field w-60 border-right">
                <div class="field-label">NATUREZA DA OPERAÇÃO</div>
                <div class="field-value">${data.ide.natOp}</div>
            </div>
            <div class="field w-40">
                <div class="field-label">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
                <div class="field-value">
                    ${data.protNFe?.nProt ? `${data.protNFe.nProt} - ${formatDateTime(data.protNFe.dhRecbto)}` : 'PENDENTE'}
                </div>
            </div>
        </div>

        <!-- INSCRIÇÃO ESTADUAL -->
        <div class="flex border-thin" style="border-top: none;">
            <div class="field w-35 border-right">
                <div class="field-label">INSCRIÇÃO ESTADUAL</div>
                <div class="field-value">${data.emit.ie}</div>
            </div>
            <div class="field w-35 border-right">
                <div class="field-label">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</div>
                <div class="field-value">${data.emit.iest || ''}</div>
            </div>
            <div class="field w-30">
                <div class="field-label">CNPJ</div>
                <div class="field-value">${formatCnpj(data.emit.cnpj)}</div>
            </div>
        </div>

        <!-- DESTINATÁRIO/REMETENTE -->
        <div class="section-title">DESTINATÁRIO / REMETENTE</div>
        
        <div class="flex border-thin">
            <div class="field w-60 border-right">
                <div class="field-label">NOME / RAZÃO SOCIAL</div>
                <div class="field-value">${data.dest?.xNome || ''}</div>
            </div>
            <div class="field w-25 border-right">
                <div class="field-label">CNPJ / CPF</div>
                <div class="field-value">${data.dest?.cnpj ? formatCnpj(data.dest.cnpj) : (data.dest?.cpf || '')}</div>
            </div>
            <div class="field w-15">
                <div class="field-label">DATA DA EMISSÃO</div>
                <div class="field-value">${formatDate(data.ide.dhEmi)}</div>
            </div>
        </div>

        <div class="flex border-thin" style="border-top: none;">
            <div class="field w-50 border-right">
                <div class="field-label">ENDEREÇO</div>
                <div class="field-value">${data.dest?.enderDest?.xLgr || ''}, ${data.dest?.enderDest?.nro || ''}</div>
            </div>
            <div class="field w-30 border-right">
                <div class="field-label">BAIRRO / DISTRITO</div>
                <div class="field-value">${data.dest?.enderDest?.xBairro || ''}</div>
            </div>
            <div class="field w-20">
                <div class="field-label">CEP</div>
                <div class="field-value">${data.dest?.enderDest?.cep ? formatCep(data.dest.enderDest.cep) : ''}</div>
            </div>
        </div>

        <div class="flex border-thin" style="border-top: none;">
            <div class="field w-40 border-right">
                <div class="field-label">MUNICÍPIO</div>
                <div class="field-value">${data.dest?.enderDest?.xMun || ''}</div>
            </div>
            <div class="field w-20 border-right">
                <div class="field-label">FONE / FAX</div>
                <div class="field-value">${data.dest?.enderDest?.fone || ''}</div>
            </div>
            <div class="field w-10 border-right">
                <div class="field-label">UF</div>
                <div class="field-value">${data.dest?.enderDest?.uf || ''}</div>
            </div>
            <div class="field w-30">
                <div class="field-label">INSCRIÇÃO ESTADUAL</div>
                <div class="field-value">${data.dest?.ie || ''}</div>
            </div>
        </div>

        <!-- CÁLCULO DO IMPOSTO -->
        <div class="section-title">CÁLCULO DO IMPOSTO</div>
        
        <div class="flex border-thin">
            <div class="field w-20 field-small border-right">
                <div class="field-label">BASE DE CÁLCULO DO ICMS</div>
                <div class="field-value text-right">${formatMoeda(data.total.vBC)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">VALOR DO ICMS</div>
                <div class="field-value text-right">${formatMoeda(data.total.vICMS)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">BASE DE CÁLCULO ICMS ST</div>
                <div class="field-value text-right">${formatMoeda(data.total.vBCST)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">VALOR DO ICMS ST</div>
                <div class="field-value text-right">${formatMoeda(data.total.vST)}</div>
            </div>
            <div class="field w-20 field-small">
                <div class="field-label">VALOR TOTAL DOS PRODUTOS</div>
                <div class="field-value text-right">${formatMoeda(data.total.vProd)}</div>
            </div>
        </div>

        <div class="flex border-thin" style="border-top: none;">
            <div class="field w-20 field-small border-right">
                <div class="field-label">VALOR DO FRETE</div>
                <div class="field-value text-right">${formatMoeda(data.total.vFrete)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">VALOR DO SEGURO</div>
                <div class="field-value text-right">${formatMoeda(data.total.vSeg)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">DESCONTO</div>
                <div class="field-value text-right">${formatMoeda(data.total.vDesc)}</div>
            </div>
            <div class="field w-20 field-small border-right">
                <div class="field-label">OUTRAS DESPESAS</div>
                <div class="field-value text-right">${formatMoeda(data.total.vOutro)}</div>
            </div>
            <div class="field w-20 field-small">
                <div class="field-label">VALOR TOTAL DA NOTA</div>
                <div class="field-value text-right">${formatMoeda(data.total.vNF)}</div>
            </div>
        </div>

        <!-- FATURA / PARCELAS -->
        <div class="section-title">FATURA / PARCELAS</div>

        ${(data.cobr?.dup?.length || 0) > 0 ? `
            <div class="parcelas-grid">
                ${data.cobr!.dup!.map((dup) => `
                    <div class="parcela-card">
                        <div class="parcela-line-label">PARCELA</div>
                        <div class="parcela-line-value">${formatParcelaNumero(dup.nDup)}</div>
                        <div class="parcela-line-label">VENCIMENTO</div>
                        <div class="parcela-line-value">${dup.dVenc ? formatDate(dup.dVenc) : '-'}</div>
                        <div class="parcela-line-label">VALOR</div>
                        <div class="parcela-line-value">R$ ${formatMoeda(dup.vDup || 0)}</div>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="flex border-thin" style="border-top: none;">
                <div class="field field-small" style="width: 100%;">
                    <div class="field-label">PARCELAS</div>
                    <div class="field-value">Sem parcelas informadas</div>
                </div>
            </div>
        `}

        <!-- DADOS DOS PRODUTOS -->
        <div class="section-title">DADOS DO PRODUTO / SERVIÇO</div>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 4%;">CÓD.</th>
                    <th style="width: 35%;">DESCRIÇÃO</th>
                    <th style="width: 6%;">NCM/SH</th>
                    <th style="width: 5%;">CST</th>
                    <th style="width: 5%;">CFOP</th>
                    <th style="width: 5%;">UN</th>
                    <th style="width: 7%;">QUANT.</th>
                    <th style="width: 10%;">V. UNIT</th>
                    <th style="width: 10%;">V. TOTAL</th>
                    <th style="width: 7%;">V. ICMS</th>
                    <th style="width: 6%;">V. IPI</th>
                </tr>
            </thead>
            <tbody>
                ${data.itens.map(item => `
                <tr>
                    <td>${item.cProd || ''}</td>
                    <td>${item.xProd || ''}</td>
                    <td class="text-center">${item.ncm || ''}</td>
                    <td class="text-center">${getCST(item, data.emit.crt)}</td>
                    <td class="text-center">${item.cfop || ''}</td>
                    <td class="text-center">${item.uCom || ''}</td>
                    <td class="text-right">${formatMoeda(item.qCom)}</td>
                    <td class="text-right">${formatMoeda(item.vUnCom)}</td>
                    <td class="text-right">${formatMoeda(item.vProd)}</td>
                    <td class="text-right">${formatMoeda(item.vICMS || 0)}</td>
                    <td class="text-right">${formatMoeda(item.vIPI || 0)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- FOOTER: TRANSPORTE E DADOS ADICIONAIS -->
        <div style="margin-top: auto; width: 100%;">
            
            <!-- TRANSPORTE / VOLUMES -->
            <div class="section-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
            <!-- FAIXA 1: DADOS DO TRANSPORTADOR (sempre reservada) -->
            <div class="flex border-thin">
                <div class="field w-50 field-small border-right">
                    <div class="field-label">RAZÃO SOCIAL</div>
                    <div class="field-value" style="font-weight: 500;">${data.transp?.transporta?.xNome || ''}</div>
                </div>
                <div class="field w-20 field-small border-right">
                    <div class="field-label">FRETE POR CONTA</div>
                    <div class="field-value text-center">${data.transp?.modFrete === '0' ? '0-Emitente' : data.transp?.modFrete === '1' ? '1-Destinat' : '9-Sem Frete'}</div>
                </div>
                <div class="field w-20 field-small border-right">
                    <div class="field-label">CNPJ/CPF</div>
                    <div class="field-value" style="font-family: 'Courier New', monospace; font-weight: 500;">${formatCnpj(data.transp?.transporta?.cnpj || '')}</div>
                </div>
                <div class="field w-10 field-small">
                    <div class="field-label">IE</div>
                    <div class="field-value" style="font-family: 'Courier New', monospace;">${data.transp?.transporta?.ie || ''}</div>
                </div>
            </div>

            <div class="flex border-thin" style="border-top: none;">
                <div class="field w-35 field-small border-right">
                    <div class="field-label">ENDEREÇO</div>
                    <div class="field-value">${data.transp?.transporta?.xEnder || ''}</div>
                </div>
                <div class="field w-20 field-small border-right">
                    <div class="field-label">MUNICÍPIO</div>
                    <div class="field-value">${data.transp?.transporta?.xMun || ''}</div>
                </div>
                <div class="field w-5 field-small border-right">
                    <div class="field-label">UF</div>
                    <div class="field-value text-center">${data.transp?.transporta?.uf || ''}</div>
                </div>
                <div class="field w-15 field-small border-right">
                    <div class="field-label">PLACA</div>
                    <div class="field-value" style="font-family: 'Courier New', monospace; font-weight: 500; text-transform: uppercase;">${data.transp?.veicTransp?.placa || ''}</div>
                </div>
                <div class="field w-5 field-small border-right">
                    <div class="field-label">UF</div>
                    <div class="field-value text-center">${data.transp?.veicTransp?.uf || ''}</div>
                </div>
                <div class="field w-20 field-small">
                    <div class="field-label">CÓD. ANTT/RNTRC</div>
                    <div class="field-value" style="font-family: 'Courier New', monospace;">${data.transp?.veicTransp?.rntc || ''}</div>
                </div>
            </div>
            <!-- FAIXA 3: VOLUMES -->
            <div class="flex border-thin" style="border-top: none; margin-bottom: 2mm;">
                <div class="field w-10 field-small border-right">
                    <div class="field-label">QUANTIDADE</div>
                    <div class="field-value">${data.transp?.vol?.[0]?.qVol || ''}</div>
                </div>
                <div class="field w-15 field-small border-right">
                    <div class="field-label">ESPÉCIE</div>
                    <div class="field-value">${data.transp?.vol?.[0]?.esp || ''}</div>
                </div>
                <div class="field w-15 field-small border-right">
                    <div class="field-label">MARCA</div>
                    <div class="field-value">${data.transp?.vol?.[0]?.marca || ''}</div>
                </div>
                <div class="field w-20 field-small border-right">
                    <div class="field-label">NUMERAÇÃO</div>
                    <div class="field-value">${data.transp?.vol?.[0]?.nVol || ''}</div>
                </div>
                <div class="field w-20 field-small border-right">
                    <div class="field-label">PESO BRUTO</div>
                    <div class="field-value">${formatMoeda(data.transp?.vol?.[0]?.pesoB || 0)}</div>
                </div>
                <div class="field w-20 field-small">
                    <div class="field-label">PESO LÍQUIDO</div>
                    <div class="field-value">${formatMoeda(data.transp?.vol?.[0]?.pesoL || 0)}</div>
                </div>
            </div>

            <!-- DADOS ADICIONAIS -->
            <div class="section-title">DADOS ADICIONAIS</div>
            
            <div class="flex border-thin" style="min-height: 25mm;">
                <div class="field w-70 field-small border-right">
                    <div class="field-label">INFORMAÇÕES COMPLEMENTARES</div>
                <div style="font-size: 6.5pt; line-height: 1.3; margin-top: 1mm;">
                    ${data.infAdic?.infCpl || ''}
                </div>
            </div>
            <div class="field w-30">
                <div class="field-label">RESERVADO AO FISCO</div>
                <div style="font-size: 6.5pt;">${data.infAdic?.infAdFisco || ''}</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}
