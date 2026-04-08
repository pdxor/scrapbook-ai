import { useRef, useEffect, useState } from 'react'
import { Image as KonvaImage, Transformer } from 'react-konva'
import type { CanvasElementData } from '../types'
import Konva from 'konva'

interface CanvasElementProps {
  element: CanvasElementData
  isSelected: boolean
  onSelect: () => void
  onChange: (updates: Partial<CanvasElementData>) => void
  stageScale: number
}

export function CanvasElement({ element, isSelected, onSelect, onChange, stageScale }: CanvasElementProps) {
  const imageRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = element.assetUrl
    img.onload = () => setImage(img)
  }, [element.assetUrl])

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected, image])

  if (!image) return null

  const handleSize = Math.min(14, Math.max(5, Math.round(6 / stageScale)))

  return (
    <>
      <KonvaImage
        ref={imageRef}
        image={image}
        x={element.x}
        y={element.y}
        offsetX={element.width / 2}
        offsetY={element.height / 2}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        scaleX={element.scaleX}
        scaleY={element.scaleY}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={e => {
          onChange({ x: e.target.x(), y: e.target.y() })
        }}
        onTransformEnd={() => {
          const node = imageRef.current
          if (!node) return
          const sx = node.scaleX()
          const sy = node.scaleY()
          const flipX = sx < 0 ? -1 : 1
          const flipY = sy < 0 ? -1 : 1
          const newWidth = Math.max(20, node.width() * Math.abs(sx))
          const newHeight = Math.max(20, node.height() * Math.abs(sy))
          node.scaleX(flipX)
          node.scaleY(flipY)
          node.width(newWidth)
          node.height(newHeight)
          node.offsetX(newWidth / 2)
          node.offsetY(newHeight / 2)
          onChange({
            x: node.x(),
            y: node.y(),
            width: newWidth,
            height: newHeight,
            rotation: node.rotation(),
            scaleX: flipX,
            scaleY: flipY,
          })
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio
          anchorSize={handleSize}
          anchorCornerRadius={Math.max(1, Math.round(2 / stageScale))}
          anchorStroke="#546246"
          anchorFill="#ffffff"
          anchorStrokeWidth={Math.max(0.5, 1 / stageScale)}
          borderStroke="#546246"
          borderStrokeWidth={Math.max(0.5, 1 / stageScale)}
          borderDash={[Math.round(4 / stageScale), Math.round(3 / stageScale)]}
          rotateAnchorOffset={Math.min(20, Math.max(10, Math.round(14 / stageScale)))}
          rotateAnchorCursor="grab"
          enabledAnchors={[
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
          ]}
          boundBoxFunc={(_oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return _oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}
