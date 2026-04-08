import { useState } from 'react'
import type { TimelineFrame } from '../types'

interface VideoConfigModalProps {
  frames: TimelineFrame[]
  onSubmit: (options: {
    prompt: string
    duration: number
    aspectRatio: string
    resolution: string
    perFramePrompts?: Record<number, string>
  }) => Promise<void>
  onClose: () => void
  submitting: boolean
}

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3']
const RESOLUTIONS = ['480p', '720p']

export function VideoConfigModal({ frames, onSubmit, onClose, submitting }: VideoConfigModalProps) {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(8)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [showPerFrame, setShowPerFrame] = useState(false)
  const [perFramePrompts, setPerFramePrompts] = useState<Record<number, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    const overrides: Record<number, string> = {}
    for (const [idx, val] of Object.entries(perFramePrompts)) {
      if (val.trim()) overrides[Number(idx)] = val.trim()
    }

    await onSubmit({
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      resolution,
      perFramePrompts: Object.keys(overrides).length > 0 ? overrides : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        style={{ background: '#ffffff', border: '1px solid #D2D2D2', boxShadow: '0 12px 48px rgba(0,0,0,0.2)', color: '#171717' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-[#546246] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <h3 className="text-lg font-bold font-[Lato] tracking-wider uppercase">AI Video Buddy</h3>
        </div>

        <p className="text-xs text-[#8C8C8C] mb-4">
          Generate {frames.length} video clip{frames.length !== 1 ? 's' : ''} from your storyboard frames using Grok AI.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C] mb-1.5">
            Motion Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the motion and animation style (e.g. 'gentle camera pan, characters animate smoothly')"
            className="w-full h-24 bg-white border border-[#D2D2D2] rounded-xl p-3 text-sm text-[#171717] resize-none focus:outline-none focus:border-[#171717] transition-colors mb-4"
            disabled={submitting}
            autoFocus
          />

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C] mb-1.5">
                Duration
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="flex-1 accent-[#546246]"
                  disabled={submitting}
                />
                <span className="text-xs font-semibold text-[#171717] w-6 text-right">{duration}s</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C] mb-1.5">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                className="w-full bg-white border border-[#D2D2D2] rounded-lg px-2 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717] cursor-pointer"
                disabled={submitting}
              >
                {ASPECT_RATIOS.map(ar => (
                  <option key={ar} value={ar}>{ar}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8C8C8C] mb-1.5">
                Resolution
              </label>
              <div className="flex gap-1">
                {RESOLUTIONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResolution(r)}
                    disabled={submitting}
                    className={`flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      resolution === r
                        ? 'bg-[#171717] text-white'
                        : 'bg-[#F0F0F0] text-[#646464] hover:bg-[#e0e0e0]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowPerFrame(!showPerFrame)}
              className="text-[11px] font-semibold text-[#546246] hover:underline cursor-pointer"
            >
              {showPerFrame ? 'Hide' : 'Show'} per-frame prompt overrides
            </button>

            {showPerFrame && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {frames.map((frame, i) => (
                  <div key={frame.id} className="flex items-start gap-2">
                    <img
                      src={frame.imageDataUrl}
                      alt={frame.title}
                      className="w-16 h-10 object-cover rounded-lg border border-[#D2D2D2] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-medium text-[#8C8C8C] block mb-0.5">{frame.title}</span>
                      <input
                        value={perFramePrompts[i] || ''}
                        onChange={e => setPerFramePrompts(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Override prompt for this frame..."
                        className="w-full bg-white border border-[#D2D2D2] rounded-lg px-2 py-1 text-[11px] text-[#171717] focus:outline-none focus:border-[#171717]"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-transparent border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !prompt.trim()}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#546246] text-white hover:bg-[#465536] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                `Generate ${frames.length} Video${frames.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
