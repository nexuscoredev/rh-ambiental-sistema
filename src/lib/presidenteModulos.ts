/** Área do Presidente — visão unificada (câmaras e rastreamento; APIs integradas depois). */

export const PRESIDENTE_HUB_PATH = '/presidente'
export const PRESIDENTE_HUB_LABEL = 'Área do Presidente'

export type CameraStatus = 'online' | 'offline' | 'integracao'

export type PresidenteCamera = {
  id: string
  nome: string
  angulo?: string
  status: CameraStatus
  /** URL do stream — preenchida quando a API estiver ligada. */
  streamUrl?: string | null
}

export type PresidenteSetorSede = {
  slug: string
  path: string
  label: string
  descricao: string
  icone: 'cozinha' | 'sala' | 'recepcao' | 'escritorio' | 'patio' | 'almoxarifado'
  cameras: PresidenteCamera[]
}

export type PresidenteVeiculoMonitor = {
  id: string
  placa: string
  modelo: string
  motorista?: string
  status: 'em_rota' | 'parado' | 'manutencao' | 'offline'
  velocidadeKmh?: number | null
  ultimaAtualizacao?: string
  lat?: number
  lng?: number
  cameras: PresidenteCamera[]
}

export type PresidenteModuloPrincipal = {
  slug: 'sede' | 'frota' | 'balanca' | 'rastreamento'
  path: string
  label: string
  descricao: string
  ordem: number
  badge?: string
}

export const PRESIDENTE_MODULOS: readonly PresidenteModuloPrincipal[] = [
  {
    slug: 'sede',
    path: '/presidente/sede',
    label: 'Instalações RG',
    descricao: 'Câmaras por setor: cozinha, salas, receção, escritório, pátio e mais.',
    ordem: 1,
    badge: '6 setores',
  },
  {
    slug: 'frota',
    path: '/presidente/frota',
    label: 'Frota ao vivo',
    descricao: 'Câmaras em todos os veículos e estado operacional em tempo real.',
    ordem: 2,
    badge: 'Veículos',
  },
  {
    slug: 'balanca',
    path: '/presidente/balanca',
    label: 'Balança',
    descricao: 'Visão das balanças, entrada de camiões e área de pesagem.',
    ordem: 3,
    badge: 'Pesagem',
  },
  {
    slug: 'rastreamento',
    path: '/presidente/rastreamento',
    label: 'Rastreamento',
    descricao: 'Mapa unificado com posição da frota e alertas — integração GPS em breve.',
    ordem: 4,
    badge: 'Mapa',
  },
] as const

const cam = (id: string, nome: string, angulo: string, status: CameraStatus = 'integracao'): PresidenteCamera => ({
  id,
  nome,
  angulo,
  status,
  streamUrl: null,
})

export const PRESIDENTE_SETORES_SEDE: readonly PresidenteSetorSede[] = [
  {
    slug: 'cozinha',
    path: '/presidente/sede/cozinha',
    label: 'Cozinha',
    descricao: 'Área de refeições e copa da sede.',
    icone: 'cozinha',
    cameras: [
      cam('coz-1', 'Cozinha — visão geral', 'Plano aberto'),
      cam('coz-2', 'Despensa', 'Corredor'),
    ],
  },
  {
    slug: 'salas',
    path: '/presidente/sede/salas',
    label: 'Salas de reunião',
    descricao: 'Salas executivas e de equipa.',
    icone: 'sala',
    cameras: [
      cam('sal-1', 'Sala executiva', 'Entrada'),
      cam('sal-2', 'Sala operacional', 'Quadro branco'),
      cam('sal-3', 'Sala de formação', 'Visão ampla'),
    ],
  },
  {
    slug: 'recepcao',
    path: '/presidente/sede/recepcao',
    label: 'Receção',
    descricao: 'Entrada principal e balcão de atendimento.',
    icone: 'recepcao',
    cameras: [cam('rec-1', 'Receção', 'Balcão'), cam('rec-2', 'Hall de entrada', 'Porta principal')],
  },
  {
    slug: 'escritorio',
    path: '/presidente/sede/escritorio',
    label: 'Escritório',
    descricao: 'Open space administrativo e financeiro.',
    icone: 'escritorio',
    cameras: [
      cam('esc-1', 'Open space', 'Visão norte'),
      cam('esc-2', 'Corredor administrativo', 'Lateral'),
    ],
  },
  {
    slug: 'patio',
    path: '/presidente/sede/patio',
    label: 'Pátio',
    descricao: 'Área externa, docas e manobras de veículos leves.',
    icone: 'patio',
    cameras: [
      cam('pat-1', 'Pátio central', 'Torre A'),
      cam('pat-2', 'Doca de carga', 'Lateral leste'),
      cam('pat-3', 'Estacionamento visitantes', 'Entrada'),
    ],
  },
  {
    slug: 'almoxarifado',
    path: '/presidente/sede/almoxarifado',
    label: 'Almoxarifado',
    descricao: 'Armazém de EPIs, consumíveis e peças.',
    icone: 'almoxarifado',
    cameras: [cam('alm-1', 'Almoxarifado', 'Corredor principal'), cam('alm-2', 'Área de expedição', 'Portões')],
  },
] as const

