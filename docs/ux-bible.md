# Bíblia de UX do Desdobra

## 1.1 Princípios do Desdobra

- **Eficiência em Fluxos Longos**: O ERP é uma ferramenta de trabalho intenso. Priorizamos clareza e redução de cliques.
- **Consistência**: A mesma ação deve estar no mesmo lugar em todas as telas.
- **Ações Previsíveis**: O usuário deve saber o que acontece antes de clicar.
- **Salvar Sticky**: Em telas com rolagem (formulários longos), a barra de ações (Salvar) deve ficar fixa no topo.
- **Enriquecimento Progressivo**: Exibir apenas o essencial inicialmente. Campos avançados devem ser acessíveis, mas não poluir a primeira visão.

## 1.2 Regras de Layout (GLOBAL)

### Topbar (Global)
- **Localização**: Barra superior fixa da aplicação.
- **Conteúdo Esquerda**: Logo do Desdobra (Ícone + “Desdobra”).
- **Conteúdo Central/Direita**: A topbar principal da aplicação é "clean". O título da página pertence ao contexto da página (veja abaixo).

### Sidebar (Navegação)
- **Seletor de Empresa**: Deve ficar fixo na parte INFERIOR do menu lateral.
- **Estado**: O seletor deve ser visível tanto com a sidebar expandida quanto recolhida (ícone da empresa no recolhido).

### Header de Página (Conteúdo)
Todas as páginas internas (listagens, formulários, dashboards) devem ter uma faixa branca superior (Topbar de Conteúdo) contendo:
- **Esquerda**: Título da página (H1) grande e Breadcrumb pequeno logo abaixo.
- **Direita**: Ações principais da página (Botões Primários: Salvar, Novo, Filtrar).
- **Subtítulo**: O nome da empresa atual NÃO deve aparecer solto no topo.

## 1.3 Regra de Modais

- **PROIBIDO**: Modais para formulários longos (cadastros com abas, muitos campos, rolagem extensa).
- **PERMITIDO**:
    - Confirmações (Ex: "Tem certeza que deseja excluir?").
    - Ajustes rápidos (Ex: Editar uma categoria simples).
    - Criação de itens aninhados pequenos (Ex: "Novo Contato" rápido dentro de uma empresa).
- **Comportamento**:
    - Botão "X" no canto superior direito.
    - Fechar ao pressionar ESC.
    - Foco preso no modal (trap focus) enquanto aberto.

## 1.4 Padrão de Formulários (Cadastros)

Cadastros complexos (Pessoas, Empresas, Produtos) devem ser PÁGINAS próprias.

**Estrutura de URL**:
- Novo: `/app/cadastros/[entidade]/novo`
- Edição: `/app/cadastros/[entidade]/[id]`

**Layout**:
- **Header Sticky**: Faixa no topo contendo os botões de ação final.
    - Primário: "Salvar"
    - Secundário: "Salvar e Novo" (quando fizer sentido para cadastro em massa)
- **Rodapé**: Limpo. Não usar botão "Cancelar" no fim da página para voltar.
- **Navegação**: Link "Voltar" ou crumb no topo.

## 1.5 Padrão de Conteúdo por Seção

### Pessoas & Empresas (Cadastro Unificado/Híbrido)
- **Classificação**: Checkboxes para múltiplos papéis: Prospect, Cliente, Fornecedor, Transportadora.
- **Prospect**: Permitir cadastro SEM CPF/CNPJ.
- **Contatos**: Vinculados à empresa. Devem possuir:
    - Campo `Nome`, `Email`, `Telefone`.
    - Campo `Departamento` (Multi-select: Comercial, Financeiro, Compras, Logística, Fiscal, Direção, Outros).
    - Campo `Observações`.

### Configurações (Empresa)
- **Logo**: Deve ficar na aba "Identificação", próximo à Razão Social/CNPJ.
- **Certificado Digital (A1)**:
    - Aba dedicada ou seção clara "Certificado".
    - Layout lado a lado:
        - Card Esquerdo: Upload do arquivo `.pfx` / `.p12`.
        - Card Direito: Campo de senha + Toggle "Mostrar/Ocultar" + Botão de Validar.
- **Header**: Botão Salvar fixo no topo.
