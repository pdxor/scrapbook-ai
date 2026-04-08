import type { TimelineFrame } from '../types'
import { TimelineFrameCard } from './TimelineFrame'

interface TimelineProps {
  frames: TimelineFrame[]
  onReorder: (dragIndex: number, hoverIndex: number) => void
  onUpdateTitle: (id: string, title: string) => void
  onRemove: (id: string) => void
  onExport: () => void
  exporting: boolean
  onGenerateVideos?: () => void
  onStillsToVideo?: () => void
  hasActiveVideoBatch?: boolean
  onOpenDashboard?: () => void
}

export function Timeline({ frames, onReorder, onUpdateTitle, onRemove, onExport, exporting, onGenerateVideos, onStillsToVideo }: TimelineProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-1.5 shrink-0">
        <div className="flex items-center gap-2">
          {frames.length > 0 && onStillsToVideo && (
            <button
              onClick={onStillsToVideo}
              className="px-3 py-1 text-[10px] font-semibold rounded-lg bg-[#3b5998] text-white hover:bg-[#2d4373] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
              </svg>
              Send Stills to Video
            </button>
          )}
          {frames.length > 0 && onGenerateVideos && (
            <button
              onClick={onGenerateVideos}
              className="px-3 py-1 text-[10px] font-semibold rounded-lg bg-[#546246] text-white hover:bg-[#465536] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              AI Video Buddy
            </button>
          )}
          {frames.length > 0 && (
            <button
              onClick={onExport}
              disabled={exporting}
              className="px-3 py-1 text-[10px] font-semibold rounded-lg bg-[#171717] text-white hover:bg-[#404040] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {exporting ? 'Exporting...' : 'Export PNGs'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 px-3 pb-3 overflow-x-auto flex-1 min-h-0 items-center">
        {frames.length === 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] w-full text-center">
            Add composites from the left to build your storyboard
          </div>
        ) : (
          frames.map((frame, i) => (
            <TimelineFrameCard
              key={frame.id}
              frame={frame}
              index={i}
              onReorder={onReorder}
              onUpdateTitle={onUpdateTitle}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </div>
  )
}
