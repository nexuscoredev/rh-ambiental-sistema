/** Tipos da base de conhecimento — Treinamentos RH (fluxo operacional). */

export type KbRotaSistema = {
  path: string
  label: string
}

export type KbCampo = {
  nome: string
  significado: string
}

export type KbPasso = {
  titulo: string
  descricao: string
  dica?: string
}

export type KbCaptura = {
  /** Caminho público, ex.: /assets/treinamento/frota-hub-transportes.svg */
  src: string
  alt: string
  legenda?: string
}

export type KbSecao = {
  id: string
  titulo: string
  paragrafos?: string[]
  passos?: KbPasso[]
  campos?: KbCampo[]
  capturas?: KbCaptura[]
  dicas?: string[]
  aviso?: string
}

export type KbArtigo = {
  slug: string
  ordem: number
  titulo: string
  resumo: string
  emoji: string
  accent: string
  accentSoft: string
  rotaSistema?: KbRotaSistema
  tags: string[]
  secoes: KbSecao[]
}

export type KbFluxoEtapa = {
  ordem: number
  titulo: string
  resumo: string
  artigoSlug: string
  emoji: string
}
