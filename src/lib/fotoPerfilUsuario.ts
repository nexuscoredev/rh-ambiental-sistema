import type { SupabaseClient } from '@supabase/supabase-js'

export const EVENTO_FOTO_PERFIL_ATUALIZADA = 'rg-foto-perfil-atualizada'

export type FotoPerfilAtualizadaDetail = { foto_url: string }

const EXTENSOES = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const
const TAMANHO_MAX_BYTES = 5 * 1024 * 1024

export function emitirFotoPerfilAtualizada(fotoUrl: string) {
  window.dispatchEvent(
    new CustomEvent<FotoPerfilAtualizadaDetail>(EVENTO_FOTO_PERFIL_ATUALIZADA, {
      detail: { foto_url: fotoUrl },
    })
  )
}

export function validarArquivoFotoPerfil(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Escolha um ficheiro de imagem (JPEG, PNG, WebP ou GIF).'
  }
  if (file.size > TAMANHO_MAX_BYTES) {
    return 'A imagem deve ter no máximo 5 MB.'
  }
  return null
}

export type UploadFotoPerfilResult =
  | { ok: true; publicUrl: string }
  | { ok: false; mensagem: string }

export async function uploadFotoPerfilUsuario(
  client: SupabaseClient,
  file: File,
  userId: string
): Promise<UploadFotoPerfilResult> {
  const validacao = validarArquivoFotoPerfil(file)
  if (validacao) return { ok: false, mensagem: validacao }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const extSeguro = ext && EXTENSOES.includes(ext as (typeof EXTENSOES)[number]) ? ext : 'jpg'
  const path = `${userId}/avatar.${extSeguro}`

  const { error: uploadError } = await client.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  })

  if (uploadError) {
    console.error(uploadError)
    return {
      ok: false,
      mensagem:
        'Não foi possível enviar a foto. Aplique a migração do bucket avatars no Supabase ou tente novamente.',
    }
  }

  const { data: publicData } = client.storage.from('avatars').getPublicUrl(path)
  const publicUrl = publicData.publicUrl

  const { error: updateError } = await client
    .from('usuarios')
    .update({ foto_url: publicUrl })
    .eq('id', userId)

  if (updateError) {
    console.error(updateError)
    return {
      ok: false,
      mensagem:
        'A foto foi enviada, mas falhou ao gravar o endereço no perfil. Verifique as políticas RLS em usuarios.',
    }
  }

  emitirFotoPerfilAtualizada(publicUrl)
  return { ok: true, publicUrl }
}
