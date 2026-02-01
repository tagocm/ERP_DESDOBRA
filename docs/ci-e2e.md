# Configuração de CI/E2E e GitHub Secrets

Para que os testes de ponta a ponta (E2E) funcionem no GitHub Actions, é necessário configurar as variáveis de ambiente do Supabase como Secrets no repositório.

## GitHub Secrets Necessários

Acesse seu repositório no GitHub e vá em **Settings** -> **Secrets and variables** -> **Actions** e adicione os seguintes secrets:

1. `NEXT_PUBLIC_SUPABASE_URL`: A URL do seu projeto Supabase (ex: `https://xxxx.supabase.co`).
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: A chave anônima (anon key) do seu projeto Supabase.
3. `SUPABASE_SERVICE_ROLE_KEY`: A chave de service role do seu projeto Supabase (necessária para ações administrativas no servidor).

### Onde encontrar estas chaves?

No Dashboard do Supabase:
1. Vá em **Project Settings**.
2. Clique em **API**.
3. Copie a **Project URL**, a **anon public** key e a **service_role secret**.

## Execução Local

Para rodar os testes E2E localmente com as mesmas chaves:
1. Certifique-se de ter um arquivo `.env.local` na raiz do projeto.
2. Adicione as chaves:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=sua_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
   ```
3. Execute o comando:
   ```bash
   npm run test:e2e
   ```

## Por que isso é necessário?

O aplicativo utiliza o Supabase para autenticação e dados no lado do cliente e do servidor. Sem estas chaves, o cliente do Supabase não pode ser inicializado, causando falhas no boot do servidor Next.js durante os testes automatizados.
