import type { Asset, AssetType } from '../types'

const BASE = '/api'

export async function fetchAssets(type: AssetType): Promise<Asset[]> {
  const res = await fetch(`${BASE}/assets/${type}`)
  if (!res.ok) throw new Error(`Failed to fetch ${type}`)
  return res.json()
}

export async function uploadAsset(type: AssetType, file: File): Promise<Asset> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/assets/${type}`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Failed to upload to ${type}`)
  return res.json()
}

export async function deleteAsset(type: AssetType, filename: string): Promise<void> {
  const res = await fetch(`${BASE}/assets/${type}/${filename}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete ${filename}`)
}

export async function generateImage(type: AssetType, prompt: string): Promise<Asset> {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, prompt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Generation failed')
  }
  return res.json()
}

export interface RefineResult {
  url: string
  filename: string
  masked: boolean
  editPercent: number
}

export async function refineComposite(imageBlob: Blob, prompt: string): Promise<RefineResult> {
  const form = new FormData()
  form.append('image', imageBlob, 'composite.png')
  form.append('prompt', prompt)
  const res = await fetch(`${BASE}/refine`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Refinement failed')
  }
  return res.json()
}

export interface CompositeResult {
  url: string
  filename: string
  stage: 'placed' | 'refined'
  placedUrl?: string
}

export async function compositeAndRefine(
  backgroundUrl: string | null,
  elements: { assetUrl: string; x: number; y: number; width: number; height: number; rotation: number; flipH?: boolean; flipV?: boolean }[],
  refine: boolean,
  prompt?: string,
): Promise<CompositeResult> {
  const res = await fetch(`${BASE}/composite/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backgroundUrl, elements, refine, prompt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Composite pipeline failed')
  }
  return res.json()
}

export async function saveComposite(imageBlob: Blob, name?: string): Promise<Asset> {
  const form = new FormData()
  form.append('image', imageBlob, name || 'composite.png')
  const res = await fetch(`${BASE}/export/composite`, { method: 'POST', body: form })
  if (!res.ok) throw new Error('Failed to save composite')
  return res.json()
}

export async function exportStoryboard(frames: { dataUrl: string; title: string }[]): Promise<{ files: string[] }> {
  const res = await fetch(`${BASE}/export/storyboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames }),
  })
  if (!res.ok) throw new Error('Failed to export storyboard')
  return res.json()
}
