import { useMemo, useState, type CSSProperties } from 'react'
import {
  TIPOS_CAMINHAO_GRUPOS,
  TIPOS_CAMINHAO_LISTA,
  textoBuscaCombinaCaminhao,
} from '../../lib/programacaoTiposCaminhao'

export type ProgramacaoTipoContagem = { tipo: string; count: number }

export type ProgramacaoVeiculoOpcao = { id: string; placa: string; tipoCaminhao: string }

type Props = {
  filtroTipo: string
  onFiltroTipoChange: (tipo: string) => void
  filtroCaminhaoId: string
  onFiltroCaminhaoIdChange: (id: string) => void
  contagensTipoNoMes: ProgramacaoTipoContagem[]
  veiculosNoMes: ProgramacaoVeiculoOpcao[]
  totalNoMes: number
  totalFiltradoNoMes: number
  inputStyle: CSSProperties
  /** Onde o filtro aparece: página inteira ou painel do dia. */
  variant?: 'page' | 'painel'
  /** Texto do contador «X de Y …». */
  contagemEscopo?: 'mes' | 'dia'
}

const chipBase: CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 600,
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  lineHeight: 1.2,
}

const chipAtivo: CSSProperties = {
  ...chipBase,
  borderColor: '#0f766e',
  background: '#ecfdf5',
  color: '#0f766e',
}

