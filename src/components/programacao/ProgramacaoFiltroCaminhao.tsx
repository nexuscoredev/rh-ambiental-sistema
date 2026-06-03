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

const chipZero: CSSProperties = {
  ...chipBase,
  opacity: 0.55,
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
}: Props) {
  const [busca, setBusca] = useState('')

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
      if (!textoBuscaCombinaCaminhao(busca, tipo)) continue
      lista.push({
        tipo,
        count: contagemPorTipo.get(tipo.toLowerCase()) ?? 0,
        catalogo: true,
      })
    }

    for (const tipo of tiposLegadoNoMes) {
      if (vistos.has(tipo.toLowerCase())) continue
      vistos.add(tipo.toLowerCase())
      if (!textoBuscaCombinaCaminhao(busca, tipo)) continue
      lista.push({
        tipo,
        count: contagemPorTipo.get(tipo.toLowerCase()) ?? 0,
        catalogo: false,
      })
    }

    return lista.sort((a, b) => b.count - a.count || a.tipo.localeCompare(b.tipo, 'pt-BR'))
  }, [busca, contagemPorTipo, tiposLegadoNoMes])

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
    onFiltroTipoChange('')
    onFiltroCaminhaoIdChange('')
  }

  function alternarTipo(tipo: string) {
    const ativo = filtroTipo.trim().toLowerCase() === tipo.trim().toLowerCase()
    onFiltroTipoChange(ativo ? '' : tipo)
    if (!ativo) onFiltroCaminhaoIdChange('')
  }

  return (
    <div
      style={{
        flex: '1 1 320px',
        minWidth: 'min(100%, 280px)',
        maxWidth: '640px',
        padding: '12px 14px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Filtrar caminhões</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Busque ou clique no tipo (ex.: Baú). Opcional: filtre por placa.
          </div>
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', alignSelf: 'center' }}>
          {totalFiltradoNoMes} de {totalNoMes} no mês
        </div>
      </div>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar tipo ou placa…"
        style={{ ...inputStyle, width: '100%' }}
        aria-label="Buscar tipo de caminhão ou placa"
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
        {chipsTipos.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#64748b' }}>Nenhum tipo corresponde à busca.</span>
        ) : (
          chipsTipos.map(({ tipo, count, catalogo }) => {
            const ativo = filtroTipo.trim().toLowerCase() === tipo.trim().toLowerCase()
            return (
              <button
                key={`${tipo}-${catalogo ? 'c' : 'l'}`}
                type="button"
                style={ativo ? chipAtivo : count > 0 ? chipBase : chipZero}
                onClick={() => alternarTipo(tipo)}
                title={
                  count > 0
                    ? `${count} programação(ões) neste mês`
                    : 'Sem programações neste mês — ainda pode filtrar'
                }
              >
                {tipo}
                {count > 0 ? ` (${count})` : ''}
              </button>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
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

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 160px' }}>
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
            style={{ flexShrink: 0, alignSelf: 'flex-end' }}
          >
            Limpar
          </button>
        ) : null}
      </div>

      {filtroAtivo ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#0f766e', fontWeight: 600 }}>
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
    </div>
  )
}
