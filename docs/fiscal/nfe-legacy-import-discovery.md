# Descoberta técnica — Importação XML NF-e Legada

## Entidade escolhida
- **Tabela canônica de NF-e**: `public.nfe_emissions`.
- Motivo: já é a fonte principal da aba **NF-e Emitidas** (`lib/fiscal/nfe-actions.ts`, `fetchIssuedInvoices`) e do fluxo de estorno (`resolve-emission`, `reversal/*`).
- Tabela legada `sales_document_nfes` permanece apenas como compatibilidade/histórico.

## Fluxos mapeados
- **Listagem NF-e**: `app/app/fiscal/nfe/page.tsx` + `components/fiscal/InvoiceListClient.tsx` + `components/fiscal/IssuedInvoicesTable.tsx`.
- **Menu (⋯) e ação estorno**: `components/fiscal/IssuedInvoicesTable.tsx` (ação “Gerar NF-e de Entrada (Estorno)”).
- **Resolver emissão para ações fiscais**: `lib/fiscal/nfe/resolve-emission.ts`.
- **Criação da solicitação de estorno**: `app/api/fiscal/nfe/reversal/create/route.ts` + RPC `public.create_inbound_reversal_request`.
- **Processamento worker de estorno**: `lib/fiscal/nfe/reversal/emitInboundReversal.ts`.

## Campos-chave já existentes em `nfe_emissions`
- Identificação: `access_key`, `numero`, `serie`, `modelo`.
- Processo/SEFAZ: `status`, `c_stat`, `x_motivo`, `n_prot`, `tp_amb`, `authorized_at`.
- XMLs: `xml_unsigned`, `xml_signed`, `xml_sent`, `xml_nfe_proc`.
- Tenant/FKs: `company_id`, `sales_document_id`.

## Decisão para legado
- Reaproveitar `nfe_emissions` como base única para NF-e importada.
- Acrescentar metadados de origem legada e tabela filha para itens importados.
- Garantir idempotência por `(company_id, access_key)` e isolamento por empresa.
