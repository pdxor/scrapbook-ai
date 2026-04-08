import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import type { CanvasElementData } from '../types'
import { CanvasElement } from './CanvasElement'

interface CompositionCanvasProps {
  elements: CanvasElementData[]
  backgroundUrl: string | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, updates: Partial<CanvasElementData>) => void
  onRemove: (id: string) => void
  onBringForward: (id: string) => void
  onSendBackward: (id: string) => void
}

const BASE_WIDTH = 1024

export function CompositionCanvas({
  elements,
  backgroundUrl,
  selectedId,
  onSelect,
  onUpdate,
  onRemove,
}: CompositionCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [canvasWidth, setCanvasWidth] = useState(BASE_WIDTH)
  const [canvasHeight, setCanvasHeight] = useState(576)

  useEffect(() => {
    if (!backgroundUrl) {
      setBgImage(null)
      setCanvasWidth(BASE_WIDTH)
      setCanvasHeight(576)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = backgroundUrl
    img.onload = () => {
      setBgImage(img)
      const ratio = img.naturalHeight / img.naturalWidth
      setCanvasWidth(BASE_WIDTH)
      setCanvasHeight(Math.round(BASE_WIDTH * ratio))
    }
  }, [backgroundUrl])

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.offsetWidth - 24
      const h = containerRef.current.offsetHeight - 24
      setScale(Math.min(1, w / canvasWidth, h / canvasHeight))
    }
    resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { window.removeEventListener('resize', resize); ro.disconnect() }
  }, [canvasWidth, canvasHeight])

  const getDataUrl = useCallback((): string | null => {
    if (!stageRef.current) return null
    const oldScale = stageRef.current.scale()
    const oldSize = stageRef.current.size()
    stageRef.current.scale({ x: 1, y: 1 })
    stageRef.current.size({ width: canvasWidth, height: canvasHeight })
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 })
    stageRef.current.scale(oldScale)
    stageRef.current.size(oldSize)
    return dataUrl
  }, [canvasWidth, canvasHeight])

  const getBlob = useCallback(async (): Promise<Blob | null> => {
    const dataUrl = getDataUrl()
    if (!dataUrl) return null
    const res = await fetch(dataUrl)
    return res.blob()
  }, [getDataUrl])

  useEffect(() => {
    (window as any).__canvasGetDataUrl = getDataUrl;
    (window as any).__canvasGetBlob = getBlob
    return () => {
      delete (window as any).__canvasGetDataUrl
      delete (window as any).__canvasGetBlob
    }
  }, [getDataUrl, getBlob])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedId) return
    if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
      onRemove(selectedId)
    }
  }, [selectedId, onRemove])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-auto"
      style={{ background: '#e8e8e8' }}
    >
      <Stage
        ref={stageRef}
        width={canvasWidth * scale}
        height={canvasHeight * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={e => {
          if (e.target === e.target.getStage()) onSelect(null)
        }}
        style={{
          borderRadius: '8px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <Layer>
          {bgImage && (
            <KonvaImage
              image={bgImage}
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
            />
          )}
          {elements.map(el => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={el.id === selectedId}
              onSelect={() => onSelect(el.id)}
              onChange={updates => onUpdate(el.id, updates)}
              stageScale={scale}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
