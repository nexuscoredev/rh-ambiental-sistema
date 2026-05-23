import { BRAND_LOGO_MARK } from '../lib/brandLogo'

export type TicketOperacionalPrintViewProps = {
  numero: string
  titulo: string
  dataTicketBr: string
  mtrNumero: string
  cliente: string
  tipoResiduo: string
  pesoBruto: string
  pesoTara: string
  pesoLiquido: string
  balanceiro: string
  motorista: string
  placa: string
  empresaTransporte: string
  obs: string
  horaEntrada: string
  horaSaida: string
}

function LinhaTicketPrint({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ marginBottom: '6px', textAlign: 'center' }}>
      <span style={{ fontWeight: 800 }}>{k}: </span>
      <span style={{ fontWeight: 700 }}>{v}</span>
    </div>
  )
}

export function TicketOperacionalPrintView({
  numero,
  titulo,
  dataTicketBr,
  mtrNumero,
  cliente,
  tipoResiduo,
  pesoBruto,
  pesoTara,
  pesoLiquido,
  balanceiro,
  motorista,
  placa,
  empresaTransporte,
  obs,
  horaEntrada,
  horaSaida,
}: TicketOperacionalPrintViewProps) {
  return (
    <div className="ticket-print-root">
      <div
        className="ticket-print-col"
        style={{
          maxWidth: '82mm',
          width: 'min(82mm, 100%)',
          margin: '0 auto',
          fontFamily: 'Consolas, ui-monospace, monospace',
          fontSize: '13px',
          lineHeight: 1.5,
          color: '#111',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '10px', width: '100%' }}>
          <img
            src={BRAND_LOGO_MARK}
            alt=""
            style={{
              height: '28px',
              width: 'auto',
              maxWidth: '100%',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 900,
            letterSpacing: '0.04em',
            marginTop: '4px',
          }}
        >
          {numero}
        </div>
        <div
          style={{
            textAlign: 'center',
            fontWeight: 900,
            fontSize: '16px',
            letterSpacing: '0.14em',
            marginTop: '10px',
          }}
        >
          {titulo}
        </div>
        <div style={{ marginTop: '14px', borderTop: '1px dashed #999', paddingTop: '10px' }} />
        <LinhaTicketPrint k="Data" v={dataTicketBr} />
        <LinhaTicketPrint k="MTR" v={mtrNumero || '—'} />
        <div style={{ marginTop: '12px', fontWeight: 800, fontSize: '13px' }}>EMPRESA</div>
        <div style={{ fontWeight: 700 }}>{cliente || '—'}</div>
        <div style={{ marginTop: '12px', fontWeight: 900, fontSize: '15px' }}>RESIDUO</div>
        <div style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>
          {tipoResiduo || '—'}
        </div>
        <div style={{ marginTop: '14px', borderTop: '1px dashed #999', paddingTop: '10px' }} />
        <LinhaTicketPrint k="Peso Bruto" v={pesoBruto} />
        <LinhaTicketPrint k="Tara" v={pesoTara} />
        <LinhaTicketPrint k="Peso Liquido" v={pesoLiquido} />
        <div style={{ marginTop: '14px', borderTop: '1px dashed #999', paddingTop: '10px' }} />
        <LinhaTicketPrint k="Balanceiro" v={balanceiro} />
        <LinhaTicketPrint k="Motorista" v={motorista} />
        <LinhaTicketPrint k="PLACA" v={placa} />
        <div style={{ marginTop: '12px', fontWeight: 800, fontSize: '13px' }}>EMPRESA</div>
        <div style={{ fontWeight: 800 }}>{empresaTransporte}</div>
        <div style={{ marginTop: '14px', borderTop: '1px dashed #999', paddingTop: '10px' }} />
        <LinhaTicketPrint k="OBS" v={obs} />
        <div style={{ marginTop: '14px', borderTop: '1px dashed #999', paddingTop: '10px' }} />
        <LinhaTicketPrint k="Hora Entrada" v={horaEntrada} />
        <LinhaTicketPrint k="Hora Saída" v={horaSaida} />
      </div>
    </div>
  )
}