export const PRESIDENTE_CAMERAS_BALANCA: readonly PresidenteCamera[] = [
  cam('bal-1', 'Balança 1 — plataforma', 'Vista superior', 'integracao'),
  cam('bal-2', 'Balança 2 — plataforma', 'Vista superior', 'integracao'),
  cam('bal-3', 'Entrada de camiões', 'Cancela pesagem', 'integracao'),
  cam('bal-4', 'Sala do balanceiro', 'Monitorização', 'integracao'),
]

/** Frota — dados demonstrativos até integração telemática / DVR. */
export const PRESIDENTE_VEICULOS_DEMO: readonly PresidenteVeiculoMonitor[] = [
  {
    id: 'v1',
    placa: 'ABC1D23',
    modelo: 'VUC — Coleta',
    motorista: 'João Silva',
    status: 'em_rota',
    velocidadeKmh: 48,
    ultimaAtualizacao: 'Agora',
    lat: -23.44,
    lng: -47.06,
    cameras: [
      cam('v1-f', 'Cabine frontal', 'Dashcam', 'integracao'),
      cam('v1-t', 'Carroceria traseira', 'Carga', 'integracao'),
    ],
  },
  {
    id: 'v2',
    placa: 'EFG4H56',
    modelo: 'Truck — Resíduos',
    motorista: 'Maria Santos',
    status: 'parado',
    velocidadeKmh: 0,
    ultimaAtualizacao: '2 min',
    lat: -23.45,
    lng: -47.08,
    cameras: [
      cam('v2-f', 'Cabine frontal', 'Dashcam', 'integracao'),
      cam('v2-l', 'Lateral direita', 'Descarga', 'integracao'),
    ],
  },
  {
    id: 'v3',
    placa: 'IJK7L89',
    modelo: 'Poliguindaste',
    status: 'em_rota',
    velocidadeKmh: 62,
    ultimaAtualizacao: 'Agora',
    lat: -23.42,
    lng: -47.12,
    cameras: [cam('v3-f', 'Cabine frontal', 'Dashcam', 'integracao')],
  },
  {
    id: 'v4',
    placa: 'MNO0P12',
    modelo: 'Caminhão pipa',
    status: 'manutencao',
    velocidadeKmh: null,
    ultimaAtualizacao: '1 h',
    cameras: [cam('v4-f', 'Oficina — baia 2', 'Fixa', 'offline')],
  },
]

export function presidenteSetorPorSlug(slug: string): PresidenteSetorSede | undefined {
  return PRESIDENTE_SETORES_SEDE.find((s) => s.slug === slug)
}

export function presidenteVeiculoPorId(id: string): PresidenteVeiculoMonitor | undefined {
  return PRESIDENTE_VEICULOS_DEMO.find((v) => v.id === id)
}

export function presidenteContarCameras(): number {
  const sede = PRESIDENTE_SETORES_SEDE.reduce((n, s) => n + s.cameras.length, 0)
  const frota = PRESIDENTE_VEICULOS_DEMO.reduce((n, v) => n + v.cameras.length, 0)
  return sede + frota + PRESIDENTE_CAMERAS_BALANCA.length
}

export const PRESIDENTE_MENU_CHILDREN: { label: string; path: string }[] = PRESIDENTE_MODULOS.map(
  (m) => ({ label: m.label, path: m.path })
)

export const PRESIDENTE_ROTAS_SISTEMA: { path: string; label: string }[] = [
  { path: PRESIDENTE_HUB_PATH, label: PRESIDENTE_HUB_LABEL },
  ...PRESIDENTE_MODULOS.map((m) => ({ path: m.path, label: m.label })),
  ...PRESIDENTE_SETORES_SEDE.map((s) => ({ path: s.path, label: `Sede · ${s.label}` })),
]
