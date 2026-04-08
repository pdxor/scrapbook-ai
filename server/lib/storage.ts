import { supabase } from './supabase.js'

const ASSETS_BUCKET = 'assets'
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

export function getAssetPublicUrl(type: string, filename: string): string {
  const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(`${type}/${filename}`)
  return data.publicUrl
}

export async function listAssets(type: string) {
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(type, { sortBy: { column: 'created_at', order: 'desc' } })

  if (error) throw new Error(`Failed to list ${type}: ${error.message}`)

  return (data || [])
    .filter(f => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      return IMAGE_EXTS.includes(ext)
    })
    .map(f => ({
      filename: f.name,
      url: getAssetPublicUrl(type, f.name),
      type,
    }))
}

export async function uploadAssetBuffer(
  type: string,
  filename: string,
  buffer: Buffer,
  contentType = 'image/png',
): Promise<string> {
  const storagePath = `${type}/${filename}`
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true })

  if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`)
  return getAssetPublicUrl(type, filename)
}

export async function deleteAssetFile(type: string, filename: string): Promise<void> {
  const { error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .remove([`${type}/${filename}`])

  if (error) throw new Error(`Delete failed: ${error.message}`)
}

export async function downloadFromUrl(url: string): Promise<Buffer> {
  if (url.startsWith('data:image')) {
    const base64 = url.replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(base64, 'base64')
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Failed to download: ${resp.status} ${url}`)
    return Buffer.from(await resp.arrayBuffer())
  }

  throw new Error(`Unsupported URL: ${url.substring(0, 80)}`)
}
