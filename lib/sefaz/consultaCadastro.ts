import https from 'https';
import http from 'http';
import { parseStringPromise } from 'xml2js';

const CAD_DEBUG = process.env.CAD_DEBUG === '1';

interface ConsultaCadastroParams {
    uf: string;
    cnpj: string;
    environment?: 'homologacao' | 'producao';
}

interface ConsultaCadastroResult {
    success: boolean;
    ie?: string;
    situacao?: string;
    razaoSocial?: string;
    error?: string;
    rawResponse?: string; // For debugging
}

// SEFAZ endpoints by UF
const SEFAZ_ENDPOINTS: Record<string, { producao: string; homologacao: string }> = {
    SP: {
        producao: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx',
        homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
    },
    // Add other UFs as needed
    MG: {
        producao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4',
        homologacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/CadConsultaCadastro4'
    }
};

function buildSoapRequest(cnpj: string, uf: string): string {
    // Remove formatting from CNPJ
    const cnpjClean = cnpj.replace(/\D/g, '');

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:v1="http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4">
  <soap:Header/>
  <soap:Body>
    <v1:consultaCadastro>
      <v1:nfeDadosMsg>
        <ConsCad xmlns="http://www.portalfiscal.inf.br/nfe" versao="2.00">
          <infCons>
            <xServ>CONS-CAD</xServ>
            <UF>${uf}</UF>
            <CNPJ>${cnpjClean}</CNPJ>
          </infCons>
        </ConsCad>
      </v1:nfeDadosMsg>
    </v1:consultaCadastro>
  </soap:Body>
</soap:Envelope>`;
}

async function makeHttpRequest(
    url: string,
    soapRequest: string,
    timeoutMs: number = 5000
): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8',
                'Content-Length': Buffer.byteLength(soapRequest)
            },
            timeout: timeoutMs
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeoutMs}ms`));
        });

        req.write(soapRequest);
        req.end();
    });
}

async function parseResponse(xmlResponse: string): Promise<Partial<ConsultaCadastroResult>> {
    try {
        const parsed = await parseStringPromise(xmlResponse, {
            explicitArray: false,
            ignoreAttrs: false,
            tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')] // Remove namespaces
        });

        // Navigate response structure
        const body = parsed?.Envelope?.Body;
        const response = body?.consultaCadastroResponse || body?.nfeResultMsg;
        const retConsCad = response?.retConsCad || response;

        if (!retConsCad) {
            return { success: false, error: 'Invalid response structure' };
        }

        // Check for errors
        const cStat = retConsCad.infCons?.cStat || retConsCad.cStat;
        const xMotivo = retConsCad.infCons?.xMotivo || retConsCad.xMotivo;

        if (cStat !== '111') { // 111 = Consulta cadastro com uma ocorrência
            return {
                success: false,
                error: `SEFAZ returned status ${cStat}: ${xMotivo}`
            };
        }

        // Extract cadastro data from infCad (may be array or single object)
        const infCons = retConsCad.infCons;
        let infCad = infCons?.infCad;

        if (!infCad) {
            return { success: false, error: 'No cadastro data found' };
        }

        // Handle array
        if (Array.isArray(infCad)) {
            infCad = infCad[0]; // Use first result
        }

        return {
            success: true,
            ie: infCad.IE || undefined,
            situacao: infCad.cSit || infCad.indCredNFe || undefined,
            razaoSocial: infCad.xNome || undefined
        };
    } catch (error) {
        return {
            success: false,
            error: `XML parse error: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    initialDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (i < retries - 1) {
                const delay = initialDelayMs * Math.pow(2, i);
                if (CAD_DEBUG) {
                    console.log(`[CAD_DEBUG] Retry ${i + 1}/${retries} after ${delay}ms...`);
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

export async function consultaCadastroSefaz(
    params: ConsultaCadastroParams
): Promise<ConsultaCadastroResult> {
    const { uf, cnpj, environment = 'producao' } = params;

    const startTime = Date.now();

    if (CAD_DEBUG) {
        console.log('[CAD_DEBUG] ==> SEFAZ Consulta Cadastro Request', {
            uf,
            cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/****-$5'),
            environment,
            timestamp: new Date().toISOString()
        });
    }

    // Get endpoint
    const endpoints = SEFAZ_ENDPOINTS[uf];
    if (!endpoints) {
        return {
            success: false,
            error: `UF ${uf} not supported yet`
        };
    }

    const endpoint = endpoints[environment];
    const soapRequest = buildSoapRequest(cnpj, uf);

    if (CAD_DEBUG) {
        console.log('[CAD_DEBUG] Endpoint:', endpoint);
        console.log('[CAD_DEBUG] SOAP Request:', soapRequest);
    }

    try {
        // Make request with retry
        const xmlResponse = await retryWithBackoff(
            () => makeHttpRequest(endpoint, soapRequest, 5000),
            3,
            1000
        );

        if (CAD_DEBUG) {
            console.log('[CAD_DEBUG] SOAP Response:', xmlResponse);
        }

        // Parse response
        const result = await parseResponse(xmlResponse);
        const duration = Date.now() - startTime;

        if (CAD_DEBUG) {
            console.log('[CAD_DEBUG] <== Result', {
                ...result,
                durationMs: duration
            });
        }

        return {
            ...result,
            rawResponse: CAD_DEBUG ? xmlResponse : undefined
        } as ConsultaCadastroResult;

    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (CAD_DEBUG) {
            console.error('[CAD_DEBUG] <== Error', {
                error: errorMsg,
                durationMs: duration
            });
        }

        return {
            success: false,
            error: errorMsg
        };
    }
}
