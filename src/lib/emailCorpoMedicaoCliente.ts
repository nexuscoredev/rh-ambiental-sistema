/** Corpo padrão do e-mail de conferência de medição enviado ao cliente (Mala Direta — Medição). */

const MESES_REFERENCIA = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const

/** Ex.: ABRIL/26 — por padrão o mês anterior à data de referência (medição do mês encerrado). */
export function formatarMesReferenciaMedicao(
  dataRef: Date = new Date(),
  usarMesAnterior = true
): string {
  const d = new Date(dataRef.getTime())
  if (usarMesAnterior) {
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
  }
  const mes = MESES_REFERENCIA[d.getMonth()] ?? MESES_REFERENCIA[0]
  const ano = String(d.getFullYear()).slice(-2)
  return `${mes}/${ano}`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Texto plano (pré-visualização / log). */
export function textoCorpoMedicaoCliente(mesReferencia: string): string {
  const mes = (mesReferencia || formatarMesReferenciaMedicao()).trim() || formatarMesReferenciaMedicao()
  return `Prezados, boa tarde.

Encaminhamos em anexo a medição referente aos serviços prestados no mês de "${mes}" para conferência e validação.

Reiteramos que o prazo para análise e manifestação é de até 48 (quarenta e oito) horas a partir do recebimento. Na ausência de devolutiva dentro desse período, a Nota Fiscal ficará passível de emissão.

Orientações importantes:

* Eventuais divergências deverão ser formalizadas dentro do prazo de 48 horas. Após a emissão da Nota Fiscal e do boleto, quaisquer ajustes serão tratados no faturamento subsequente.
* Após a emissão do boleto, fica vedada qualquer alteração sem a incidência dos encargos pertinentes. Caso seja necessária alteração de valor ou prazo previamente acordado, a solicitação deverá ocorrer antes do faturamento. Após a emissão, eventuais custos bancários — inclusive taxa de baixa — serão incorporados ao novo boleto.
* Ressaltamos que, conforme regra geral, as Notas Fiscais devem conter destaque de ISS, com retenção pelo tomador do serviço. Independentemente da forma de pagamento, solicitamos que seja considerado o abatimento correspondente à retenção. Não serão aceitas solicitações posteriores de reembolso, uma vez que o recolhimento ficará sob responsabilidade de nossa contabilidade.

Em caso de dúvidas, permanecemos a disposição.`
}

/** Converte o texto editado na Mala Direta (plain text) para HTML do e-mail. */
export function textoPlanoParaHtmlCorpoMedicao(texto: string): string {
  const t = texto.trim()
  if (!t) return htmlCorpoMedicaoCliente(formatarMesReferenciaMedicao())
  const blocks = t.split(/\n\n+/).filter((b) => b.trim())
  const htmlBlocks = blocks
    .map((block) => {
      const lines = block.split('\n').map((line) => escapeHtml(line.trimEnd()))
      const inner = lines.join('<br/>')
      if (/^\*\s+/.test(block.trim())) {
        const items = block
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.startsWith('*'))
          .map((line) => `<li>${escapeHtml(line.replace(/^\*\s*/, ''))}</li>`)
          .join('')
        return `<ul style="margin:0 0 1em;padding-left:1.25em;">${items}</ul>`
      }
      return `<p>${inner}</p>`
    })
    .join('\n')
  if (!/atenciosamente/i.test(t)) {
    return `${htmlBlocks}\n<p>Atenciosamente,<br/>RG Ambiental</p>`
  }
  return htmlBlocks
}

/** HTML enviado no e-mail real (Edge Function `send-nf-email`) quando não há corpo customizado. */
export function htmlCorpoMedicaoCliente(mesReferencia: string): string {
  const mes = escapeHtml(
    (mesReferencia || formatarMesReferenciaMedicao()).trim() || formatarMesReferenciaMedicao()
  )
  return `
<p>Prezados, boa tarde.</p>
<p>Encaminhamos em anexo a medição referente aos serviços prestados no mês de &quot;${mes}&quot; para conferência e validação.</p>
<p>Reiteramos que o prazo para análise e manifestação é de até 48 (quarenta e oito) horas a partir do recebimento. Na ausência de devolutiva dentro desse período, a Nota Fiscal ficará passível de emissão.</p>
<p><strong>Orientações importantes:</strong></p>
<ul style="margin:0 0 1em;padding-left:1.25em;">
<li>Eventuais divergências deverão ser formalizadas dentro do prazo de 48 horas. Após a emissão da Nota Fiscal e do boleto, quaisquer ajustes serão tratados no faturamento subsequente.</li>
<li>Após a emissão do boleto, fica vedada qualquer alteração sem a incidência dos encargos pertinentes. Caso seja necessária alteração de valor ou prazo previamente acordado, a solicitação deverá ocorrer antes do faturamento. Após a emissão, eventuais custos bancários — inclusive taxa de baixa — serão incorporados ao novo boleto.</li>
<li>Ressaltamos que, conforme regra geral, as Notas Fiscais devem conter destaque de ISS, com retenção pelo tomador do serviço. Independentemente da forma de pagamento, solicitamos que seja considerado o abatimento correspondente à retenção. Não serão aceitas solicitações posteriores de reembolso, uma vez que o recolhimento ficará sob responsabilidade de nossa contabilidade.</li>
</ul>
<p>Em caso de dúvidas, permanecemos a disposição.</p>
<p>Atenciosamente,<br/>RG Ambiental</p>
`.trim()
}
