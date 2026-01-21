// Endpoints para SP (São Paulo) - Modelo 55 (NF-e)
// Fonte: http://www.nfe.fazenda.gov.br/portal/WebServices.aspx
// Atualizado: 2026-01-16

export const SEFAZ_ENDPOINTS = {
    SP: {
        homologacao: {
            NFeAutorizacao4: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
            NFeRetAutorizacao4: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx",
            NFeStatusServico4: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
            NFeConsultaProtocolo4: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx"
        },
        producao: {
            NFeAutorizacao4: "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
            NFeRetAutorizacao4: "https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx",
            NFeStatusServico4: "https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
            NFeConsultaProtocolo4: "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx"
        }
    },
    GO: {
        homologacao: {
            NFeAutorizacao4: "https://homolog.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
            NFeRetAutorizacao4: "https://homolog.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4",
            NFeStatusServico4: "https://homolog.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
            NFeConsultaProtocolo4: "https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4"
        },
        producao: {
            NFeAutorizacao4: "https://nfe.sefaz.go.gov.br/nfe/services/NFeAutorizacao4",
            NFeRetAutorizacao4: "https://nfe.sefaz.go.gov.br/nfe/services/NFeRetAutorizacao4",
            NFeStatusServico4: "https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4",
            NFeConsultaProtocolo4: "https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4"
        }
    }
};

export type SefazService = "NFeAutorizacao4" | "NFeRetAutorizacao4" | "NFeStatusServico4" | "NFeConsultaProtocolo4";

export function getSefazUrl(uf: string, amb: "1" | "2", service: SefazService): string {
    const env = amb === "2" ? "homologacao" : "producao";

    // @ts-ignore - dynamic access
    const ufConfig = SEFAZ_ENDPOINTS[uf];

    if (!ufConfig) {
        throw new Error(`UF ${uf} não configurada em endpoints.ts`);
    }

    const url = ufConfig[env]?.[service];

    if (!url) {
        throw new Error(`Endpoint ${service} não configurado para UF=${uf} Amb=${env}`);
    }

    return url;
}
