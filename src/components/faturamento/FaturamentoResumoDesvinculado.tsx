import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  aplicarPesoLiquidoMtrNoResumo,
  parseNumeroCampo,
  recalcularResiduoMtr,
  totalResumoMtr,
  type ResumoFinanceiroDesvinculado,
  type ResumoMtrFinanceiro,
  type ResumoTicketFinanceiro,
} from '../../lib/faturamentoDesvinculacao'
import type { PrecoBreakdownLinha } from '../../lib/faturamentoPrecoContrato'
import {
  CHAVE_VEICULO_MANUAL,
  aplicarVeiculoContratoAoResumoMtr,
  chaveVeiculoSelecionadoNoResumo,
  listarVeiculosContratoFaturamento,
  rotuloOpcaoVeiculoContrato,
  sugerirVeiculoContratoParaHints,
} from '../../lib/faturamentoVeiculoContratoUi'
import { FaturamentoDetalheConta } from './FaturamentoDetalheConta'

const card: CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const label: CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '4px',
}

const input: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const grid3: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '10px',
}

const grid2: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
}

const thMini: CSSProperties = {
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#64748b',
  padding: '8px 10px',
  borderBottom: '1px solid #e2e8f0',
  background: '#f1f5f9',
}

const tdMini: CSSProperties = {
  padding: '8px 10px',
  fontSize: '12px',
  color: '#0f172a',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'top',
}

type Props = {
  resumo: ResumoFinanceiroDesvinculado
  onChange: (next: ResumoFinanceiroDesvinculado) => void
  /** Edição dos blocos ticket/MTR — exclusivo Operacional (Time T) (+ admin). */
  podeEditarResumos: boolean
  /** Acréscimo e desconto no total — exclusivo Operacional (Time T) (+ admin). */
  podeEditarAjustes?: boolean
  onRecarregarTicket?: () => void
  onRecarregarMtr?: () => void
  onAplicarContratoMtr?: () => void
  carregandoSugestao?: boolean
  /** Referência do contrato/regra para conferência no detalhamento. */
  referenciaConta?: {
    total: number
    origemLabel: string
    linhas: PrecoBreakdownLinha[]
  } | null
  diferencaConta?: number | null
  /** Após alterar peso MTR (kg): recalcular valores do contrato no resumo, se fornecido. */
  onAposPesoMtrAlterado?: (resumo: ResumoFinanceiroDesvinculado) => ResumoFinanceiroDesvinculado
  /** Lista de veículos do contrato do cliente (dropdown de caminhão a cobrar). */
  veiculosContratoRaw?: unknown
  tipoCaminhaoProgramacao?: string | null
  acondicionamentoMtr?: string | null
  descricaoVeiculoLegado?: string | null
}

