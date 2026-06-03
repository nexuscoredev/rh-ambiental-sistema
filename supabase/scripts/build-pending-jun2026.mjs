import fs from 'fs'
import path from 'path'

const files = [
  '20260601120000_chat_pedido_ajuste_feedback.sql',
  '20260601140000_rbac_visualizador_nao_revoga_comercial.sql',
  '20260602193000_operacional_frota.sql',
  '20260602220000_frota_acessos_rbac.sql',
  '20260602230000_login_reset_senha_chat.sql',
  '20260602240000_usuario_senha_pessoal_confirmacao.sql',
  '20260603130000_chat_pedido_ajuste_pedir_detalhes.sql',
  '20260627120000_comercial_lancar_pesagem_tickets.sql',
  '20260627140000_operacao_programacao_pesagem_lancar.sql',
  '20260701120000_clientes_gerenciador_mtr_peso_valor.sql',
  '20260702120000_chat_pedido_ajuste_aprovacao_thais.sql',
  '20260726130000_mtr_baixa_comercial_adm.sql',
  '20260801120000_operacao_time_r_cadastro_matheus_gabriel.sql',
  '20260802120000_chat_pedido_ajuste_config.sql',
  '20260803120000_chat_pedido_ajuste_escalacao_automatica_thais.sql',
  '20260804120000_chat_pedido_ajuste_sem_escalacao_automatica.sql',
  '20260805120000_chat_fila_thais_listar_pedidos.sql',
]

const out = 'supabase/scripts/PENDING_APPLY_JUN2026_EM_DIANTE.sql'
const dir = 'supabase/migrations'
const parts = [
  '-- =============================================================================',
  '-- SQL provável pendente (jun/2026 em diante) — cole no SQL Editor do Supabase',
  '-- Ordem: do mais antigo ao mais recente (já ordenado abaixo).',
  '-- Antes: rode o bloco de VERIFICACAO em supabase/scripts/VERIFICAR_MIGRATIONS_PENDENTES.sql',
  '-- =============================================================================',
  '',
]

for (const f of files) {
  const body = fs.readFileSync(path.join(dir, f), 'utf8').trimEnd()
  parts.push(`-- >>> BEGIN ${f}`, '', body, '', `-- <<< END ${f}`, '')
}

fs.writeFileSync(out, `${parts.join('\n')}\n`, 'utf8')
console.log(`Wrote ${files.length} migrations to ${out}`)
