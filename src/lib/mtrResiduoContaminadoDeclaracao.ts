import { quantidadeMtrLegadaParaKg, formatarPesoKgCampoContrato } from './clienteContratoCadastro'
import { resolverNomeGeradorMtr } from './mtrNomeGerador'

/** Dados fixos do Anexo 2 (RG Ambiental — destino e transporte). */
export const DECLARACAO_RESIDUO_RG_ANEXO2 = {
  razao_social: 'RG AMBIENTAL TRANSPORTES LTDA',
  cnpj: '02.785.402/0001-74',
  endereco: 'Estrada de Araçariguama, 321 – Distrito Industrial – Araçariguama/SP.',
  responsavel: 'Ezequiel Novaes',
  email: 'logistica@rgambiental.com.br',
  telefone: '(11) 4204-1249',
} as const

export type EstadoFisicoDeclaracao = 'solido' | 'liquido' | 'pastoso' | 'lodo' | ''

export type DeclaracaoResiduoContaminadoDados = {
  numeroMtr: string
  gerador: {
    razaoSocial: string
    cnpj: string
    endereco: string
  }
  quantidadeKg: string
  /** Texto fixo do modelo: EFLUENTE */
  classeResiduo: string
  estadoFisico: EstadoFisicoDeclaracao
  destino: typeof DECLARACAO_RESIDUO_RG_ANEXO2
  transporte: typeof DECLARACAO_RESIDUO_RG_ANEXO2
  assinatura: {
    responsavel: string
    departamento: string
    email: string
    telefone: string
    data: string
  }
}

export type MtrParaDeclaracaoResiduo = {
  numero: string
  cliente: string
  gerador: string
  endereco: string
  cidade: string
  tipo_residuo: string
  quantidade: number | null
  unidade: string
  detalhes?: {
    gerador?: {
      cnpj?: string
      bairro?: string
      cep?: string
      estado?: string
      cidade?: string
      responsavel?: string
      telefone?: string
    }
    residuo?: {
      estado_fisico?: string
      quantidade_aproximada?: string
    }
  } | null
}

function normalizarTexto(s: string): string {
  return s
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

export function estadoFisicoDeclaracaoDesdeTexto(raw: string | null | undefined): EstadoFisicoDeclaracao {
  const n = normalizarTexto(String(raw ?? ''))
  if (!n) return ''
  if (n.includes('liquid')) return 'liquido'
  if (n.includes('past')) return 'pastoso'
  if (n.includes('lodo')) return 'lodo'
  if (n.includes('solid')) return 'solido'
  return ''
}

function enderecoGeradorDeclaracao(mtr: MtrParaDeclaracaoResiduo): string {
  const g = mtr.detalhes?.gerador
  const partes: string[] = []
  const rua = (mtr.endereco || '').trim()
  if (rua) partes.push(rua)
  const bairro = (g?.bairro || '').trim()
  if (bairro) partes.push(bairro)
  const cidadeTopo = (mtr.cidade || '').trim()
  const cidadeDet = (g?.cidade || '').trim()
  const uf = (g?.estado || '').trim()
  let municipio = cidadeTopo || cidadeDet
  if (municipio && uf && !municipio.includes('/')) {
    municipio = `${municipio}/${uf}`
  } else if (!municipio && uf) {
    municipio = uf
  }
  if (municipio) partes.push(municipio)
  const cep = (g?.cep || '').trim()
  if (cep) partes.push(`CEP ${cep}`)
  return partes.join(' – ') || '—'
}

function quantidadeKgDeclaracao(mtr: MtrParaDeclaracaoResiduo): string {
  const qtdRaw = (mtr.detalhes?.residuo?.quantidade_aproximada || '').trim()
  if (qtdRaw) {
    const nums = qtdRaw.replace(/[^\d.,]/g, '').replace(',', '.')
    if (nums) return nums
  }
  const kg = quantidadeMtrLegadaParaKg(mtr.quantidade, mtr.unidade)
  if (kg != null && kg > 0) {
    return formatarPesoKgCampoContrato(String(kg)).replace(/[^\d.,]/g, '').replace(',', '.') || String(kg)
  }
  return ''
}

function dataHojeBr(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function montarDeclaracaoResiduoContaminadoFromMtr(mtr: MtrParaDeclaracaoResiduo): DeclaracaoResiduoContaminadoDados {
  const g = mtr.detalhes?.gerador
  const razao = resolverNomeGeradorMtr({
    gerador: mtr.gerador,
    cliente: mtr.cliente,
    tipoResiduo: mtr.tipo_residuo,
  }).trim()

  return {
    numeroMtr: (mtr.numero || '').trim(),
    gerador: {
      razaoSocial: razao || (mtr.cliente || '').trim() || '—',
      cnpj: (g?.cnpj || '').trim() || '—',
      endereco: enderecoGeradorDeclaracao(mtr),
    },
    quantidadeKg: quantidadeKgDeclaracao(mtr),
    classeResiduo: 'EFLUENTE',
    estadoFisico: estadoFisicoDeclaracaoDesdeTexto(mtr.detalhes?.residuo?.estado_fisico),
    destino: DECLARACAO_RESIDUO_RG_ANEXO2,
    transporte: DECLARACAO_RESIDUO_RG_ANEXO2,
    assinatura: {
      responsavel: (g?.responsavel || '').trim(),
      departamento: '',
      email: '',
      telefone: (g?.telefone || '').trim(),
      data: dataHojeBr(),
    },
  }
}

export function avisosConferenciaDeclaracao(d: DeclaracaoResiduoContaminadoDados): string[] {
  const f: string[] = []
  if (!d.gerador.razaoSocial || d.gerador.razaoSocial === '—') f.push('Razão social do gerador')
  if (!d.gerador.cnpj || d.gerador.cnpj === '—') f.push('CNPJ do gerador')
  if (!d.gerador.endereco || d.gerador.endereco === '—') f.push('Endereço do gerador')
  if (!d.quantidadeKg.trim()) f.push('Quantidade (Kg)')
  if (!d.estadoFisico) f.push('Estado físico (marque Sólido, Líquido, Pastoso ou Lodo)')
  return f
}
