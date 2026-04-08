import { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import type { TimelineFrame as TFrame } from '../types'

interface TimelineFrameProps {
  frame: TFrame
  index: number
  onReorder: (dragIndex: number, hoverIndex: number) => void
  onUpdateTitle: (id: string, title: string) => void
  onRemove: (id: string) => void
}

const ITEM_TYPE = 'TIMELINE_FRAME'

export function TimelineFrameCard({ frame, index, onReorder, onUpdateTitle, onRemove }: TimelineFrameProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return

      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) return
      const hoverClientX = clientOffset.x - hoverBoundingRect.left

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return

      onReorder(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
  })

  drag(drop(ref))

  return (
    <div
      ref={ref}
      className={`glass-card flex-shrink-0 w-44 overflow-hidden group ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
      style={{ cursor: 'grab' }}
    >
      <img
        src={frame.imageDataUrl}
        alt={frame.title}
        className="w-full aspect-video object-cover rounded-t-[16px]"
        draggable={false}
      />
      <div className="px-2.5 py-2 flex items-center gap-1">
        <input
          value={frame.title}
          onChange={e => onUpdateTitle(frame.id, e.target.value)}
          className="flex-1 bg-transparent text-[10px] font-medium text-[var(--color-text)] border-none outline-none min-w-0"
          onClick={e => e.stopPropagation()}
        />
        <button
          onClick={() => onRemove(frame.id)}
          className="w-5 h-5 rounded-full text-[10px] bg-white/60 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center"
        >
          x
        </button>
      </div>
    </div>
  )
}
