import {
  equipamentoContratoInicial,
  normalizarListasContratoForm,
  residuoContratoInicial,
  veiculoContratoInicial,
  type EquipamentoContratoItem,
  type ResiduoContratoItem,
  type VeiculoContratoItem,
} from './clienteContratoCadastro'
import type { MtrSigorOpcao } from './mtrSigorCliente'
import {
  empresaGrupoFaturamentoInicial,
  type EmpresaGrupoFaturamentoForm,
} from './clienteEmpresaGrupoFaturamento'

export type ResiduoForm = ResiduoContratoItem

export type FormCliente = {
  nome: string
  razao_social: string
  cnpj: string
  status: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  endereco_coleta: string
  cep_faturamento: string
  rua_faturamento: string
  numero_faturamento: string
  complemento_faturamento: string
  bairro_faturamento: string
  cidade_faturamento: string
  estado_faturamento: string
  gerador_dono_faturamento: string
  faturamento_titular_razao_social: string
  faturamento_titular_cnpj: string
  empresa_grupo_faturamento: EmpresaGrupoFaturamentoForm
  email_nf: string
  margem_lucro_percentual: string
  responsavel_nome: string
  telefone: string
  email: string
  licenca_numero: string
  validade: string
  codigo_ibama: string
  descricao_veiculo: string
  mtr_coleta: string
  destino: string
  mtr_destino: string
  residuo_destino: string
  observacoes_operacionais: string
  observacoes_gerais: string
  link_google_maps: string
  ajudante: string
  solicitante: string
  origem_planilha_cliente: string
  mtr_sigor: MtrSigorOpcao | null
  cnpj_raiz: string
  tipo_unidade_cliente: string
  status_ativo_desde: string
  status_inativo_desde: string
  representante_rg_id: string
  caminhao_id: string
  equipamentos: string
  veiculos_contrato: VeiculoContratoItem[]
  equipamentos_contrato: EquipamentoContratoItem[]
  residuos: ResiduoForm[]
}

const residuoInicial: ResiduoForm = { ...residuoContratoInicial() }

export const formClienteInicial: FormCliente = {
  nome: '',
  razao_social: '',
  cnpj: '',
  status: 'Ativo',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  endereco_coleta: '',
  cep_faturamento: '',
  rua_faturamento: '',
  numero_faturamento: '',
  complemento_faturamento: '',
  bairro_faturamento: '',
  cidade_faturamento: '',
  estado_faturamento: '',
  gerador_dono_faturamento: '',
  faturamento_titular_razao_social: '',
  faturamento_titular_cnpj: '',
  empresa_grupo_faturamento: { ...empresaGrupoFaturamentoInicial },
  email_nf: '',
  margem_lucro_percentual: '',
  responsavel_nome: '',
  telefone: '',
  email: '',
  licenca_numero: '',
  validade: '',
  codigo_ibama: '',
  descricao_veiculo: '',
  mtr_coleta: '',
  destino: '',
  mtr_destino: '',
  residuo_destino: '',
  observacoes_operacionais: '',
  observacoes_gerais: '',
  link_google_maps: '',
  ajudante: '',
  solicitante: '',
  origem_planilha_cliente: '',
  mtr_sigor: null,
  cnpj_raiz: '',
  tipo_unidade_cliente: '',
  status_ativo_desde: '',
  status_inativo_desde: '',
  representante_rg_id: '',
  caminhao_id: '',
  equipamentos: '',
  veiculos_contrato: [veiculoContratoInicial()],
  equipamentos_contrato: [equipamentoContratoInicial()],
  residuos: [{ ...residuoInicial }],
}

export function limparOuNull(valor: string): string | null {
  const texto = valor.trim()
  return texto === '' ? null : texto
}

export function formatarCNPJ(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14)
  if (digitos.length <= 11) {
    if (digitos.length <= 3) return digitos
    if (digitos.length <= 6) return digitos.replace(/^(\d{3})(\d+)/, '$1.$2')
    if (digitos.length <= 9) return digitos.replace(/^(\d{3})(\d{3})(\d+)/, '$1.$2.$3')
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4')
  }
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 5) return digitos.replace(/^(\d{2})(\d+)/, '$1.$2')
  if (digitos.length <= 8) return digitos.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3')
  if (digitos.length <= 12) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4')
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d+)/, '$1.$2.$3/$4-$5')
}

export function derivarDadosUnidadeDocumento(
  valor: string
): Pick<FormCliente, 'cnpj_raiz' | 'tipo_unidade_cliente'> {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length === 11) return { cnpj_raiz: '', tipo_unidade_cliente: 'Pessoa física' }
  if (digitos.length !== 14) return { cnpj_raiz: '', tipo_unidade_cliente: '' }
  return {
    cnpj_raiz: digitos.slice(0, 8),
    tipo_unidade_cliente: digitos.slice(8, 12) === '0001' ? 'Matriz' : 'Filial',
  }
}

export function nomeExibicaoGerenciador(form: FormCliente): string {
  const n = form.nome.trim() || form.razao_social.trim() || form.cnpj.trim()
  return n || 'Sem identificação'
}

export function formClienteFromJson(dados: unknown): FormCliente {
  if (!dados || typeof dados !== 'object') return { ...formClienteInicial }
  const partial = dados as Partial<FormCliente>
  return normalizarListasContratoForm({
    ...formClienteInicial,
    ...partial,
    empresa_grupo_faturamento: {
      ...empresaGrupoFaturamentoInicial,
      ...(partial.empresa_grupo_faturamento ?? {}),
    },
  })
}
