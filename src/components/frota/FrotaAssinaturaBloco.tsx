type Props = {
  nome: string
  cargo: string
  onNome: (v: string) => void
  onCargo: (v: string) => void
  disabled?: boolean
}

export function FrotaAssinaturaBloco({ nome, cargo, onNome, onCargo, disabled }: Props) {
  return (
    <fieldset className="frota-assinatura" disabled={disabled}>
      <legend>Assinatura do responsável (colaborador RG)</legend>
      <p className="frota-assinatura__hint">
        Ao guardar, o sistema regista nome, cargo e data/hora como confirmação do controlo.
      </p>
      <div className="frota-assinatura__grid">
        <label>
          <span>Nome completo</span>
          <input value={nome} onChange={(e) => onNome(e.target.value)} placeholder="Quem realizou o registo" />
        </label>
        <label>
          <span>Cargo / função</span>
          <input value={cargo} onChange={(e) => onCargo(e.target.value)} placeholder="Ex.: Operacional, Logística" />
        </label>
      </div>
      <div className="frota-assinatura__linha" aria-hidden>
        <span className="frota-assinatura__tracado" />
        <span className="frota-assinatura__legenda">Rubrica / confirmação</span>
      </div>
    </fieldset>
  )
}
