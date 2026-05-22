import type { ReactNode } from 'react'
import { BRAND_LOGO_MARK } from '../../lib/brandLogo'
import {
  rotuloEquipamentosContratoResumo,
  rotuloVeiculosContratoResumo,
} from '../../lib/clienteContratoCadastro'
import {
  listaResiduosParaDocumentoMtr,
  type MtrResiduoDetalhesCampos,
} from '../../lib/mtrClienteContratoAutofill'
import { RG_AMBIENTAL_DADOS_CORPORATIVOS } from '../../lib/rgAmbientalDadosCorporativos'
import {
  MTR_CERTIFICACAO_GERADOR_TEXTO,
  MTR_CERTIFICACAO_RECEPTORA_TEXTO,
  MTR_RODAPE_VIAS,
  MTR_SECAO7_DISCREPANCIA_TEXTO,
  MTR_STTADE_DESTINATARIO_SUBTITULO,
  MTR_TELEFONE_DISCREPANCIA_PADRAO,
  MTR_TEXTO_VIDE_FICHA,
  mtrTextoCelula,
  sanitizarTextoManifestoMtr,
} from '../../lib/mtrPrintTexto'
import './mtrManifestoPrint.css'

export type MtrManifestoPrintDetalhes = {
  gerador: {
    atividade: string
    cadri: string
    cnpj: string
    ie: string
    bairro: string
    cep: string
    estado: string
    cidade: string
    responsavel: string
    telefone: string
  }
  residuo: MtrResiduoDetalhesCampos
  residuos_lista?: MtrResiduoDetalhesCampos[]
  residuos_itens?: { texto: string }[]
  blocos: {
    descricoes_adicionais_residuos: string
    instrucoes_manuseio: string
  }
  conformidade: {
    telefone_discrepancias: string
  }
  contrato_veiculos?: { tipo_veiculo: string }[]
  contrato_equipamentos?: { descricao: string }[]
  transportador: {
    razao_social: string
    atividade: string
    cnpj: string
    ie: string
    endereco: string
    municipio: string
    bairro: string
    cep: string
    estado: string
    responsavel: string
    telefone: string
    email: string
    motorista: string
    placa: string
    telefones_gerais: string
  }
  destinatario: {
    razao_social: string
    atividade: string
    lo: string
    cnpj: string
    ie: string
    endereco: string
    municipio: string
    bairro: string
    cep: string
    estado: string
    responsavel: string
    telefone: string
  }
}

export type MtrManifestoPrintProps = {
  numero: string
  gerador: string
  endereco: string
  cidade: string
  tipo_residuo: string
  transportador: string
  destinador: string
  detalhes: MtrManifestoPrintDetalhes
  footerExtra?: ReactNode
}

function telefonesTransportadorBarra(d: MtrManifestoPrintDetalhes): string {
  const custom = d.transportador.telefones_gerais.trim()
  if (custom) return custom
  return RG_AMBIENTAL_DADOS_CORPORATIVOS.telefones_gerais
}

function textoDiscrepancia(d: MtrManifestoPrintDetalhes): string {
  return (
    d.conformidade.telefone_discrepancias.trim() ||
    d.gerador.telefone.trim() ||
    d.transportador.telefone.trim() ||
    MTR_TELEFONE_DISCREPANCIA_PADRAO
  )
}

function descricoesAdicionaisExibir(d: MtrManifestoPrintDetalhes): string {
  const t = d.blocos.descricoes_adicionais_residuos.trim()
  if (t && t !== MTR_TEXTO_VIDE_FICHA) return t
  return ''
}

function instrucoesManuseioExibir(d: MtrManifestoPrintDetalhes): string {
  const t = d.blocos.instrucoes_manuseio.trim()
  if (t && t !== MTR_TEXTO_VIDE_FICHA) return t
  return ''
}

