import { useState, useEffect } from 'react'
import { compositeAndRefine, refineComposite } from '../lib/api'
import type { CompositeResult, RefineResult } from '../lib/api'
import type { CanvasElementData } from '../types'

interface RefinePanelProps {
  open: boolean
  onClose: () => void
  onRefined: (url: string) => void
  onAddToTimeline?: (url: string) => void
  elements: CanvasElementData[]
  backgroundUrl: string | null
}

type PipelineMode = 'compose' | 'polish' | 'light' | 'custom'

const PIPELINE_MODES: { id: PipelineMode; label: string; prompt: string; description: string; refine: boolean }[] = [
  {
    id: 'compose',
    label: 'Compose Only',
    prompt: '',
    description: 'BG removal + exact placement with contact shadows. No AI. Fastest.',
    refine: false,
  },
  {
    id: 'polish',
    label: 'Compose + Polish',
    prompt: '',
    description: 'Deterministic compose, then AI cleans edges, removes color spill, adds shadows.',
    refine: true,
  },
  {
    id: 'light',
    label: 'Compose + Lighting',
    prompt: 'Pay special attention to matching the color temperature and ambient lighting of the background onto the foreground subjects. Warm/cool tones should feel cohesive.',
    description: 'Deterministic compose, then AI matches foreground lighting to the scene.',
    refine: true,
  },
  {
    id: 'custom',
    label: 'Compose + Custom',
    prompt: '',
    description: 'Deterministic compose, then your own AI refinement direction.',
    refine: true,
  },
]

type LegacyMode = 'blend' | 'polish' | 'light' | 'custom'

const LEGACY_MODES: { id: LegacyMode; label: string; prompt: string; description: string }[] = [
  {
    id: 'blend',
    label: 'Remove Backdrops',
    prompt: 'Remove the solid-colored rectangles behind character cutouts. Feather edges to blend naturally. Add subtle contact shadows beneath subjects.',
    description: 'Auto-detects green screens and solid color boxes, generates a mask, and surgically removes them.',
  },
  {
    id: 'polish',
    label: 'Edge Cleanup',
    prompt: 'Clean up hard cutout edges and anti-alias artifacts around characters and objects. Add subtle contact shadows. Do not alter character designs or the background.',
    description: 'Feathers jagged edges and removes cutout artifacts for a natural look.',
  },
  {
    id: 'light',
    label: 'Lighting Match',
    prompt: 'Minimally adjust color temperature and lighting on character/object cutouts to match the ambient lighting of the background environment. Do not change any designs, positions, or styles.',
    description: 'Subtle color grading so characters feel like they belong in the scene.',
  },
  {
    id: 'custom',
    label: 'Custom Direction',
    prompt: '',
    description: 'Write your own pixel-preserving cleanup instructions.',
  },
]

type PipelineStage = 'idle' | 'removing-bg' | 'placing' | 'polishing' | 'done'

