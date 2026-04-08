import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { TimelineFrame } from '../types'

export function useTimeline() {
  const [frames, setFrames] = useState<TimelineFrame[]>([])

  const addFrame = useCallback((imageDataUrl: string) => {
    setFrames(prev => {
      const num = prev.length + 1
      return [...prev, {
        id: uuidv4(),
        imageDataUrl,
        title: `scene-${String(num).padStart(3, '0')}`,
      }]
    })
  }, [])

  const removeFrame = useCallback((id: string) => {
    setFrames(prev => prev.filter(f => f.id !== id))
  }, [])

  const updateFrameTitle = useCallback((id: string, title: string) => {
    setFrames(prev => prev.map(f => f.id === id ? { ...f, title } : f))
  }, [])

  const reorderFrames = useCallback((dragIndex: number, hoverIndex: number) => {
    setFrames(prev => {
      const next = [...prev]
      const [removed] = next.splice(dragIndex, 1)
      next.splice(hoverIndex, 0, removed)
      return next
    })
  }, [])

  const clearTimeline = useCallback(() => setFrames([]), [])

  return { frames, addFrame, removeFrame, updateFrameTitle, reorderFrames, clearTimeline }
}
