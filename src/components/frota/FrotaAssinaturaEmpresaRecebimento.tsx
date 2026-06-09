type Props = {
  razaoSocial: string
  onRazaoSocial: (v: string) => void
  disabled?: boolean
}

/** Assinatura no registo de instalação — empresa que recebe o equipamento no cliente. */
export function FrotaAssinaturaEmpresaRecebimento({ razaoSocial, onRazaoSocial, disabled }: Props) {
  return (
    <fieldset className="frota-assinatura frota-assinatura--empresa-recebimento" disabled={disabled}>
      <legend>Assinatura — empresa responsável pelo recebimento</legend>
      <p className="frota-assinatura__hint">
        Informe a razão social da empresa que recebe e assina a entrega do equipamento nas dependências do
        cliente. Ao guardar, o sistema regista o nome e a data/hora.
      </p>
      <label className="frota-assinatura__empresa-label">
        <span>Razão social (empresa receptora)</span>
        <input
          value={razaoSocial}
          onChange={(e) => onRazaoSocial(e.target.value)}
          placeholder="Ex.: NCH BRASIL LTDA"
        />
      </label>
      <div className="frota-assinatura__linha" aria-hidden>
        <span className="frota-assinatura__tracado" />
        <span className="frota-assinatura__legenda frota-assinatura__legenda--empresa">
          {razaoSocial.trim() || 'Empresa responsável pelo recebimento'}
        </span>
      </div>
    </fieldset>
  )
}