export function RefinePanel({ open, onClose, onRefined, onAddToTimeline, elements, backgroundUrl }: RefinePanelProps) {
  const usePipeline = elements.length > 0

  const [refining, setRefining] = useState(false)
  const [mode, setMode] = useState<PipelineMode | LegacyMode>(usePipeline ? 'polish' : 'blend')
  const [customPrompt, setCustomPrompt] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [placedPreview, setPlacedPreview] = useState<string | null>(null)
  const [canvasPreview, setCanvasPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [refineInfo, setRefineInfo] = useState<{ masked: boolean; editPercent: number } | null>(null)

  useEffect(() => {
    if (open) {
      const getDataUrl = (window as any).__canvasGetDataUrl
      if (getDataUrl) setCanvasPreview(getDataUrl())
      setMode(usePipeline ? 'polish' : 'blend')
    } else {
      setPreview(null)
      setPlacedPreview(null)
      setError(null)
      setCanvasPreview(null)
      setRefineInfo(null)
      setStage('idle')
    }
  }, [open, usePipeline])

  const handlePipelineRefine = async () => {
    setRefining(true)
    setError(null)
    setStage('removing-bg')
    try {
      const pipelineMode = PIPELINE_MODES.find(m => m.id === mode)
      if (!pipelineMode) throw new Error('Invalid mode')

      const promptText = mode === 'custom' ? customPrompt.trim() : pipelineMode.prompt
      const doRefine = pipelineMode.refine

      setStage(doRefine ? 'removing-bg' : 'placing')

      const elPayloads = elements.map(el => ({
        assetUrl: el.assetUrl,
        x: el.x - el.width / 2,
        y: el.y - el.height / 2,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        flipH: el.scaleX < 0,
        flipV: el.scaleY < 0,
      }))

      const result: CompositeResult = await compositeAndRefine(
        backgroundUrl,
        elPayloads,
        doRefine,
        promptText || undefined,
      )

      setPreview(result.url)
      if (result.placedUrl) setPlacedPreview(result.placedUrl)
      setStage('done')
    } catch (e: any) {
      setError(e.message)
      setStage('idle')
    } finally {
      setRefining(false)
    }
  }

  const handleLegacyRefine = async () => {
    setRefining(true)
    setError(null)
    setRefineInfo(null)
    try {
      const getBlob = (window as any).__canvasGetBlob
      if (!getBlob) throw new Error('Canvas not ready')
      const blob = await getBlob()
      if (!blob) throw new Error('Failed to capture canvas')
      const sceneDirection = mode === 'custom'
        ? customPrompt.trim()
        : LEGACY_MODES.find(m => m.id === mode)?.prompt || ''
      const result: RefineResult = await refineComposite(blob, sceneDirection)
      setPreview(result.url)
      setRefineInfo({ masked: result.masked, editPercent: result.editPercent })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRefining(false)
    }
  }

  const handleRefine = usePipeline ? handlePipelineRefine : handleLegacyRefine

  const handleAccept = () => {
    if (preview) {
      onRefined(preview)
      onClose()
    }
  }

  if (!open) return null

  const modes = usePipeline ? PIPELINE_MODES : LEGACY_MODES

  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#ffffff' }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D2D2D2] shrink-0">
        <div>
          <h3 className="text-sm font-bold font-[Lato] lowercase tracking-wider text-[#171717]">
            {usePipeline ? 'composite engine' : 'refine with ai'}
          </h3>
          <p className="text-[10px] text-[#8C8C8C] mt-0.5">
            {usePipeline
              ? 'Deterministic compositing pipeline — BG remove → place → polish'
              : 'Pixel-preserving compositing — auto mask detection'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-[#8C8C8C] hover:bg-[#F0F0F0] hover:text-[#171717] transition-colors cursor-pointer"
        >
          x
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {!preview ? (
          <>
            {/* Pipeline badge */}
            {usePipeline && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-[11px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
                <span>&#9650;</span>
                <span>
                  Pipeline mode — {elements.length} element{elements.length !== 1 ? 's' : ''} will be
                  individually processed (BG removed, placed with sharp, then polished)
                </span>
              </div>
            )}

            {/* Canvas preview */}
            {canvasPreview && (
              <div className="rounded-xl overflow-hidden border border-[#D2D2D2] mb-4 shadow-sm">
                <img src={canvasPreview} alt="Current composition" className="w-full" />
                <div className="px-3 py-1.5 bg-[#f5f5f5] text-[9px] text-[#8C8C8C] font-medium">
                  Current canvas preview
                </div>
              </div>
            )}

            {/* Stage progress */}
            {refining && usePipeline && (
              <div className="mb-4 rounded-xl border border-[#D2D2D2] overflow-hidden">
                <div className="px-3 py-2 bg-[#f5f5f5] text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C]">
                  Pipeline Progress
                </div>
                <div className="p-3 space-y-2">
                  {(['removing-bg', 'placing', 'polishing'] as PipelineStage[]).map((s, i) => {
                    const labels: Record<string, string> = {
                      'removing-bg': 'Removing backgrounds...',
                      'placing': 'Placing elements with sharp...',
                      'polishing': 'AI polish pass...',
                    }
                    const stageOrder = ['removing-bg', 'placing', 'polishing']
                    const currentIdx = stageOrder.indexOf(stage)
                    const isActive = i === currentIdx
                    const isDone = i < currentIdx
                    return (
                      <div key={s} className={`flex items-center gap-2 text-[11px] ${isActive ? 'text-[#171717] font-semibold' : isDone ? 'text-emerald-600' : 'text-[#ccc]'}`}>
                        {isDone ? (
                          <span className="text-emerald-500">&#10003;</span>
                        ) : isActive ? (
                          <span className="w-3.5 h-3.5 border-2 border-[#171717]/30 border-t-[#171717] rounded-full animate-spin inline-block" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-[#ddd] inline-block" />
                        )}
                        <span>{labels[s]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Mode selector */}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C] font-[Lato] block mb-2">
                {usePipeline ? 'Pipeline Mode' : 'Refinement Mode'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {modes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    disabled={refining}
                    className={`text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      mode === m.id
                        ? 'border-[#171717] bg-[rgba(0,0,0,0.04)] shadow-sm'
                        : 'border-[#D2D2D2] bg-white hover:border-[#999] hover:bg-[#F0F0F0]'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-[#171717] block">{m.label}</span>
                    <span className="text-[9px] text-[#646464] mt-0.5 block leading-snug">{m.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            {mode === 'custom' && (
              <div className="mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#8C8C8C] font-[Lato] block mb-2">
                  Your Direction
                </label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder={usePipeline
                    ? 'After compositing, the AI should...'
                    : 'Describe exactly how you want the scene refined...'}
                  className="w-full h-24 bg-white border border-[#D2D2D2] rounded-xl p-3 text-sm text-[#171717] resize-none focus:outline-none focus:border-[#171717] transition-colors"
                  disabled={refining}
                  autoFocus
                />
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-4 border border-red-100">{error}</div>
            )}
          </>
        ) : (
          <>
            {/* Mask info badge (legacy) */}
            {refineInfo && (
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-[11px] font-medium border ${
                refineInfo.masked
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span>{refineInfo.masked ? '◉' : '○'}</span>
                <span>
                  {refineInfo.masked
                    ? `Masked edit — ${refineInfo.editPercent}% of image targeted for cleanup`
                    : 'No backdrops auto-detected — used full-image edit'}
                </span>
              </div>
            )}

            {/* Pipeline stage badge */}
            {stage === 'done' && usePipeline && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-[11px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
                <span>&#10003;</span>
                <span>
                  {placedPreview
                    ? 'Pipeline complete — deterministic compose + AI polish'
                    : 'Pipeline complete — deterministic compose (no AI)'}
                </span>
              </div>
            )}

            {/* Comparison: show placed vs refined if both exist, otherwise original vs result */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#8C8C8C] font-[Lato] mb-1.5">
                  {placedPreview ? 'Sharp Composite' : 'Original'}
                </div>
                <div className="rounded-xl overflow-hidden border border-[#D2D2D2] shadow-sm">
                  <img
                    src={placedPreview || canvasPreview || ''}
                    alt={placedPreview ? 'Sharp composite' : 'Original'}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#8C8C8C] font-[Lato] mb-1.5">
                  {placedPreview ? 'AI Polished' : 'Refined'}
                </div>
                <div className="rounded-xl overflow-hidden border border-[#D2D2D2] shadow-sm">
                  <img src={preview} alt="Result" className="w-full" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fixed footer actions */}
      <div className="shrink-0 px-4 py-3 border-t border-[#D2D2D2] flex gap-2 justify-end bg-[#fafafa]">
        {!preview ? (
          <>
            <button
              onClick={onClose}
              disabled={refining}
              className="px-5 py-2.5 text-[11px] font-semibold rounded-xl border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRefine}
              disabled={refining || (mode === 'custom' && !customPrompt.trim())}
              className="px-5 py-2.5 text-[11px] font-semibold rounded-xl bg-[#171717] text-white hover:bg-[#404040] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {refining ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {usePipeline ? 'Compositing...' : 'Refining...'}
                </span>
              ) : usePipeline ? 'Run Pipeline' : 'Send to AI'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setPreview(null); setPlacedPreview(null); setError(null); setStage('idle') }}
              className="px-5 py-2.5 text-[11px] font-semibold rounded-xl border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
            >
              Retry
            </button>
            {onAddToTimeline && preview && (
              <button
                onClick={() => { onAddToTimeline(preview); onClose() }}
                className="px-5 py-2.5 text-[11px] font-semibold rounded-xl bg-[#171717] text-white hover:bg-[#404040] transition-colors cursor-pointer"
              >
                + Timeline
              </button>
            )}
            <button
              onClick={handleAccept}
              className="px-5 py-2.5 text-[11px] font-semibold rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-colors cursor-pointer"
            >
              Accept & Save
            </button>
          </>
        )}
      </div>
    </div>
  )
}
