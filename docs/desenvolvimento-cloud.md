# Desenvolvimento via Cursor Cloud (RG Ambiental)

Guia curto: o que o agente faz sozinho e o que só você configura nos painéis.

## Fluxo normal (cada melhoria)

1. **Você** — Pede a alteração no Cursor (modo **Agent**).
2. **Agente** — Altera código, testa, abre Pull Request no GitHub.
3. **Você** — Revê o PR e faz **Merge** na branch `main`.
4. **Vercel** — Publica o site automaticamente (se o projeto já está ligado ao GitHub).
5. **Você** — Só se o PR trouxe SQL novo em `supabase/migrations/`: aplicar no Supabase (passo 4 abaixo).
6. **Você** — Só se mudou Edge Functions: deploy no Supabase (passo 5 abaixo).

Antes do merge em produção com mudança visível para utilizadores: o agente deve subir o `version` em `package.json` (regra em `.cursor/rules/deploy-versao-sistema.mdc`).

---

## Configuração única (sua parte manual)

### Passo 1 — Vercel: variáveis do site

1. Abra [vercel.com](https://vercel.com) → projeto **rh-ambiental-sistema**.
2. **Settings** → **Environment Variables**.
3. Confirme que existem (copie do Supabase → **Project Settings** → **API**):
   - `VITE_SUPABASE_URL` = URL do projeto (ex. `https://xxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` = chave **anon** / **public** (nunca a Service Role)
4. **Save** e, se pedir, faça **Redeploy** do último deploy de produção.

### Passo 2 — Vercel: ligação ao GitHub

1. No mesmo projeto: **Settings** → **Git**.
2. Confirme que o repositório ligado é o que você usa (ex. `nexuscoredev/rh-ambiental-sistema`).
3. Branch de produção: **`main`**.

### Passo 3 — Supabase: login no site

1. Abra [supabase.com](https://supabase.com) → seu projeto.
2. **Authentication** → **URL Configuration**.
3. Em **Site URL** e **Redirect URLs**, inclua:
   - `https://rh-ambiental-sistema.vercel.app`
   - `https://rh-ambiental-sistema.vercel.app/**`

### Passo 4 — Cursor Cloud: secrets do agente

1. No Cursor: definições do **Cloud Agent** / **Environment variables** (secrets).
2. Cole os mesmos nomes do ficheiro `.env.example` (valores reais, não os placeholders):
   - Obrigatório para o agente testar a app: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Opcional (scripts de base): `SUPABASE_DB_PASSWORD` ou `DATABASE_URL`
   - Opcional (deploy pela CLI): `VERCEL_TOKEN`
3. **Nunca** commite estas chaves no Git.

Lista completa de nomes: ver secção **Cursor Cloud** em `.env.example`.

### Passo 5 — (Opcional) Supabase no Cursor

1. Cursor Desktop → **MCP** → servidor **Supabase**.
2. **Authenticate** / ligar conta.
3. Assim o agente pode consultar o projeto remoto (tabelas, etc.) além dos ficheiros do repo.

### Passo 6 — (Opcional) GitHub Actions deploy manual

Só se quiser usar o botão **Run workflow** “Deploy Vercel (production)”:

1. GitHub → repositório → **Settings** → **Secrets and variables** → **Actions**.
2. Crie: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (valores no painel Vercel após `vercel link` ou em Project Settings).

---

## Quando o PR muda a base de dados

1. Abra o ficheiro SQL em `supabase/migrations/` (ou o script indicado no PR).
2. **Opção A** — Supabase Dashboard → **SQL Editor** → colar e **Run**.
3. **Opção B** — Com `DATABASE_URL` ou `SUPABASE_DB_PASSWORD` nas secrets do Cloud: pedir ao agente `npm run db:apply:sql -- caminho/do/ficheiro.sql` ou o script `db:apply:*` indicado no `package.json`.

---

## Quando o PR muda Edge Functions

1. Segredos: copiar `supabase/.secrets.edge.env.example` → `supabase/.secrets.edge.env` (só na sua máquina ou secrets; não commitar).
2. Na máquina com Supabase CLI logado, ou pedir ao agente com secrets:
   - `npm run supabase:link` (uma vez)
   - `npm run supabase:secrets:edge`
   - `npm run functions:deploy:admin-all` / `functions:deploy:send-nf-email` conforme o PR

---

## Checklist “estou pronto?”

- [ ] Vercel tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Vercel está ligada ao repo certo, branch `main`
- [ ] Supabase Auth tem a URL da Vercel
- [ ] Cursor Cloud tem pelo menos as duas variáveis `VITE_*`
- [ ] Sei: merge em `main` = site atualizado; SQL novo = passo extra no Supabase

Site oficial: `https://rh-ambiental-sistema.vercel.app`
