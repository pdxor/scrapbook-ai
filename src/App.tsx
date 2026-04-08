import { useState, useCallback } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { AssetGallery } from './components/AssetGallery'
import { CompositionCanvas } from './components/CompositionCanvas'
import { RefinePanel } from './components/RefinePanel'
import { Timeline } from './components/Timeline'
import { SavedComposites } from './components/SavedComposites'
import { Lightbox } from './components/Lightbox'
import { VideoConfigModal } from './components/VideoConfigModal'
import { StillsToVideoModal } from './components/StillsToVideoModal'
import { VideoDashboard } from './components/VideoDashboard'
import { VideoPlayer } from './components/VideoPlayer'
import { VideoGallery } from './components/VideoGallery'
import { BottomPanel } from './components/BottomPanel'
import type { TabId } from './components/BottomPanel'
import { useCanvas } from './hooks/useCanvas'
import { useTimeline } from './hooks/useTimeline'
import { useAssets } from './hooks/useAssets'
import { useVideoJobs } from './hooks/useVideoJobs'
import { saveComposite, exportStoryboard } from './lib/api'
import * as videoApi from './lib/videoApi'
import type { VideoJob } from './types'

function App() {
  const canvas = useCanvas()
  const timeline = useTimeline()
  const composites = useAssets('composites')
  const video = useVideoJobs()
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [refineOpen, setRefineOpen] = useState(false)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [stillsModalOpen, setStillsModalOpen] = useState(false)
  const [stillsSubmitting, setStillsSubmitting] = useState(false)
  const [playingVideo, setPlayingVideo] = useState<{ url: string; title: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [bottomTab, setBottomTab] = useState<TabId>('storyboard')
  const [compositesExpanded, setCompositesExpanded] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: { url: string; label?: string }[]; currentIndex: number } | null>(null)

  const openLightbox = useCallback((images: { url: string; label?: string }[], startIndex: number) => {
    setLightbox({ images, currentIndex: startIndex })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSaveComposite = useCallback(async () => {
    setSaving(true)
    try {
      const getBlob = (window as any).__canvasGetBlob
      if (!getBlob) throw new Error('Canvas not ready')
      const blob = await getBlob()
      if (!blob) throw new Error('Failed to capture canvas')
      await saveComposite(blob)
      composites.refresh()
      showToast('Composite saved!')
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }, [composites])

  const handleAddToTimeline = useCallback(() => {
    const getDataUrl = (window as any).__canvasGetDataUrl
    if (!getDataUrl) return
    const dataUrl = getDataUrl()
    if (!dataUrl) return
    timeline.addFrame(dataUrl)
    showToast('Frame added to storyboard!')
  }, [timeline])

  const handleCompositeToTimeline = useCallback((url: string) => {
    timeline.addFrame(url)
    showToast('Composite added to storyboard!')
  }, [timeline])

  const handleExportStoryboard = useCallback(async () => {
    if (timeline.frames.length === 0) return
    setExporting(true)
    try {
      const frames = timeline.frames.map(f => ({
        dataUrl: f.imageDataUrl,
        title: f.title,
      }))
      const result = await exportStoryboard(frames)
      showToast(`Exported ${result.files.length} frames!`)
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }, [timeline.frames])

  const handleRefined = useCallback((url: string) => {
    composites.refresh()
    showToast('Refined image saved to composites!')
    console.log('Refined image at:', url)
  }, [composites])

  const handleSubmitVideos = useCallback(async (options: {
    prompt: string
    duration: number
    aspectRatio: string
    resolution: string
    perFramePrompts?: Record<number, string>
  }) => {
    const frames = timeline.frames.map(f => ({
      dataUrl: f.imageDataUrl,
      title: f.title,
    }))
    try {
      const result = await video.submitBatch(frames, options)
      setVideoModalOpen(false)
      setBottomTab('video-buddy')
      showToast(`Queued ${result.jobCount} videos for generation!`)
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    }
  }, [timeline.frames, video])

  const handlePlayVideo = useCallback((job: VideoJob) => {
    if (job.local_video_url) {
      setPlayingVideo({ url: job.local_video_url, title: job.frame_title || `Frame ${job.frame_index + 1}` })
    }
  }, [])

  const handlePlayVideoFromGallery = useCallback((url: string, title: string) => {
    setPlayingVideo({ url, title })
  }, [])

  const handleStillsToVideo = useCallback(async (prompt: string) => {
    const frames = timeline.frames.map(f => ({
      dataUrl: f.imageDataUrl,
      title: f.title,
    }))
    setStillsSubmitting(true)
    try {
      const result = await videoApi.submitStillsToVideo(frames, prompt)
      setStillsModalOpen(false)
      video.loadBatch(result.batchId)
      setBottomTab('video-buddy')
      showToast('Stills sent for video compilation!')
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setStillsSubmitting(false)
    }
  }, [timeline.frames, video])

  const bottomTabs = [
    {
      id: 'storyboard' as TabId,
      label: 'Storyboard',
      badge: timeline.frames.length > 0 ? timeline.frames.length : undefined,
    },
    {
      id: 'video-buddy' as TabId,
      label: 'Video Buddy',
      pulse: video.isPolling,
      badge: video.jobs.length > 0 ? `${video.jobs.filter(j => j.status === 'done').length}/${video.jobs.length}` : undefined,
    },
    {
      id: 'video-gallery' as TabId,
      label: 'Videos',
    },
  ]

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`app-grid ${compositesExpanded ? 'composites-expanded' : ''}`}>
        {/* HEADER */}
        <header className="grid-header glass-panel-heavy flex items-center justify-between px-5 border-b border-[var(--color-border)] z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold tracking-wider text-[var(--color-text)] lowercase">video buddy</h1>
          </div>
        </header>

        {/* LEFT: Characters (hidden when composites expanded) */}
        <div className={`grid-chars glass-panel border-r border-[var(--color-border)] overflow-hidden flex flex-col ${compositesExpanded ? 'hidden' : ''}`}>
          <AssetGallery
            type="characters"
            label="Characters"
            onSelect={url => canvas.addElement(url, 'character')}
            onView={openLightbox}
          />
        </div>

        {/* CENTER: Canvas + Refine Panel overlay */}
        <div className="grid-canvas overflow-hidden" style={{ position: 'relative', isolation: 'isolate' }}>
          <div className="w-full h-full" style={{ position: 'relative', zIndex: 1 }}>
            <CompositionCanvas
              elements={canvas.elements}
              backgroundUrl={canvas.backgroundUrl}
              selectedId={canvas.selectedId}
              onSelect={canvas.setSelectedId}
              onUpdate={canvas.updateElement}
              onRemove={canvas.removeElement}
              onBringForward={canvas.bringForward}
              onSendBackward={canvas.sendBackward}
            />
          </div>
          {refineOpen && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
              <RefinePanel
                open={refineOpen}
                onClose={() => setRefineOpen(false)}
                onRefined={handleRefined}
                onAddToTimeline={handleCompositeToTimeline}
                elements={canvas.elements}
                backgroundUrl={canvas.backgroundUrl}
              />
            </div>
          )}
        </div>

        {/* RIGHT: Objects + Backgrounds */}
        <div className="grid-right glass-panel border-l border-[var(--color-border)] overflow-hidden flex flex-col">
          <div className="flex-[55] min-h-0 overflow-hidden flex flex-col border-b border-[var(--color-border)]">
            <AssetGallery
              type="objects"
              label="Objects"
              onSelect={url => canvas.addElement(url, 'object')}
              onView={openLightbox}
            />
          </div>
          <div className="flex-[45] min-h-0 overflow-hidden flex flex-col">
            <AssetGallery
              type="backgrounds"
              label="Backgrounds"
              onSelect={url => canvas.setBackgroundUrl(url)}
              onView={openLightbox}
            />
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="grid-toolbar glass-panel-heavy border-t border-[var(--color-border)] flex items-center justify-between px-4 gap-2 z-10">
          <div className="flex items-center gap-1">
            {canvas.selectedId && !refineOpen && (
              <>
                <button
                  onClick={() => canvas.flipHorizontal(canvas.selectedId!)}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Flip Horizontal"
                >
                  ⇆
                </button>
                <button
                  onClick={() => canvas.flipVertical(canvas.selectedId!)}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Flip Vertical"
                >
                  ⇅
                </button>
                <button
                  onClick={() => canvas.rotate90(canvas.selectedId!, 'ccw')}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Rotate 90° CCW"
                >
                  ↺
                </button>
                <button
                  onClick={() => canvas.rotate90(canvas.selectedId!, 'cw')}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Rotate 90° CW"
                >
                  ↻
                </button>
                <div className="w-px h-4 bg-[var(--color-border)] mx-0.5" />
                <button
                  onClick={() => canvas.bringForward(canvas.selectedId!)}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Bring Forward"
                >
                  ▲
                </button>
                <button
                  onClick={() => canvas.sendBackward(canvas.selectedId!)}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-[#e8e8e8] text-[#555] hover:bg-[#d0d0d0] transition-colors cursor-pointer flex items-center justify-center"
                  title="Send Backward"
                >
                  ▼
                </button>
                <button
                  onClick={() => canvas.removeElement(canvas.selectedId!)}
                  className="w-7 h-7 text-[10px] font-semibold rounded-md bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer flex items-center justify-center"
                  title="Delete"
                >
                  ✕
                </button>
                <div className="w-px h-4 bg-[var(--color-border)] mx-0.5" />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!refineOpen && (
              <>
                <button
                  onClick={canvas.clearCanvas}
                  className="px-4 py-2 text-[11px] font-medium rounded-xl bg-[#e0e0e0] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  onClick={() => setRefineOpen(true)}
                  className="px-4 py-2 text-[11px] font-semibold rounded-xl bg-[#171717] text-white hover:bg-[#404040] transition-colors cursor-pointer"
                >
                  Refine with AI
                </button>
                <button
                  onClick={handleSaveComposite}
                  disabled={saving}
                  className="px-4 py-2 text-[11px] font-semibold rounded-xl bg-[#e0e0e0] text-[#333] hover:bg-[#d0d0d0] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Composite'}
                </button>
                <button
                  onClick={handleAddToTimeline}
                  className="px-4 py-2 text-[11px] font-semibold rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90 transition-colors cursor-pointer"
                >
                  Add to Timeline
                </button>
              </>
            )}
          </div>
        </div>

        {/* SAVED COMPOSITES (bottom-left, or full left when expanded) */}
        <div className={`grid-composites glass-panel-heavy border-r border-[var(--color-border)] overflow-hidden z-20 ${compositesExpanded ? 'composites-expanded-panel' : 'border-t'}`}>
          <SavedComposites
            composites={composites.assets}
            loading={composites.loading}
            expanded={compositesExpanded}
            onToggleExpand={() => setCompositesExpanded(!compositesExpanded)}
            onAddToTimeline={handleCompositeToTimeline}
            onDelete={composites.remove}
            onView={openLightbox}
          />
        </div>

        {/* BOTTOM: Tabbed panel */}
        <div className="grid-storyboard glass-panel-heavy border-t border-[var(--color-border)] overflow-hidden z-10">
          <BottomPanel
            activeTab={bottomTab}
            onTabChange={setBottomTab}
            tabs={bottomTabs}
          >
            {bottomTab === 'storyboard' && (
              <Timeline
                frames={timeline.frames}
                onReorder={timeline.reorderFrames}
                onUpdateTitle={timeline.updateFrameTitle}
                onRemove={timeline.removeFrame}
                onExport={handleExportStoryboard}
                exporting={exporting}
                onGenerateVideos={() => setVideoModalOpen(true)}
                onStillsToVideo={() => setStillsModalOpen(true)}
                hasActiveVideoBatch={video.jobs.length > 0}
                onOpenDashboard={() => setBottomTab('video-buddy')}
              />
            )}
            {bottomTab === 'video-buddy' && (
              <VideoDashboard
                jobs={video.jobs}
                isPolling={video.isPolling}
                onRetry={video.retryJob}
                onCancel={video.cancelJob}
                onCancelAll={video.cancelAllQueued}
                onPlay={handlePlayVideo}
                onClose={() => setBottomTab('storyboard')}
              />
            )}
            {bottomTab === 'video-gallery' && (
              <VideoGallery
                onPlay={handlePlayVideoFromGallery}
                currentBatchId={video.currentBatchId}
              />
            )}
          </BottomPanel>
        </div>

        {/* Video Config Modal */}
        {videoModalOpen && (
          <VideoConfigModal
            frames={timeline.frames}
            onSubmit={handleSubmitVideos}
            onClose={() => setVideoModalOpen(false)}
            submitting={video.submitting}
          />
        )}

        {/* Stills to Video Modal */}
        {stillsModalOpen && (
          <StillsToVideoModal
            frames={timeline.frames}
            onSubmit={handleStillsToVideo}
            onClose={() => setStillsModalOpen(false)}
            submitting={stillsSubmitting}
          />
        )}

        {/* Video Player Modal */}
        {playingVideo && (
          <VideoPlayer
            url={playingVideo.url}
            title={playingVideo.title}
            onClose={() => setPlayingVideo(null)}
          />
        )}

        {/* Lightbox */}
        {lightbox && (
          <Lightbox
            images={lightbox.images}
            currentIndex={lightbox.currentIndex}
            onClose={() => setLightbox(null)}
            onPrev={() => setLightbox(prev => prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : null)}
            onNext={() => setLightbox(prev => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : null)}
          />
        )}

        {/* Toast */}
        {toast && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg"
            style={{ zIndex: 9999, background: 'rgba(255,255,255,0.95)', border: '1px solid #D2D2D2', color: '#171717' }}
          >
            {toast}
          </div>
        )}
      </div>
    </DndProvider>
  )
}

export default App
