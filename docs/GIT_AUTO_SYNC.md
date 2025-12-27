# Git Auto-Sync Configuration

## Overview
O projeto está configurado para fazer backup automático no GitHub a cada 30 minutos.

## Arquivos Criados

### `/scripts/git-sync.sh`
Script que verifica mudanças e envia para o GitHub automaticamente.

### `/scripts/git-sync.log`
Log de todas as sincronizações automáticas (criado automaticamente).

## Como Funciona

- **Frequência**: A cada 30 minutos
- **Ação**: Se houver alterações, faz commit e push automático
- **Mensagem de Commit**: "Auto-sync: [data/hora]"

## Comandos Úteis

### Ver status do agendamento:
```bash
crontab -l
```

### Ver últimas sincronizações:
```bash
tail -f /Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA/scripts/git-sync.log
```

### Executar sincronização manual:
```bash
/Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA/scripts/git-sync.sh
```

### Desativar sincronização automática:
```bash
crontab -r
```

### Reativar (se desativado):
```bash
(crontab -l 2>/dev/null; echo "*/30 * * * * /Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA/scripts/git-sync.sh >> /Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA/scripts/git-sync.log 2>&1") | crontab -
```

## Observações Importantes

⚠️ **Permissão Total Disk Access**: No macOS, o cron precisa de permissão especial. Se não funcionar:
1. Vá em **System Settings** > **Privacy & Security** > **Full Disk Access**
2. Adicione `/usr/sbin/cron` à lista

⚠️ **Commits Automáticos**: Todos os arquivos modificados serão commitados automaticamente. Certifique-se de que:
- Arquivos sensíveis estão no `.gitignore`
- Você não deixa código incompleto no diretório

⚠️ **Conflitos**: Se você trabalhar em múltiplos computadores, pode haver conflitos. O script básico não trata pull automático.

## Primeira Execução
A primeira sincronização acontecerá nos próximos 30 minutos. Você pode testar imediatamente rodando:
```bash
/Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA/scripts/git-sync.sh
```
