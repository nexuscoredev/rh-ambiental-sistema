import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))

/** Chave anon de demonstração (Supabase) — só para importar módulos em testes sem .env/CI. */
const SUPABASE_TEST_PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export default defineConfig(({ mode }) => {
  const fromFile = loadEnv(mode, root, '')
  return {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      env: {
        VITE_SUPABASE_URL:
          fromFile.VITE_SUPABASE_URL?.trim() || 'https://ci-test-placeholder.supabase.co',
        VITE_SUPABASE_ANON_KEY:
          fromFile.VITE_SUPABASE_ANON_KEY?.trim() || SUPABASE_TEST_PLACEHOLDER_ANON_KEY,
      },
    },
  }
})
