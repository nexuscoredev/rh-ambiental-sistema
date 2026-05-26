import { supabase } from './supabase'
import { CHAT_FIGURINHA_CONTEUDO, chatEnviarAnexo } from './chat'
import type { ChatMensagem } from '../types/chat'

export const STICKER_BUCKET = 'chat-stickers'

export type ChatStickerPack = {
  id: string
  nome: string
  ordem: number
}

export type ChatSticker = {
  id: string
  pack_id: string
  titulo: string | null
  storage_path: string
  mime: string
  animado: boolean
  ordem: number
}

export function chatMensagemEhFigurinha(m: ChatMensagem): boolean {
  return (
    m.conteudo?.trim() === CHAT_FIGURINHA_CONTEUDO &&
    !!m.anexo_path &&
    !!m.anexo_mime?.startsWith('image/')
  )
}

export function chatStickerPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(STICKER_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function chatListarStickerPacks(): Promise<ChatStickerPack[]> {
  const { data, error } = await supabase
    .from('chat_sticker_packs')
    .select('id, nome, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true })

  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return []
    throw error
  }
  return (data ?? []) as ChatStickerPack[]
}

export async function chatListarStickers(packId?: string): Promise<ChatSticker[]> {
  let q = supabase
    .from('chat_stickers')
    .select('id, pack_id, titulo, storage_path, mime, animado, ordem')
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (packId) q = q.eq('pack_id', packId)

  const { data, error } = await q
  if (error) {
    if (/does not exist|relation|42P01/i.test(error.message)) return []
    throw error
  }
  return (data ?? []) as ChatSticker[]
}

function sanitizarNomeSticker(nome: string): string {
  return nome.replace(/[^\w.\-() áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/gi, '_').slice(0, 80)
}

function mimePermitidoSticker(mime: string): boolean {
  const t = mime.toLowerCase()
  return t === 'image/png' || t === 'image/jpeg' || t === 'image/webp' || t === 'image/gif'
}

export async function chatCriarStickerPack(nome: string): Promise<ChatStickerPack> {
  const nomeTrim = nome.trim()
  if (!nomeTrim) throw new Error('Informe o nome do pack.')

  const { data, error } = await supabase
    .from('chat_sticker_packs')
    .insert({ nome: nomeTrim, ordem: 999 })
    .select('id, nome, ordem')
    .single()

  if (error) throw new Error(error.message || 'Não foi possível criar o pack.')
  return data as ChatStickerPack
}

export async function chatAdicionarSticker(opts: {
  packId: string
  ficheiro: File
  titulo?: string
}): Promise<ChatSticker> {
  const f = opts.ficheiro
  if (!f.size) throw new Error('Ficheiro vazio.')
  if (f.size > 5 * 1024 * 1024) throw new Error('Imagem demasiado grande (máx. 5 MB).')
  const mime = (f.type || 'image/png').toLowerCase()
  if (!mimePermitidoSticker(mime)) {
    throw new Error('Use PNG, JPG, WebP ou GIF.')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão inválida.')

  const animado = mime === 'image/gif' || mime === 'image/webp'
  const path = `${opts.packId}/${crypto.randomUUID()}_${sanitizarNomeSticker(f.name || 'figurinha.png')}`

  const { error: upErr } = await supabase.storage.from(STICKER_BUCKET).upload(path, f, {
    cacheControl: '31536000',
    upsert: false,
    contentType: mime,
  })
  if (upErr) throw new Error(upErr.message || 'Falha ao enviar imagem.')

  const { data, error } = await supabase
    .from('chat_stickers')
    .insert({
      pack_id: opts.packId,
      titulo: opts.titulo?.trim() || null,
      storage_path: path,
      mime,
      animado,
      created_by: user.id,
    })
    .select('id, pack_id, titulo, storage_path, mime, animado, ordem')
    .single()

  if (error) {
    await supabase.storage.from(STICKER_BUCKET).remove([path])
    throw new Error(error.message || 'Não foi possível registar a figurinha.')
  }

  return data as ChatSticker
}

export async function chatEnviarFigurinha(
  conversaId: string,
  meuId: string,
  sticker: ChatSticker
): Promise<ChatMensagem> {
  const { data: blob, error: dlErr } = await supabase.storage.from(STICKER_BUCKET).download(sticker.storage_path)
  if (dlErr || !blob) throw new Error('Não foi possível carregar a figurinha.')

  const ext =
    sticker.mime === 'image/jpeg'
      ? 'jpg'
      : sticker.mime === 'image/webp'
        ? 'webp'
        : sticker.mime === 'image/gif'
          ? 'gif'
          : 'png'
  const nome = `figurinha-${(sticker.titulo || sticker.id).slice(0, 40)}.${ext}`
  const ficheiro = new File([blob], nome, { type: sticker.mime || 'image/png' })
  return chatEnviarAnexo(conversaId, meuId, ficheiro, CHAT_FIGURINHA_CONTEUDO)
}
