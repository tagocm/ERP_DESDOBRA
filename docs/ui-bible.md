# UI Bible v1 — ERP Desdobra

> Documento vivo de padronização de Interface e UX.

## 1. App Shell (Global Layout)

### Sidebar
- **Posição:** Fixa à esquerda.
- **Topo:** Logo "Desdobra".
- **Busca:** Campo de busca global (atalho `⌘K`) logo abaixo do topo (opcional).
- **Menu:** Organizado em grupos lógicos:
  - **Comercial** (CRM, Vendas)
  - **Suprimentos & Produção** (Compras, Estoque, Produção)
  - **Administrativo** (Financeiro, Fiscal, RH)
  - **Sistema** (Cadastros, Configurações)
- **Rodapé:** Seletor de Empresa (`CompanySelector`) fixo no canto inferior.

### Top Header (Top Bar)
- **Estrutura:** Retângulo (barra) superior fixo, mesma altura do cabeçalho da Sidebar.
- **Conteúdo OBRIGATÓRIO (da Esquerda):**
  - Título da página (H1).
  - Subtítulo ou Breadcrumb (texto menor, cinza).
- **Conteúdo OBRIGATÓRIO (da Direita):**
  - Ações Globais da Página (ex: Botão "Salvar", "Novo").
  - Avatar do Usuário / Notificações (extremo direito).
- **Alinhamento:** O Top Header deve criar uma linha visual contínua com o topo da Sidebar.

## 2. Padrão de Páginas

### Listagem (Index)
- **Header:** `PageHeader` com Título, Subtítulo e Ação Principal (ex: "Novo").
- **Filtros:** Barra de filtros abaixo do header (Busca, Selects, Data).
- **Dados:** Tabela (`DataTable`) ou Cards (Grid).
- **Paginação:** Rodapé da tabela.

### Cadastros (Forms)
- **Navegação:** SEMPRE em página dedicada (Full Page). **NÃO usar Modais** para cadastros complexos.
- **Header:**
  - Título: "Novo [Entidade]" ou "[Nome da Entidade]" (edição).
  - Ações: Botão "Salvar" (Primário) e "Salvar e Novo" (Secundário) no Topo (Sticky).
- **Rodapé:** SEM botões de ação (Salvar/Cancelar) no rodapé da página.
- **Layout:**
  - Uso de **Abas** (`Tabs`) para organizar campos.
  - Abas começam imediatamente abaixo do `PageHeader`.

### Modais (Dialogs)
- **Uso Estrito:** Apenas para "Quick Actions" ou inputs simples.
- **Limite:** Máximo 5-7 campos.
- **Exemplos:** Adicionar Endereço, Novo Contato Rápido, Editar Observação.

## 3. Componentes Padrão

### `<PageHeader />`
Componente padrão para título e ações.
- **Props:** `title`, `subtitle`, `rightSlot` (ações), `sticky` (boolean), `children` (para Tabs).
- **Comportamento:** `sticky` deve ser `true` para formulários longos.

### `<Tabs />`
- Estilo horizontal, linha simples.
- Padding consistente abaixo do Header.

### Feedback
- **Sucesso/Erro:** Toasts (canto superior direito) ou Alertas inline no topo do form.
- **Validação:** "Salvar" aciona validação. Se houver erro em outra aba, mostrar alerta no topo e marcar a aba com indicador de erro (ex: ponto vermelho).

## 4. Estilo Visual
- **Espaçamento:** Generoso (Comfortable). Evitar telas "espremidas".
- **Cores:**
  - Ações Primárias: Brand Color.
  - Ações Destrutivas: Vermelho.
  - Texto: Cinza 900 (Títulos), Cinza 500 (Subtítulos).
- **Campos:** Titles Case automático onde aplicável (Nomes, Endereços). E-mails em lowercase.