export default function ProgramacaoFiltroCaminhao({
  filtroTipo,
  onFiltroTipoChange,
  filtroCaminhaoId,
  onFiltroCaminhaoIdChange,
  contagensTipoNoMes,
  veiculosNoMes,
  totalNoMes,
  totalFiltradoNoMes,
  inputStyle,
  variant = 'page',
  contagemEscopo = 'mes',
}: Props) {
  const [busca, setBusca] = useState('')
  const [mostrarTodosTipos, setMostrarTodosTipos] = useState(false)

  const contagemPorTipo = useMemo(
    () => new Map(contagensTipoNoMes.map((c) => [c.tipo.toLowerCase(), c.count])),
    [contagensTipoNoMes]
  )

  const tiposLegadoNoMes = useMemo(() => {
    return contagensTipoNoMes
      .map((c) => c.tipo)
      .filter((t) => !TIPOS_CAMINHAO_LISTA.some((cat) => cat.toLowerCase() === t.toLowerCase()))
  }, [contagensTipoNoMes])

  const chipsTipos = useMemo(() => {
    const vistos = new Set<string>()
    const lista: { tipo: string; count: number; catalogo: boolean }[] = []

    for (const tipo of TIPOS_CAMINHAO_LISTA) {
      if (vistos.has(tipo.toLowerCase())) continue
      vistos.add(tipo.toLowerCase())
      const count = contagemPorTipo.get(tipo.toLowerCase()) ?? 0
      const ativoFiltro = filtroTipo.trim().toLowerCase() === tipo.trim().toLowerCase()
      if (!mostrarTodosTipos && count === 0 && !ativoFiltro) continue
      if (!textoBuscaCombinaCaminhao(busca, tipo)) continue
      lista.push({ tipo, count, catalogo: true })
    }

    for (const tipo of tiposLegadoNoMes) {
      if (vistos.has(tipo.toLowerCase())) continue
      vistos.add(tipo.toLowerCase())
      const count = contagemPorTipo.get(tipo.toLowerCase()) ?? 0
      if (!textoBuscaCombinaCaminhao(busca, tipo)) continue
      lista.push({ tipo, count, catalogo: false })
    }

    return lista.sort((a, b) => b.count - a.count || a.tipo.localeCompare(b.tipo, 'pt-BR'))
  }, [busca, contagemPorTipo, tiposLegadoNoMes, mostrarTodosTipos, filtroTipo])

  const tiposOcultosCount = useMemo(() => {
    if (mostrarTodosTipos || busca.trim()) return 0
    let n = 0
    for (const tipo of TIPOS_CAMINHAO_LISTA) {
      if ((contagemPorTipo.get(tipo.toLowerCase()) ?? 0) === 0) n += 1
    }
    return n
  }, [mostrarTodosTipos, busca, contagemPorTipo])

  const veiculosFiltrados = useMemo(() => {
    return veiculosNoMes.filter((v) => {
      if (filtroTipo && v.tipoCaminhao.trim().toLowerCase() !== filtroTipo.trim().toLowerCase()) {
        return false
      }
      return textoBuscaCombinaCaminhao(busca, v.placa, v.tipoCaminhao)
    })
  }, [veiculosNoMes, filtroTipo, busca])

  const filtroAtivo = Boolean(filtroTipo || filtroCaminhaoId)
  const placaSelecionada = veiculosNoMes.find((v) => v.id === filtroCaminhaoId)?.placa

  function limparFiltros() {
    setBusca('')
    setMostrarTodosTipos(false)
    onFiltroTipoChange('')
    onFiltroCaminhaoIdChange('')
  }

  function alternarTipo(tipo: string) {
    const ativo = filtroTipo.trim().toLowerCase() === tipo.trim().toLowerCase()
    onFiltroTipoChange(ativo ? '' : tipo)
    if (!ativo) onFiltroCaminhaoIdChange('')
  }

  const contagemLabel = contagemEscopo === 'dia' ? 'neste dia' : 'no mês'

  return (
    <section
      className={
        variant === 'painel'
          ? 'programacao-filtro-caminhao programacao-filtro-caminhao--painel'
          : 'programacao-filtro-caminhao'
      }
      aria-label="Filtrar caminhões"
    >
      <div className="programacao-filtro-caminhao__head">
        <div>
          <h2 className="programacao-filtro-caminhao__title">Filtrar caminhões</h2>
          <p className="programacao-filtro-caminhao__hint">
            Busque ou clique no tipo (ex.: Baú). Opcional: restrinja por placa.
          </p>
        </div>
        <span className="programacao-filtro-caminhao__count">
          {totalFiltradoNoMes} de {totalNoMes} {contagemLabel}
        </span>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar tipo ou placa…"
        style={{ ...inputStyle, width: '100%' }}
        aria-label="Buscar tipo de caminhão ou placa"
      />

      <div>
        {tiposOcultosCount > 0 && !busca.trim() ? (
          <button
            type="button"
            className="programacao-filtro-caminhao__chip-toggle"
            onClick={() => setMostrarTodosTipos((v) => !v)}
          >
            {mostrarTodosTipos
              ? 'Mostrar só tipos com programação neste mês'
              : `Mostrar mais tipos (${tiposOcultosCount} sem programação no mês)`}
          </button>
        ) : null}
        <div
          className={
            mostrarTodosTipos
              ? 'programacao-filtro-caminhao__chips programacao-filtro-caminhao__chips--expandido'
              : 'programacao-filtro-caminhao__chips'
          }
        >
          {chipsTipos.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#64748b' }}>Nenhum tipo corresponde à busca.</span>
          ) : (
            chipsTipos.map(({ tipo, count, catalogo }) => {
              const ativo = filtroTipo.trim().toLowerCase() === tipo.trim().toLowerCase()
              return (
                <button
                  key={`${tipo}-${catalogo ? 'c' : 'l'}`}
                  type="button"
                  style={ativo ? chipAtivo : chipBase}
                  onClick={() => alternarTipo(tipo)}
                  title={
                    count > 0
                      ? `${count} programação(ões) neste mês`
                      : 'Sem programações neste mês'
                  }
                >
                  {tipo}
                  {count > 0 ? ` (${count})` : ''}
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="programacao-filtro-caminhao__row">
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Tipo (lista)</span>
          <select
            value={filtroTipo}
            onChange={(e) => {
              onFiltroTipoChange(e.target.value)
              onFiltroCaminhaoIdChange('')
            }}
            style={{ ...inputStyle, width: '100%' }}
            aria-label="Filtrar por tipo de caminhão"
          >
            <option value="">Todos os tipos</option>
            {TIPOS_CAMINHAO_GRUPOS.map((grupo) => (
              <optgroup key={grupo.titulo} label={grupo.titulo}>
                {grupo.opcoes
                  .filter((op) => textoBuscaCombinaCaminhao(busca, op))
                  .map((op) => (
                    <option key={op} value={op}>
                      {op}
                      {contagemPorTipo.get(op.toLowerCase())
                        ? ` (${contagemPorTipo.get(op.toLowerCase())})`
                        : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
            {tiposLegadoNoMes
              .filter((t) => textoBuscaCombinaCaminhao(busca, t))
              .map((t) => (
                <option key={`leg-${t}`} value={t}>
                  {t} (outro)
                </option>
              ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Placa</span>
          <select
            value={filtroCaminhaoId}
            onChange={(e) => onFiltroCaminhaoIdChange(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
            aria-label="Filtrar por veículo (placa)"
            disabled={veiculosFiltrados.length === 0}
          >
            <option value="">Todas as placas</option>
            {veiculosFiltrados.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa || v.id}
                {v.tipoCaminhao ? ` · ${v.tipoCaminhao}` : ''}
              </option>
            ))}
          </select>
        </label>

        {filtroAtivo ? (
          <button
            type="button"
            className="rg-btn rg-btn--outline"
            onClick={limparFiltros}
            title="Remover filtros de caminhão"
            style={{ height: '42px', alignSelf: 'end' }}
          >
            Limpar
          </button>
        ) : (
          <span aria-hidden style={{ width: 1 }} />
        )}
      </div>

      {filtroAtivo ? (
        <p className="programacao-filtro-caminhao__ativo">
          Filtro ativo
          {filtroTipo ? (
            <>
              {' '}
              · tipo <strong>{filtroTipo}</strong>
            </>
          ) : null}
          {placaSelecionada ? (
            <>
              {' '}
              · placa <strong>{placaSelecionada}</strong>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