function fmtBrlLocal(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function FaturamentoResumoDesvinculadoInner({
  resumo,
  onChange,
  podeEditarResumos,
  podeEditarAjustes,
  onRecarregarTicket,
  onRecarregarMtr,
  onAplicarContratoMtr,
  carregandoSugestao,
  referenciaConta,
  diferencaConta,
  onAposPesoMtrAlterado,
  veiculosContratoRaw,
  tipoCaminhaoProgramacao,
  acondicionamentoMtr,
  descricaoVeiculoLegado,
}: Props) {
  const podeEditar = podeEditarResumos && !resumo.ticket_encerrado_definitivo
  const podeAjustar = (podeEditarAjustes ?? podeEditarResumos) && !resumo.ticket_encerrado_definitivo
  const ticketConsolidado = Boolean(resumo.ticket.eh_consolidado_mtr)
  const linhasTickets = resumo.ticket.linhas_tickets ?? []
  const totalMtr = useMemo(() => totalResumoMtr(resumo.mtr), [resumo.mtr])
  const caminhaoMtrNum = useMemo(
    () => parseNumeroCampo(resumo.mtr.caminhao_valor),
    [resumo.mtr.caminhao_valor]
  )
  const equipMtrNum = useMemo(
    () => parseNumeroCampo(resumo.mtr.equipamento_valor),
    [resumo.mtr.equipamento_valor]
  )
  const maoObraMtrNum = useMemo(
    () => parseNumeroCampo(resumo.mtr.mao_obra_valor),
    [resumo.mtr.mao_obra_valor]
  )
  const residuoMtrNum = useMemo(
    () => parseNumeroCampo(resumo.mtr.residuo_valor),
    [resumo.mtr.residuo_valor]
  )
  const acrescimoNum = useMemo(
    () => parseNumeroCampo(resumo.ajustes?.acrescimo ?? ''),
    [resumo.ajustes?.acrescimo]
  )
  const descontoNum = useMemo(
    () => parseNumeroCampo(resumo.ajustes?.desconto ?? ''),
    [resumo.ajustes?.desconto]
  )

  const veiculosContrato = useMemo(
    () => listarVeiculosContratoFaturamento(veiculosContratoRaw),
    [veiculosContratoRaw]
  )
  const veiculoSugeridoProgramacao = useMemo(
    () =>
      sugerirVeiculoContratoParaHints(veiculosContratoRaw, {
        tipoCaminhaoProgramacao,
        acondicionamentoMtr,
        descricaoVeiculoLegado,
      }),
    [veiculosContratoRaw, tipoCaminhaoProgramacao, acondicionamentoMtr, descricaoVeiculoLegado]
  )
  const chaveVeiculoDerivada = useMemo(
    () => chaveVeiculoSelecionadoNoResumo(veiculosContrato, resumo),
    [veiculosContrato, resumo]
  )
  const [chaveVeiculoUi, setChaveVeiculoUi] = useState<string | null>(null)
  useEffect(() => {
    if (chaveVeiculoDerivada !== CHAVE_VEICULO_MANUAL) {
      setChaveVeiculoUi(null)
    }
  }, [chaveVeiculoDerivada])
  const chaveVeiculoExibida = chaveVeiculoUi ?? chaveVeiculoDerivada
  const modoVeiculoManual =
    veiculosContrato.length === 0 || chaveVeiculoExibida === CHAVE_VEICULO_MANUAL

  const patchTicket = useCallback(
    (partial: Partial<ResumoTicketFinanceiro>) => {
      onChange({ ...resumo, ticket: { ...resumo.ticket, ...partial } })
    },
    [onChange, resumo]
  )

  const patchMtr = useCallback(
    (partial: Partial<ResumoMtrFinanceiro>) => {
      const next = { ...resumo.mtr, ...partial }
      onChange({ ...resumo, mtr: recalcularResiduoMtr(next) })
    },
    [onChange, resumo]
  )

  const patchMtrSemRecalc = useCallback(
    (partial: Partial<ResumoMtrFinanceiro>) => {
      onChange({ ...resumo, mtr: { ...resumo.mtr, ...partial } })
    },
    [onChange, resumo]
  )

  const patchAjustes = useCallback(
    (partial: { acrescimo?: string; desconto?: string }) => {
      onChange({ ...resumo, ajustes: { ...resumo.ajustes, ...partial } })
    },
    [onChange, resumo]
  )

  const alterarPesoLiquidoMtr = useCallback(
    (pesoStr: string) => {
      let next = aplicarPesoLiquidoMtrNoResumo(resumo, pesoStr)
      const pesoNum = parseNumeroCampo(pesoStr)
      if (pesoNum > 0 && onAposPesoMtrAlterado) {
        next = onAposPesoMtrAlterado(next)
      }
      onChange(next)
    },
    [onChange, onAposPesoMtrAlterado, resumo]
  )

  return (
    <>
      <div
        style={{
          marginBottom: '12px',
          padding: '10px 12px',
          borderRadius: '10px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          fontSize: '12px',
          color: '#1e40af',
          lineHeight: 1.45,
        }}
      >
        <strong>Sincronização com operacional:</strong> ao editar, os valores são gravados no
        registo de faturamento e <strong>espelhados na MTR</strong> (caminhão, equipamento, mão de obra, resíduo) e no{' '}
        <strong>ticket</strong> (pesos e resíduos nas coletas), após uma breve pausa ou ao guardar.
        {!podeEditarResumos ? (
          <>
            {' '}
            <strong>Resumos editáveis apenas para Operacional (Time T).</strong>
          </>
        ) : null}
      </div>

      {resumo.ticket_encerrado_definitivo ? (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            fontSize: '12px',
            color: '#047857',
            fontWeight: 700,
          }}
        >
          Ticket encerrado definitivamente no faturamento
          {resumo.ticket_encerrado_em
            ? ` · ${new Date(resumo.ticket_encerrado_em).toLocaleString('pt-BR')}`
            : ''}
        </div>
      ) : null}

      <div style={card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
              Resumo do ticket {podeEditar ? '(editável)' : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {ticketConsolidado
                ? `${linhasTickets.length} tickets nesta MTR — cada linha abaixo é um ticket com o resíduo dele`
                : 'Pesagem / comprovante operacional (todos os resíduos deste ticket)'}
            </div>
          </div>
          {onRecarregarTicket && podeEditar ? (
            <button
              type="button"
              onClick={onRecarregarTicket}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Recarregar do operacional
            </button>
          ) : null}
        </div>

        {linhasTickets.length > 0 ? (
          <div className="rg-mobile-table-scroll" style={{ marginBottom: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={thMini}>Coleta</th>
                  <th style={thMini}>Ticket</th>
                  <th style={thMini}>Resíduo(s)</th>
                  <th style={thMini}>Tara</th>
                  <th style={thMini}>Bruto</th>
                  <th style={thMini}>Líq.</th>
                </tr>
              </thead>
              <tbody>
                {linhasTickets.map((l, idx) => (
                  <tr key={`${l.coleta_numero}-${l.ticket_numero}-${idx}`}>
                    <td style={{ ...tdMini, fontWeight: 700 }}>{l.coleta_numero}</td>
                    <td style={{ ...tdMini, fontWeight: 700 }}>{l.ticket_numero}</td>
                    <td style={{ ...tdMini, minWidth: 180, lineHeight: 1.45 }}>{l.residuo}</td>
                    <td style={tdMini}>{l.peso_tara_kg ? `${l.peso_tara_kg} kg` : '—'}</td>
                    <td style={tdMini}>{l.peso_bruto_kg ? `${l.peso_bruto_kg} kg` : '—'}</td>
                    <td style={{ ...tdMini, fontWeight: 800 }}>
                      {l.peso_liquido_kg ? `${l.peso_liquido_kg} kg` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {ticketConsolidado ? (
          <div style={{ marginBottom: '10px' }}>
            <label style={label}>Total líquido (soma dos tickets)</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.ticket.peso_liquido_kg}
              onChange={(e) => patchTicket({ peso_liquido_kg: e.target.value })}
            />
          </div>
        ) : (
          <div className="rg-mobile-stack-grid" style={{ ...grid3, marginBottom: '10px' }}>
            <div>
              <label style={label}>Tara (kg)</label>
              <input
                style={input}
                disabled={!podeEditar}
                readOnly={!podeEditar}
                inputMode="decimal"
                value={resumo.ticket.peso_tara_kg}
                onChange={(e) => patchTicket({ peso_tara_kg: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Bruto (kg)</label>
              <input
                style={input}
                disabled={!podeEditar}
                readOnly={!podeEditar}
                inputMode="decimal"
                value={resumo.ticket.peso_bruto_kg}
                onChange={(e) => patchTicket({ peso_bruto_kg: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Líquido (kg)</label>
              <input
                style={input}
                disabled={!podeEditar}
                readOnly={!podeEditar}
                inputMode="decimal"
                value={resumo.ticket.peso_liquido_kg}
                onChange={(e) => patchTicket({ peso_liquido_kg: e.target.value })}
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: '10px' }}>
          <label style={label}>
            Resíduos no ticket {linhasTickets.length > 1 ? `(${linhasTickets.length} tickets)` : ''}
          </label>
          <textarea
            style={{
              ...input,
              minHeight: ticketConsolidado ? 88 : 56,
              resize: 'vertical',
              lineHeight: 1.45,
              fontFamily: 'inherit',
            }}
            disabled={!podeEditar}
            readOnly={!podeEditar}
            value={resumo.ticket.tipo_residuo}
            onChange={(e) => patchTicket({ tipo_residuo: e.target.value })}
            rows={ticketConsolidado ? 4 : 2}
          />
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Lista completa para conferência e NF. Use «Recarregar do operacional» para atualizar a partir
            das coletas.
          </div>
        </div>

        <div style={{ marginBottom: '4px' }}>
          <label style={label}>Valor ticket (R$)</label>
          <input
            style={input}
            disabled={!podeEditar}
            readOnly={!podeEditar}
            inputMode="decimal"
            value={resumo.ticket.valor_total}
            onChange={(e) => patchTicket({ valor_total: e.target.value })}
            placeholder="0,00"
          />
        </div>
      </div>

      <div style={{ ...card, borderColor: '#a7f3d0', background: '#f0fdf4' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
              Resumo da MTR {podeEditar ? '(editável)' : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Caminhão + equipamento + mão de obra + resíduo
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {onAplicarContratoMtr && podeEditar ? (
              <button
                type="button"
                disabled={carregandoSugestao}
                onClick={onAplicarContratoMtr}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #0d9488',
                  background: '#fff',
                  color: '#0f766e',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: carregandoSugestao ? 'wait' : 'pointer',
                }}
              >
                {carregandoSugestao ? 'A carregar…' : 'Preços do contrato'}
              </button>
            ) : null}
            {onRecarregarMtr && podeEditar ? (
              <button
                type="button"
                onClick={onRecarregarMtr}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Recarregar do operacional
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ ...grid2, marginBottom: '10px' }}>
          <div style={{ gridColumn: veiculosContrato.length > 0 ? '1 / -1' : undefined }}>
            {veiculosContrato.length > 0 ? (
              <>
                <label style={label}>Caminhão a cobrar (contrato)</label>
                <select
                  style={{ ...input, marginBottom: '6px', cursor: podeEditar ? 'pointer' : 'not-allowed' }}
                  disabled={!podeEditar}
                  value={chaveVeiculoExibida}
                  onChange={(e) => {
                    const chave = e.target.value
                    if (chave === CHAVE_VEICULO_MANUAL) {
                      setChaveVeiculoUi(CHAVE_VEICULO_MANUAL)
                      return
                    }
                    setChaveVeiculoUi(null)
                    const idx = Number(chave)
                    const veiculo = veiculosContrato[idx]
                    if (veiculo) onChange(aplicarVeiculoContratoAoResumoMtr(resumo, veiculo))
                  }}
                >
                  {veiculosContrato.map((v, i) => (
                    <option key={`${v.tipo_veiculo}-${i}`} value={String(i)}>
                      {rotuloOpcaoVeiculoContrato(v)}
                    </option>
                  ))}
                  <option value={CHAVE_VEICULO_MANUAL}>Outro — editar manualmente</option>
                </select>
                {(tipoCaminhaoProgramacao?.trim() || veiculoSugeridoProgramacao) && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px', lineHeight: 1.45 }}>
                    {tipoCaminhaoProgramacao?.trim() ? (
                      <>
                        <strong>Programação:</strong> {tipoCaminhaoProgramacao.trim()}
                      </>
                    ) : null}
                    {veiculoSugeridoProgramacao ? (
                      <>
                        {tipoCaminhaoProgramacao?.trim() ? ' · ' : ''}
                        <strong>Sugestão:</strong> {veiculoSugeridoProgramacao.tipo_veiculo.trim()}
                      </>
                    ) : null}
                    {podeEditar && veiculoSugeridoProgramacao && modoVeiculoManual ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={() =>
                            onChange(aplicarVeiculoContratoAoResumoMtr(resumo, veiculoSugeridoProgramacao))
                          }
                          style={{
                            marginLeft: '4px',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            color: '#0f766e',
                            fontWeight: 700,
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Aplicar sugestão
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
                {!modoVeiculoManual ? (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#334155',
                      marginBottom: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <strong>{resumo.mtr.caminhao_rotulo.trim() || '—'}</strong>
                    {' · '}
                    {caminhaoMtrNum > 0 ? fmtBrlLocal(caminhaoMtrNum) : 'Sem custo'}
                  </div>
                ) : null}
              </>
            ) : (
              <label style={label}>Caminhão</label>
            )}
            {modoVeiculoManual ? (
              <>
                {veiculosContrato.length === 0 ? null : (
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    Sem linha no contrato ou valor personalizado — preencha abaixo.
                  </div>
                )}
                <input
                  style={{ ...input, marginBottom: '6px' }}
                  disabled={!podeEditar}
                  readOnly={!podeEditar}
                  value={resumo.mtr.caminhao_rotulo}
                  onChange={(e) => patchMtrSemRecalc({ caminhao_rotulo: e.target.value })}
                  placeholder="Tipo / descrição"
                />
                <input
                  style={input}
                  disabled={!podeEditar}
                  readOnly={!podeEditar}
                  inputMode="decimal"
                  value={resumo.mtr.caminhao_valor}
                  onChange={(e) => patchMtrSemRecalc({ caminhao_valor: e.target.value })}
                  placeholder="Valor R$"
                />
              </>
            ) : null}
          </div>
          <div>
            <label style={label}>Equipamento</label>
            <input
              style={{ ...input, marginBottom: '6px' }}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              value={resumo.mtr.equipamento_rotulo}
              onChange={(e) => patchMtrSemRecalc({ equipamento_rotulo: e.target.value })}
            />
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.equipamento_valor}
              onChange={(e) => patchMtrSemRecalc({ equipamento_valor: e.target.value })}
              placeholder="Valor R$"
            />
          </div>
          <div>
            <label style={label}>Mão de obra</label>
            <input
              style={{ ...input, marginBottom: '6px' }}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              value={resumo.mtr.mao_obra_rotulo}
              onChange={(e) => patchMtrSemRecalc({ mao_obra_rotulo: e.target.value })}
            />
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.mao_obra_valor}
              onChange={(e) => patchMtrSemRecalc({ mao_obra_valor: e.target.value })}
              placeholder="Valor R$"
            />
          </div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>
          Resíduo (MTR)
        </div>
        <div className="rg-mobile-stack-grid" style={{ ...grid3, marginBottom: '8px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Tipo / descrição</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              value={resumo.mtr.residuo_rotulo}
              onChange={(e) => patchMtrSemRecalc({ residuo_rotulo: e.target.value })}
            />
          </div>
          <div>
            <label style={label}>Peso líq. MTR (kg)</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.peso_liquido_kg}
              onChange={(e) => alterarPesoLiquidoMtr(e.target.value)}
            />
          </div>
          <div>
            <label style={label}>Qtd. faturada</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.residuo_quantidade}
              onChange={(e) => patchMtr({ residuo_quantidade: e.target.value })}
            />
          </div>
          <div>
            <label style={label}>Unidade</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              value={resumo.mtr.residuo_unidade}
              onChange={(e) => patchMtrSemRecalc({ residuo_unidade: e.target.value })}
            />
          </div>
        </div>
        <div className="rg-mobile-stack-grid" style={grid2}>
          <div>
            <label style={label}>Valor unitário (R$)</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.residuo_valor_unitario}
              onChange={(e) => patchMtr({ residuo_valor_unitario: e.target.value })}
            />
          </div>
          <div>
            <label style={label}>Valor resíduo (R$)</label>
            <input
              style={input}
              disabled={!podeEditar}
              readOnly={!podeEditar}
              inputMode="decimal"
              value={resumo.mtr.residuo_valor}
              onChange={(e) => patchMtrSemRecalc({ residuo_valor: e.target.value })}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px dashed #86efac',
            fontSize: '13px',
            fontWeight: 700,
            color: '#065f46',
          }}
        >
          Subtotal MTR: {fmtBrlLocal(totalMtr)}
          <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 500, color: '#047857' }}>
            Caminhão {fmtBrlLocal(caminhaoMtrNum)} + Equipamento {fmtBrlLocal(equipMtrNum)} + Mão de obra{' '}
            {fmtBrlLocal(maoObraMtrNum)} + Resíduo {fmtBrlLocal(residuoMtrNum)}
          </div>
        </div>
      </div>

      {(podeAjustar || acrescimoNum > 0 || descontoNum > 0) && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
            Ajustes financeiros (Operacional (Time T))
          </div>
          <div className="rg-mobile-stack-grid" style={grid2}>
            <div>
              <label style={label}>Acréscimo (R$)</label>
              <input
                style={input}
                disabled={!podeAjustar}
                readOnly={!podeAjustar}
                inputMode="decimal"
                value={resumo.ajustes?.acrescimo ?? ''}
                onChange={(e) => patchAjustes({ acrescimo: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <label style={label}>Desconto (R$)</label>
              <input
                style={input}
                disabled={!podeAjustar}
                readOnly={!podeAjustar}
                inputMode="decimal"
                value={resumo.ajustes?.desconto ?? ''}
                onChange={(e) => patchAjustes({ desconto: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>
      )}

      <FaturamentoDetalheConta
        resumo={resumo}
        referencia={referenciaConta}
        diferenca={diferencaConta}
      />
    </>
  )
}

export const FaturamentoResumoDesvinculado = memo(FaturamentoResumoDesvinculadoInner)
