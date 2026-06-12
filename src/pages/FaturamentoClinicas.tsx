import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { ClinicasHistoricoFaturado } from '../components/clinicas/ClinicasHistoricoFaturado'
import { LinkGerarOsClinicas } from '../components/clinicas/LinkGerarOsClinicas'
import { FaturamentoFilaClinicas } from '../components/faturamento/FaturamentoFilaClinicas'
import { supabase } from '../lib/supabase'
import {
  cargoPodeConfirmarEmissaoFaturamento,
  cargoPodeEditarResumosFinanceirosFaturamento,
} from '../lib/workflowPermissions'

export default function FaturamentoClinicas() {
  const [cargo, setCargo] = useState<string | null>(null)
  const [usuarioNome, setUsuarioNome] = useState<string | null>(null)
  const [historicoVersao, setHistoricoVersao] = useState(0)

  const atualizarHistorico = useCallback(() => {
    setHistoricoVersao((v) => v + 1)
  }, [])

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCargo(null)
        setUsuarioNome(null)
        return
      }
      const { data } = await supabase.from('usuarios').select('cargo, nome').eq('id', user.id).maybeSingle()
      setCargo(data?.cargo ?? null)
      setUsuarioNome(data?.nome ?? null)
    })()
  }, [])

  const podeEmitir = cargoPodeConfirmarEmissaoFaturamento(cargo, usuarioNome)
  const podeEditarValor = cargoPodeEditarResumosFinanceirosFaturamento(cargo, usuarioNome) || podeEmitir

  return (
    <MainLayout>
      <div className="page-shell faturamento-clinicas-page">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '16px',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
              Faturamento — Clínicas
            </h1>
            <p className="page-header__lead" style={{ margin: '10px 0 0', maxWidth: 760, lineHeight: 1.65 }}>
              Fila exclusiva para ordens de serviço de clínicas (sem pesagem nem ticket). Defina o valor, emita NF ou
              PIX conforme o cadastro da unidade e envie ao{' '}
              <Link to="/financeiro/contas-receber" style={{ color: '#0d9488', fontWeight: 700 }}>
                Financeiro → Contas a receber
              </Link>
              .
            </p>
            <p style={{ margin: '10px 0 0', fontSize: '13px' }}>
              <LinkGerarOsClinicas variant="text">← Voltar para geração de O.S. (Clínicas)</LinkGerarOsClinicas>
            </p>
          </div>
          <LinkGerarOsClinicas variant="primary" />
        </div>

        <div style={{ marginTop: '22px' }}>
          <FaturamentoFilaClinicas
            podeEmitir={podeEmitir}
            podeEditarValor={podeEditarValor}
            onOsEmitida={atualizarHistorico}
          />
          <ClinicasHistoricoFaturado refreshVersao={historicoVersao} />
        </div>
      </div>
    </MainLayout>
  )
}
