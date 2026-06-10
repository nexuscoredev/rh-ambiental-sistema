# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

### Product overview

Single **React + Vite SPA** (`rg-ambiental-sistema`) for RG Ambiental. There is no backend in this repo — the frontend talks to **hosted Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions). Entry point: `src/App-NEXUS.tsx`.

### Services

| Service | Required? | Notes |
|---------|-----------|-------|
| **Node.js ≥ 20.19** + **npm** | Yes | Use `npm ci` (lockfile: `package-lock.json`, `.npmrc`: `legacy-peer-deps=true`). |
| **Vite dev server** | Yes (UI dev) | `npm run dev` → **http://localhost:4173** |
| **Supabase Cloud** | Yes (full E2E) | `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| **Supabase Edge Functions** | Optional | Deployed on Supabase; not run locally |
| **Docker / local Supabase** | No | Not used in this repo |

### Environment variables

Copy `.env.example` → `.env` and set:

- `VITE_SUPABASE_URL` — project URL (e.g. `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — **public anon / publishable key only** (JWT `eyJ…` or `sb_publishable_…`)

**Never** put `SUPABASE_SERVICE_ROLE_KEY` or `sb_secret_…` keys in `VITE_SUPABASE_ANON_KEY`. The Supabase client rejects secret keys in the browser (`Forbidden use of secret API key in browser`).

Optional for CLI scripts (seeds, migrations, `npm run admin:create-teste`):

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` or `SUPABASE_DB_PASSWORD` for `npm run db:apply:sql`

### Common commands

See `package.json` scripts. Typical agent workflow:

```bash
npm ci
npm run lint          # ESLint
npm test              # Vitest (uses placeholder Supabase env if .env missing)
npm run build         # tsc + Vite production build
npm run verify        # lint + build + test + guard:faturamento (CI parity)
npm run dev           # dev server on port 4173
```

Billing logic is frozen — see `.cursor/rules/faturamento-logica-congelada.mdc` before editing faturamento files.

### Gotchas

- **`predev` / `prebuild` / `postinstall`** run `guard:projeto` (blocks OneDrive paths — irrelevant on Linux cloud VMs).
- **Dev port is 4173**, not Vite’s default 5173.
- **Vitest** works without real Supabase credentials (placeholders in `vitest.config.ts`).
- **Full login E2E** requires a valid anon key and an existing user in Supabase Auth; bootstrap via `npm run admin:create-teste` needs `SUPABASE_SERVICE_ROLE_KEY`.
- **Version bumps**: increment `package.json` → `version` before production deploys (see `.cursor/rules/deploy-versao-sistema.mdc`).
