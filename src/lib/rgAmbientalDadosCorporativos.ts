/**
 * Dados corporativos imutáveis da RG Ambiental (transportadora).
 * Fonte única para preenchimento automático em MTR, comprovantes, tickets e impressos.
 */
export const RG_AMBIENTAL_DADOS_CORPORATIVOS = {
  razao_social: 'RG Ambiental Transportes Ltda.',
  nome_curto: 'RG Ambiental',
  /** Campo «Transportador» resumido no topo da MTR */
  nome_transportador_mtr: 'RG Ambiental',
  /** Segunda linha «EMPRESA» no ticket de pesagem (transportadora) */
  ticket_empresa_impressao: 'RG AMBIENTAL TRANSPORTES.',
  atividade:
    'Tratamento e disposição de resíduos perigosos de contaminação não radioativa (CNAE 3822-0/00)',
  cnpj: '02.785.402/0001-74',
  ie: '',
  endereco: 'Estrada Gregório Spina, 1101, Galpão RG Ambiental, Distrito Industrial',
  municipio: 'Araçariguama',
  bairro: 'Distrito Industrial',
  cep: '18147-000',
  estado: 'SP',
  responsavel: '',
  telefone: '(11) 4204-1249',
  email: 'contato@rgambiental.com.br',
  telefones_gerais: '(11) 4204-1249 | (11) 4204-1186 | (11) 4136-4243 | (11) 4204-3026',
} as const

/** Alias histórico (MTR — bloco transportador nos detalhes JSON). */
export const TRANSPORTADOR_RG_AMBIENTAL_PADRAO = {
  razao_social: RG_AMBIENTAL_DADOS_CORPORATIVOS.razao_social,
  atividade: RG_AMBIENTAL_DADOS_CORPORATIVOS.atividade,
  cnpj: RG_AMBIENTAL_DADOS_CORPORATIVOS.cnpj,
  ie: RG_AMBIENTAL_DADOS_CORPORATIVOS.ie,
  endereco: RG_AMBIENTAL_DADOS_CORPORATIVOS.endereco,
  municipio: RG_AMBIENTAL_DADOS_CORPORATIVOS.municipio,
  bairro: RG_AMBIENTAL_DADOS_CORPORATIVOS.bairro,
  cep: RG_AMBIENTAL_DADOS_CORPORATIVOS.cep,
  estado: RG_AMBIENTAL_DADOS_CORPORATIVOS.estado,
  responsavel: RG_AMBIENTAL_DADOS_CORPORATIVOS.responsavel,
  telefone: RG_AMBIENTAL_DADOS_CORPORATIVOS.telefone,
  email: RG_AMBIENTAL_DADOS_CORPORATIVOS.email,
  telefones_gerais: RG_AMBIENTAL_DADOS_CORPORATIVOS.telefones_gerais,
} as const

export function nomeIndicaRgAmbiental(nome: string | null | undefined): boolean {
  const n = (nome ?? '').toLowerCase()
  return n.includes('rg') && n.includes('ambiental')
}

/** Preenche apenas chaves ainda vazias em `atual`. */
export function preencherCamposVazios<T extends Record<string, string>>(
  atual: T,
  defaults: Partial<T>
): T {
  const o = { ...atual }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const cur = String(o[key] ?? '').trim()
    const def = defaults[key]
    if (!cur && def !== undefined && String(def).trim()) {
      o[key] = def as T[keyof T]
    }
  }
  return o
}

/** Campos cadastrais da RG (exceto operacionais motorista/placa). */
const CHAVES_CADASTRAIS_TRANSPORTADOR_MTR = [
  'razao_social',
  'atividade',
  'cnpj',
  'ie',
  'endereco',
  'municipio',
  'bairro',
  'cep',
  'estado',
  'responsavel',
  'telefone',
  'email',
  'telefones_gerais',
] as const

/** Aplica dados corporativos da RG no bloco transportador da MTR (mantém motorista/placa). */
export function forcarTransportadorRgDetalhesMtr<T extends Record<string, string>>(
  atual: T
): T {
  const o: Record<string, string> = { ...atual }
  for (const key of CHAVES_CADASTRAIS_TRANSPORTADOR_MTR) {
    const def = TRANSPORTADOR_RG_AMBIENTAL_PADRAO[key]
    if (def !== undefined) o[key] = def
  }
  return o as T
}

/** Campos parciais do destinatário quando o destino é a própria RG. */
export function destinatarioRgCamposPadrao(): Record<string, string> {
  return {
    atividade: RG_AMBIENTAL_DADOS_CORPORATIVOS.atividade,
    cnpj: RG_AMBIENTAL_DADOS_CORPORATIVOS.cnpj,
    ie: RG_AMBIENTAL_DADOS_CORPORATIVOS.ie,
    endereco: RG_AMBIENTAL_DADOS_CORPORATIVOS.endereco,
    municipio: RG_AMBIENTAL_DADOS_CORPORATIVOS.municipio,
    bairro: RG_AMBIENTAL_DADOS_CORPORATIVOS.bairro,
    cep: RG_AMBIENTAL_DADOS_CORPORATIVOS.cep,
    estado: RG_AMBIENTAL_DADOS_CORPORATIVOS.estado,
    telefone: RG_AMBIENTAL_DADOS_CORPORATIVOS.telefone,
  }
}

export function comprovanteCamposTransportadorRg(): {
  transportador_razao_social: string
  transportador_telefone: string
} {
  return {
    transportador_razao_social: RG_AMBIENTAL_DADOS_CORPORATIVOS.razao_social,
    transportador_telefone: RG_AMBIENTAL_DADOS_CORPORATIVOS.telefone,
  }
}

export function empresaTicketImpressaoRg(): string {
  return RG_AMBIENTAL_DADOS_CORPORATIVOS.ticket_empresa_impressao
}

export function razaoSocialCabecalhoDocumentosRg(): string {
  return RG_AMBIENTAL_DADOS_CORPORATIVOS.razao_social
}
