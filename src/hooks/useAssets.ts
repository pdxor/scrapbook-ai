import { useState, useEffect, useCallback } from 'react'
import type { Asset, AssetType } from '../types'
import { fetchAssets, uploadAsset, deleteAsset, generateImage } from '../lib/api'

export function useAssets(type: AssetType) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAssets(type)
      setAssets(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => { refresh() }, [refresh])

  const upload = useCallback(async (file: File) => {
    setError(null)
    try {
      await uploadAsset(type, file)
      await refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }, [type, refresh])

  const remove = useCallback(async (filename: string) => {
    setError(null)
    try {
      await deleteAsset(type, filename)
      await refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }, [type, refresh])

  const generate = useCallback(async (prompt: string) => {
    setGenerating(true)
    setError(null)
    try {
      await generateImage(type, prompt)
      await refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }, [type, refresh])

  return { assets, loading, generating, error, upload, remove, generate, refresh }
}