export function MtrManifestoPrint({
  numero,
  gerador,
  endereco,
  cidade,
  tipo_residuo,
  transportador,
  destinador,
  detalhes: d,
  footerExtra,
}: MtrManifestoPrintProps) {
  const listaRes = listaResiduosParaDocumentoMtr(d, tipo_residuo)
  const motoristaDoc = d.transportador.motorista.trim()
  const placaDoc = d.transportador.placa.trim()
  const municipioGerador = (d.gerador.cidade || cidade || '').trim()
  const transportadorRazao = (d.transportador.razao_social || transportador || '').trim()
  const destinatarioRazao = (d.destinatario.razao_social || destinador || '').trim()
  const telBar = telefonesTransportadorBarra(d)
  const telDisc = textoDiscrepancia(d)
  const descAdic = descricoesAdicionaisExibir(d)
  const instrMan = instrucoesManuseioExibir(d)
  const ocultarValoresManifesto = { ocultarValores: true as const }
  const rotuloVeiculos = rotuloVeiculosContratoResumo(
    d.contrato_veiculos,
    null,
    ocultarValoresManifesto
  )
  const rotuloEquipamentos = rotuloEquipamentosContratoResumo(
    d.contrato_equipamentos,
    null,
    ocultarValoresManifesto
  )

  function celulaResiduoManifesto(val: string): string {
    return mtrTextoCelula(sanitizarTextoManifestoMtr(val))
  }

  return (
    <div className="mtr-excel">
      <div className="mtr-excel__top">
        <div className="mtr-excel__logo">
          <img src={BRAND_LOGO_MARK} alt="RG Ambiental" />
        </div>
        <div className="mtr-excel__mtrno">Nº MTR: {mtrTextoCelula(numero)}</div>
      </div>
      <div className="mtr-excel__titlebar">MTR - MANIFESTO PARA TRANSPORTE DE RESÍDUOS</div>

      <table className="mtr-excel__table">
        <tbody>
          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              1. GERADOR:
            </td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Atividade:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.atividade)}</td>
            <td className="mtr-excel__k">Nº CADRI:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.cadri)}</td>
            <td className="mtr-excel__k">CNPJ:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.cnpj)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Razão Social:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(gerador)}
            </td>
            <td className="mtr-excel__k">I.E:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.ie)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Endereço:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(endereco)}
            </td>
            <td className="mtr-excel__k">Bairro:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.bairro)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Município:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(municipioGerador)}</td>
            <td className="mtr-excel__k">CEP:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.cep)}</td>
            <td className="mtr-excel__k">Estado:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.estado)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Responsável:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(d.gerador.responsavel)}
            </td>
            <td className="mtr-excel__k">Telefone:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.gerador.telefone)}</td>
          </tr>

          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              1B. VEÍCULOS E EQUIPAMENTOS (CONTRATO):
            </td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Veículos:</td>
            <td className="mtr-excel__v" colSpan={5}>
              {mtrTextoCelula(rotuloVeiculos)}
            </td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Equipamentos:</td>
            <td className="mtr-excel__v" colSpan={5}>
              {mtrTextoCelula(rotuloEquipamentos)}
            </td>
          </tr>

          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              2. DESCRIÇÃO DOS RESÍDUOS:
            </td>
          </tr>
          <tr>
            <td colSpan={6} className="mtr-excel__pad0">
              <table className="mtr-excel__inner">
                <tbody>
                  <tr className="mtr-excel__throw">
                    <td className="mtr-excel__th mtr-excel__th-col-fonte">Fonte de Origem</td>
                    <td className="mtr-excel__th mtr-excel__th-col-carac">Caracterização dos resíduos</td>
                    <td className="mtr-excel__th mtr-excel__th-col-estado">Estado Físico</td>
                    <td className="mtr-excel__th mtr-excel__th-col-acond">Tipo de Acondicionamento</td>
                    <td className="mtr-excel__th mtr-excel__th-col-qtde">QTDE Aproximada</td>
                    <td className="mtr-excel__th mtr-excel__th-col-onu">Nº ONU</td>
                  </tr>
                  {listaRes.map((rowRes, idx) => (
                    <tr key={`mtr-print-residuo-${idx}`}>
                      <td className="mtr-excel__v">{celulaResiduoManifesto(rowRes.fonte_origem)}</td>
                      <td className="mtr-excel__v mtr-excel__v--carac">
                        {celulaResiduoManifesto(rowRes.caracterizacao)}
                      </td>
                      <td className="mtr-excel__v">{celulaResiduoManifesto(rowRes.estado_fisico)}</td>
                      <td className="mtr-excel__v">{celulaResiduoManifesto(rowRes.acondicionamento)}</td>
                      <td className="mtr-excel__v">{celulaResiduoManifesto(rowRes.quantidade_aproximada)}</td>
                      <td className="mtr-excel__v">{celulaResiduoManifesto(rowRes.onu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              3. TRANSPORTADOR:
            </td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Atividade:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(d.transportador.atividade || transportador)}
            </td>
            <td className="mtr-excel__k">CNPJ:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.cnpj)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Razão Social:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(transportadorRazao)}
            </td>
            <td className="mtr-excel__k">I.E:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.ie)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Endereço:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(d.transportador.endereco)}
            </td>
            <td className="mtr-excel__k">Bairro:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.bairro)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Município:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.municipio)}</td>
            <td className="mtr-excel__k">CEP:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.cep)}</td>
            <td className="mtr-excel__k">Estado:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.estado)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Responsável:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.responsavel)}</td>
            <td className="mtr-excel__k">Telefone:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.telefone)}</td>
            <td className="mtr-excel__k">Email:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.transportador.email)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Motorista:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(motoristaDoc)}
            </td>
            <td className="mtr-excel__k">Placa do Veículo:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(placaDoc)}</td>
          </tr>
          <tr className="mtr-excel__telbar">
            <td colSpan={6}>Telefones: {mtrTextoCelula(telBar)}</td>
          </tr>

          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              4. STTADE DESTINATÁRIO:{' '}
              <span className="mtr-excel__sec-sub">{MTR_STTADE_DESTINATARIO_SUBTITULO}</span>
            </td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Atividade:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(d.destinatario.atividade || destinador)}
            </td>
            <td className="mtr-excel__k">L.O:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.lo)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Razão Social:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(destinatarioRazao)}
            </td>
            <td className="mtr-excel__k">CNPJ:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.cnpj)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Endereço:</td>
            <td className="mtr-excel__v" colSpan={3}>
              {mtrTextoCelula(d.destinatario.endereco)}
            </td>
            <td className="mtr-excel__k">Bairro:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.bairro)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Município:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.municipio)}</td>
            <td className="mtr-excel__k">CEP:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.cep)}</td>
            <td className="mtr-excel__k">Estado:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.estado)}</td>
          </tr>
          <tr>
            <td className="mtr-excel__k">Responsável:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.responsavel)}</td>
            <td className="mtr-excel__k">Telefone:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.telefone)}</td>
            <td className="mtr-excel__k">I.E:</td>
            <td className="mtr-excel__v">{mtrTextoCelula(d.destinatario.ie)}</td>
          </tr>

          <tr className="mtr-excel__banner-dark">
            <td colSpan={6}>DESCRIÇÕES ADICIONAIS DOS RESÍDUOS ACIMA</td>
          </tr>
          <tr>
            <td className="mtr-excel__v" colSpan={6}>
              {mtrTextoCelula(sanitizarTextoManifestoMtr(descAdic))}
            </td>
          </tr>
          <tr className="mtr-excel__banner-light">
            <td colSpan={6}>{MTR_TEXTO_VIDE_FICHA}</td>
          </tr>
          <tr className="mtr-excel__banner-dark">
            <td colSpan={6}>INSTRUÇÕES ESPECIAIS DE MANUSEIO E INFORMAÇÕES ADICIONAIS</td>
          </tr>
          <tr>
            <td className="mtr-excel__v" colSpan={6}>
              {mtrTextoCelula(instrMan)}
            </td>
          </tr>
          <tr className="mtr-excel__banner-light">
            <td colSpan={6}>{MTR_TEXTO_VIDE_FICHA}</td>
          </tr>

          <tr>
            <td className="mtr-excel__sec" colSpan={6}>
              5. CERTIFICAÇÃO DO GERADOR:
            </td>
          </tr>
          <tr className="mtr-excel__legal">
            <td className="mtr-excel__v" colSpan={6}>
              {MTR_CERTIFICACAO_GERADOR_TEXTO}
            </td>
          </tr>

          <tr className="mtr-excel__avoid-print-break">
            <td className="mtr-excel__sec" colSpan={6}>
              6. RESPONSÁVEIS
            </td>
          </tr>
          <tr className="mtr-excel__avoid-print-break">
            <td colSpan={6} className="mtr-excel__pad0">
              <table className="mtr-excel__sign-table">
                <tbody>
                  <tr className="mtr-excel__throw">
                    <td className="mtr-excel__th" />
                    <td className="mtr-excel__th">NOME:</td>
                    <td className="mtr-excel__th">Assinatura:</td>
                    <td className="mtr-excel__th">Data:</td>
                  </tr>
                  <tr>
                    <td className="mtr-excel__sign-label">a) Gerador:</td>
                    <td className="mtr-excel__v">{mtrTextoCelula(gerador)}</td>
                    <td className="mtr-excel__v mtr-excel__sign-blank">&nbsp;</td>
                    <td className="mtr-excel__v">____/____/________</td>
                  </tr>
                  <tr>
                    <td className="mtr-excel__sign-label">b) Transportador:</td>
                    <td className="mtr-excel__v">{mtrTextoCelula(transportadorRazao)}</td>
                    <td className="mtr-excel__v mtr-excel__sign-blank">&nbsp;</td>
                    <td className="mtr-excel__v">____/____/________</td>
                  </tr>
                  <tr>
                    <td className="mtr-excel__sign-label">c) Instalação Receptora:</td>
                    <td className="mtr-excel__v">{mtrTextoCelula(destinatarioRazao)}</td>
                    <td className="mtr-excel__v mtr-excel__sign-blank">&nbsp;</td>
                    <td className="mtr-excel__v">____/____/________</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <tr className="mtr-excel__banner-dark mtr-excel__avoid-print-break">
            <td colSpan={6}>
              7. INSTRUÇÕES EM CASO DE DISCREPÂNCIA DAS INDICAÇÕES DESCRITAS DESTE MANIFESTO:
            </td>
          </tr>
          <tr className="mtr-excel__center mtr-excel__avoid-print-break">
            <td colSpan={6}>
              {MTR_SECAO7_DISCREPANCIA_TEXTO} {mtrTextoCelula(telDisc)}
            </td>
          </tr>

          <tr className="mtr-excel__avoid-print-break">
            <td className="mtr-excel__sec" colSpan={6}>
              8. INSTALAÇÃO RECEPTORA:
            </td>
          </tr>
          <tr className="mtr-excel__legal mtr-excel__avoid-print-break">
            <td className="mtr-excel__v" colSpan={6}>
              {MTR_CERTIFICACAO_RECEPTORA_TEXTO}
              <div className="mtr-excel__receptora-sign">
                <span>NOME: ___________________________</span>
                <span>ASSINATURA: ______________________________</span>
                <span>DATA: ____/____/________</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mtr-excel__doc-footer">
        <p className="mtr-excel__doc-footer-line">{MTR_RODAPE_VIAS}</p>
        {footerExtra}
      </div>
    </div>
  )
}
