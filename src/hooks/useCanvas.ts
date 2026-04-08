import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { CanvasElementData } from '../types'

const MAX_ELEMENT_SIZE = 200

export function useCanvas() {
  const [elements, setElements] = useState<CanvasElementData[]>([])
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addElement = useCallback((assetUrl: string, type: 'character' | 'object') => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = assetUrl
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight
      let width: number, height: number
      if (ratio >= 1) {
        width = MAX_ELEMENT_SIZE
        height = MAX_ELEMENT_SIZE / ratio
      } else {
        height = MAX_ELEMENT_SIZE
        width = MAX_ELEMENT_SIZE * ratio
      }

      const el: CanvasElementData = {
        id: uuidv4(),
        assetUrl,
        x: 300 + Math.random() * 200,
        y: 200 + Math.random() * 200,
        width,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        type,
      }
      setElements(prev => [...prev, el])
      setSelectedId(el.id)
    }
  }, [])

  const updateElement = useCallback((id: string, updates: Partial<CanvasElementData>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el))
  }, [])

  const removeElement = useCallback((id: string) => {
    setElements(prev => prev.filter(el => el.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const bringForward = useCallback((id: string) => {
    setElements(prev => {
      const idx = prev.findIndex(el => el.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const sendBackward = useCallback((id: string) => {
    setElements(prev => {
      const idx = prev.findIndex(el => el.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const flipHorizontal = useCallback((id: string) => {
    setElements(prev => prev.map(el =>
      el.id === id ? { ...el, scaleX: el.scaleX > 0 ? -1 : 1 } : el
    ))
  }, [])

  const flipVertical = useCallback((id: string) => {
    setElements(prev => prev.map(el =>
      el.id === id ? { ...el, scaleY: el.scaleY > 0 ? -1 : 1 } : el
    ))
  }, [])

  const rotate90 = useCallback((id: string, direction: 'cw' | 'ccw' = 'cw') => {
    setElements(prev => prev.map(el =>
      el.id === id ? { ...el, rotation: el.rotation + (direction === 'cw' ? 90 : -90) } : el
    ))
  }, [])

  const clearCanvas = useCallback(() => {
    setElements([])
    setBackgroundUrl(null)
    setSelectedId(null)
  }, [])

  return {
    elements,
    backgroundUrl,
    selectedId,
    setBackgroundUrl,
    setSelectedId,
    addElement,
    updateElement,
    removeElement,
    bringForward,
    sendBackward,
    flipHorizontal,
    flipVertical,
    rotate90,
    clearCanvas,
  }
}
