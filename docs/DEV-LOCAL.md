# Desenvolvimento local — RG Ambiental

Guia rápido para trabalhar no sistema em `C:\dev\rh-ambiental-sistema` sem corromper o projeto nem a lógica de faturamento.

## Antes de começar

1. Pasta **sempre** em `C:\dev\` — **nunca** OneDrive.
2. `npm run guard:projeto` — deve terminar com `OK`.
3. Copiar `.env` ou `.env.local` com `VITE_SUPABASE_URL` e chaves (não commitar).
4. `npm install` → `npm run dev` (porta **4173**).
5. **Tema escuro:** botão «Claro / Escuro» no cabeçalho (ao lado da presença); preferência também em Minha conta → Aparência.

## Fluxo Git (equipa)

```powershell
git pull origin main
# ... alterações ...
git pull --rebase origin main
git add ...
git commit -m "feat: ..."
git push origin main
```

Deploy produção: push em `main` → Vercel automático.

## Backup

| O quê | Comando |
|-------|---------|
| Código | `git push origin main` |
| `.env` local | `npm run backup:local` → `C:\dev\backups\rh-ambiental-sistema\` |

## Faturamento — o que **não** alterar sem processo formal

Lógica congelada (`2026-05-22.v1`). Ver `docs/faturamento-logica-aprovada.md`.

```powershell
npm run test:faturamento-guard
npm run guard:faturamento
```

Commit que mexe em ficheiros protegidos exige `[faturamento-logica]` na mensagem e variável `FATURAMENTO_LOGICA_APROVADA=1`.

## Diagnósticos e relatórios (cadastro × fila)

Requer `.env` com `VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

| Comando | O que faz |
|---------|-----------|
| `npm run diagnostico:saude-faturamento` | Saúde geral da fila (JSON em `scripts/`) |
| `npm run relatorio:contrato-fila` | Excel/CSV para a RG preencher valores de contrato |
| `npm run importar:contrato-planilha -- caminho.xlsx` | Prévia do import (dry-run) |
| `npm run importar:contrato-planilha -- caminho.xlsx --apply` | Grava cadastro a partir da planilha |
| `npm run migrar:contrato-legado` | Dry-run: JSONB vazio ← campos legado |
| `npm run migrar:contrato-legado -- --apply` | Aplica migração estrutural (sem inventar R$) |

Planilha publicada (download):

`https://raw.githubusercontent.com/nexuscoredev/rh-ambiental-sistema/main/public/assets/relatorios/contrato-fila-faturamento-2026-06-11.xlsx`

### Colunas que a RG preenche

- **`valor_corrigido`** — preço unitário do contrato
- **`residuo_contrato_correto`** — nome do resíduo (conferir sugestão)
- **`confirmado`** — `SIM` nas linhas a importar
- **`faturamento_minimo_kg_novo`** — opcional

## Verificação antes de publicar

```powershell
npm run lint
npm test
npm run build
npm run verify   # lint + build + test + guard faturamento
```

## Supabase (migrations)

```powershell
npm run db:apply:clientes-contrato
# Ver package.json → db:apply:* para outras migrations
```

Pendências agregadas: `supabase/scripts/PENDING_APPLY_JUN2026_EM_DIANTE.sql`

## Recuperação rápida

```powershell
git clone https://github.com/nexuscoredev/rh-ambiental-sistema.git C:\dev\rh-ambiental-sistema
cd C:\dev\rh-ambiental-sistema
copy C:\dev\backups\rh-ambiental-sistema\env-MAIS-RECENTE.txt .env
npm install
npm run dev
```
