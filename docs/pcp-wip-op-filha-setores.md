# PCP: WIP + OP Filha (1 nível) + Setores mínimos

## Como modelar (WIP + Envase)
1. Cadastre o item WIP (ex.: `Granola Tradicional a Granel`) como `wip` e `is_produced = true`.
2. Cadastre a BOM do WIP com matérias-primas/insumos de produção.
3. Cadastre o item acabado (ex.: `Granola Tradicional 1kg`) como `finished_good`.
4. Na BOM do acabado, use o WIP + itens de embalagem/envase.
5. Evite matéria-prima direta no acabado. O sistema agora emite aviso forte para esse caso.

## Como usar os setores
1. Acesse `Produção > Setores de Produção`.
2. Crie os setores (mínimo recomendado):
- `PRODUCAO_GRANOLA`
- `ENVASE`
3. Ao criar OP, escolha o setor da OP mãe.
4. Se houver dependências WIP faltantes, o modal sugere setor para OPs filhas.

## Como funciona a geração com dependências
1. No modal de Nova OP, informe item, BOM, quantidade e data.
2. Clique em `Continuar`.
3. O sistema calcula dependências produzidas (`is_produced = true`) da BOM selecionada.
4. Para cada dependência faltante, calcula:
- Necessário
- Disponível (somente por `inventory_movements`)
- Falta
- Quantidade sugerida por receitas inteiras
5. Regra de arredondamento:
- `effective_yield = yield_qty * (1 - loss_percent/100)`
- `N = ceil(missing_qty / effective_yield)`
- `planned_qty_child = N * yield_qty`
6. Na confirmação, cria OP mãe + OPs filhas em uma operação transacional.

## Limitações atuais
- Somente 1 nível de dependência (acabado -> WIP).
- Não há recursão multinível.
- Não há reserva de estoque.
- Não altera o fluxo atual de baixa/ledger de produção.
