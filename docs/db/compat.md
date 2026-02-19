# DB Compatibility Guide (Desdobra / Supabase)

Este documento registra decisões de compatibilidade de schema e regras para evitar regressões em `npx supabase db reset`.

## Objetivo
- Permitir `npx supabase db reset` do zero, sem erro.
- Manter seed idempotente.
- Manter compatibilidade com legado sem "quebrar produção" (quando aplicável).
- Evitar drift entre migrations e seed.

## Principais renomes / alinhamentos
O projeto consolidou alguns nomes. Sempre prefira os nomes atuais:

- `products` → `items`
- `code` → `sku`
- `unit` → `uom` (ou `uom_id` conforme tabela)
- `active` → `is_active`
- `postal_code` → `zip`
- `organizations.document` → `organizations.document_number`

> Regra: novos códigos **não** devem reintroduzir nomes antigos.

## Seed: regras de idempotência
- Seed **não** depende de `ON CONFLICT`, a menos que exista constraint única garantida e documentada.
- Preferir `INSERT ... SELECT ... WHERE NOT EXISTS (...)`.
- IDs determinísticos só quando necessário; caso contrário, buscar por chaves naturais (ex.: `company.slug`, `user.email`, `item.sku`).

## Enums e casts
- Campos de status devem respeitar os enums/checks atuais.
- Comparações entre enum e texto devem usar cast explícito (ex.: `status_logistic::text`).
- Valores de negócio permanecem em PT-BR quando definido pelo projeto.

## Views e mudanças de tipo/precisão
`CREATE OR REPLACE VIEW` não permite alterar tipo de uma coluna existente em alguns casos.
Estratégia padrão:
1. `DROP VIEW IF EXISTS ...` (derrubar dependentes explicitamente quando necessário)
2. Recriar view com a definição final
3. Garantir ordem/nomes de colunas estáveis

> Regra: quando precisar trocar precisão (ex.: numeric(15,4) → numeric(15,2)), faça isso via casts e recriação controlada.

## Triggers e colunas legadas
Quando for necessário remover coluna que tem dependência:
1. dropar/alterar trigger dependente
2. dropar coluna
3. recriar trigger atualizado (se ainda necessário)

> Regra: migrations não devem falhar por dependências ocultas de trigger.

## Política para migrations
- Evitar editar migrations antigas já consolidadas (especialmente se já aplicadas em ambientes reais).
- Preferir criar migrations novas de "fix/compat".
- Cada migration deve ser segura ao rodar em banco vazio (fresh reset).

## Como validar
- Local: `npx supabase db reset`
- CI: job obrigatório que roda `db reset` e falha o PR se quebrar.
