# Login em producao (Docker + Caddy + Cloudflare)

Este projeto usa **Supabase Auth** (nao NextAuth).

## 1) Sintoma tipico

- Login abre, clica em `Entrar` e nao redireciona.
- Em geral ocorre quando `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` nao foram injetadas no build/runtime do container.

## 2) Validacao rapida no servidor

No host:

```bash
cd /opt/erp-desdobra
bash scripts/ops/docker-auth-check.sh https://erp.martigran.com.br web
```

Se seu service no compose nao for `web`, troque o 2o parametro.

## 3) Checagem manual (se preciso)

```bash
curl -i https://erp.martigran.com.br/api/health
curl -i https://erp.martigran.com.br/api/auth/health
```

Dentro do container:

```bash
docker compose exec -T web sh -lc 'printenv | egrep "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY"'
```

## 4) Correcao quando env estiver faltando

1. Garanta `env_file:` e/ou `environment:` no `docker-compose.yml` para o service web.
2. Rebuild sem cache (env publica impacta bundle cliente):

```bash
docker compose build --no-cache web
docker compose up -d web
```

3. Valide novamente:

```bash
curl -i https://erp.martigran.com.br/api/auth/health
```

Esperado: `HTTP 200` com `{ "ok": true }`.

## 5) Criterio de aceite

- `/api/health` = 200
- `/api/auth/health` = 200
- Tela `/login` mostra erro amigavel quando credencial invalida
- Login redireciona para `/app` com credenciais validas
