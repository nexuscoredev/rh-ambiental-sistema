import { supabase } from './supabase'

const BUCKET = 'caminhoes-fotos'

export async function uploadFotosFrota(arquivos: File[], prefixo: string): Promise<string[]> {
  const urls: string[] = []
  for (const file of arquivos) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `frota/${prefixo}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    if (data.publicUrl) urls.push(data.publicUrl)
  }
  return urls
}

export function parseFotosJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}
