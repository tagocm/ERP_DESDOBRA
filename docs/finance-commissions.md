# Financeiro > Comissões (acerto por lote)

## Visão geral
O módulo de **Comissões** implementa acerto por representante com:
- itens liberados proporcionalmente pelos pagamentos do cliente;
- opção de adiantamento (respeitando teto entregue);
- alteração de taxa de comissão no próprio acerto com histórico/auditoria;
- confirmação transacional com idempotência.

## Fluxo operacional
1. Acesse `Financeiro > Comissões`.
2. Clique em **Novo acerto**.
3. Selecione representante e data de corte.
4. Clique em **Carregar pendências**.
5. Revise linhas por pedido e selecione os itens desejados.
6. (Opcional) Altere a taxa da comissão do pedido (ícone de lápis + motivo obrigatório).
7. Escolha modo:
   - **Pagar somente liberado**
   - **Permitir adiantamento**
8. Clique em **Confirmar acerto**.

## Regras-chave
- `default_selected` marca automaticamente apenas linhas com valor liberado.
- Linhas não liberadas ficam visíveis e podem ser selecionadas quando adiantamento estiver habilitado.
- O acerto usa lock por `company_id + rep_id` e `request_key` para evitar duplicidade.
- Um mesmo item de release/entitlement não pode entrar em dois acertos.

## Auditoria
- Alterações de taxa gravam histórico em `order_commission_rate_history`.
- Lançamentos em `rep_commission_ledger`:
  - `RELEASE` (quando pagamento do cliente libera comissão)
  - `PAYOUT` (na confirmação do acerto)
  - `ADJUSTMENT` (delta de alteração de taxa)

## Validação manual sugerida
1. Criar pedido com representante e taxa de comissão.
2. Registrar entrega parcial (gera entitlement proporcional).
3. Registrar pagamento parcial (gera release proporcional).
4. Abrir novo acerto e validar:
   - linha aparece com `Liberado` e `Não liberado` coerentes;
   - seleção automática apenas do liberado.
5. Confirmar acerto em modo somente liberado.
6. Repetir com adiantamento habilitado.
7. Alterar taxa no modal e confirmar que histórico foi gravado.
8. Tentar dupla confirmação simultânea para o mesmo representante e verificar que não duplica.

## Limitações atuais (MVP)
- A seleção no acerto é por item inteiro (não há rateio manual parcial por linha no frontend).
- O extrato detalhado por representante ainda está centrado no ledger e no detalhe do acerto.
