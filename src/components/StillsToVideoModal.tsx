import { useState } from 'react'
import type { TimelineFrame } from '../types/index'

interface StillsToVideoModalProps {
  frames: TimelineFrame[]
  onSubmit: (prompt: string) => void
  onClose: () => void
  submitting: boolean
}

export function StillsToVideoModal({ frames, onSubmit, onClose, submitting }: StillsToVideoModalProps) {
  const [prompt, setPrompt] = useState('')

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass-panel-heavy rounded-3xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold text-[var(--color-text)] lowercase tracking-wide">
            send timeline stills to video
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#e0e0e0] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer flex items-center justify-center text-xs font-bold"
          >
            x
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {frames.map((frame, i) => (
                <div key={frame.id} className="flex-shrink-0 w-24">
                  <div className="relative">
                    <img
                      src={frame.imageDataUrl}
                      alt={frame.title}
                      className="w-full aspect-video object-cover rounded-lg border border-[var(--color-border)]"
                    />
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      {i + 1}
                    </div>
                  </div>
                  <p className="text-[8px] text-[var(--color-text-muted)] mt-1 truncate text-center">
                    {frame.title}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              {frames.length} frame{frames.length !== 1 ? 's' : ''} will be sent as a sequential chain
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[var(--color-text)] mb-1.5 lowercase">
              video prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe how the stills should progress as a video... e.g. 'Animate this storyboard sequence with smooth transitions between each scene. The character walks from left to right across the backgrounds.'"
              className="w-full h-28 px-3 py-2.5 text-[11px] rounded-xl border border-[var(--color-border)] bg-white/80 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] resize-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[11px] font-medium rounded-xl bg-[#e0e0e0] text-[var(--color-text-muted)] hover:bg-[#d0d0d0] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(prompt)}
            disabled={submitting || !prompt.trim()}
            className="px-5 py-2 text-[11px] font-semibold rounded-xl bg-[#546246] text-white hover:bg-[#465536] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Send Stills to Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
