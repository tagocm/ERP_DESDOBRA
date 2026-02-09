# Producao Ubuntu + Cloudflare Tunnel

## 1. Preparar servidor

```bash
sudo adduser --system --group --home /opt/erp-desdobra erp
sudo mkdir -p /opt/erp-desdobra /etc/erp-desdobra
sudo chown -R erp:erp /opt/erp-desdobra
```

Copie o projeto para `/opt/erp-desdobra` e o env para `/etc/erp-desdobra/env`:

```bash
sudo cp deploy/systemd/erp-desdobra.env.example /etc/erp-desdobra/env
sudo chown root:root /etc/erp-desdobra/env
sudo chmod 600 /etc/erp-desdobra/env
```

## 2. Validacao pre-go-live

Execute como usuario `erp`:

```bash
cd /opt/erp-desdobra
set -a && source /etc/erp-desdobra/env && set +a
./scripts/preflight-prod.sh /opt/erp-desdobra
```

## 3. Instalar services systemd

```bash
sudo cp deploy/systemd/erp-desdobra-web.service /etc/systemd/system/
sudo cp deploy/systemd/erp-desdobra-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable erp-desdobra-web erp-desdobra-worker
sudo systemctl start erp-desdobra-web erp-desdobra-worker
```

Verificacao:

```bash
sudo systemctl status erp-desdobra-web --no-pager
sudo systemctl status erp-desdobra-worker --no-pager
sudo journalctl -u erp-desdobra-web -n 100 --no-pager
sudo journalctl -u erp-desdobra-worker -n 100 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
```

## 4. Cloudflare Tunnel

Instale `cloudflared`, crie o tunnel e DNS:

```bash
cloudflared tunnel login
cloudflared tunnel create erp-desdobra
cloudflared tunnel route dns erp-desdobra erp.example.com
```

Copie e ajuste config:

```bash
sudo cp deploy/cloudflared/config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
```

Inicie o tunnel como service:

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

## 5. Checklist final

1. `erp-desdobra-web` ativo e com restart automatico.
2. `erp-desdobra-worker` ativo e consumindo fila.
3. `cloudflared` ativo e hostname resolvendo.
4. `NFE_ENVIRONMENT=producao`, sem flags debug.
5. `INTERNAL_API_TOKEN` definido.
6. Login, pedido, emissao e consulta de NFe validados em producao.

## 6. Validacao automatizada pos-deploy

Com app no ar:

```bash
cd /opt/erp-desdobra
set -a && source /etc/erp-desdobra/env && set +a
npm run smoke:prod -- http://127.0.0.1:3000 prod
npm run smoke:business -- http://127.0.0.1:3000 prod
npm run load:health -- http://127.0.0.1:3000 100 5
npm run load:health -- http://127.0.0.1:3000 200 20
```

Criterio de aprovacao minimo:

1. `smoke:prod` sem falhas.
2. `smoke:business` sem falhas.
3. `load:health` sem erros HTTP para 5 concorrentes.
4. `load:health` sem erros HTTP para 20 concorrentes.

Opcional (recomendado): gerar evidencia consolidada para decisao de go-live:

```bash
npm run go-live:report -- http://127.0.0.1:3000 prod 100 5 200 20
```

O relatorio sera salvo em `reports/go-live-<timestamp>.md`.

Atalho recomendado (executa tudo em sequencia):

```bash
npm run ops:go-live-gate -- /opt/erp-desdobra http://127.0.0.1:3000 prod 100 5 200 20
```

## 7. Rollback rapido

1. Pare servicos: `sudo systemctl stop erp-desdobra-web erp-desdobra-worker`.
2. Volte para a tag anterior no diretorio `/opt/erp-desdobra`.
3. Rode `npm ci` e `npm run build -- --webpack`.
4. Suba servicos novamente.

## 8. Scripts operacionais

Inventario completo de comandos e uso rapido em:

- `docs/OPERACOES_SCRIPTS.md`
