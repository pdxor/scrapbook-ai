import { useState, useEffect, useCallback } from 'react'
import type { VideoBatch, VideoJob } from '../types'
import { fetchBatches } from '../lib/videoApi'
import { fetchBatch } from '../lib/videoApi'

interface VideoGalleryProps {
  onPlay: (url: string, title: string) => void
  currentBatchId?: string | null
}

export function VideoGallery({ onPlay, currentBatchId }: VideoGalleryProps) {
  const [batches, setBatches] = useState<VideoBatch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)

  const loadBatches = useCallback(async () => {
    try {
      const data = await fetchBatches()
      setBatches(data)
      if (data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(currentBatchId || data[0].id)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [selectedBatchId, currentBatchId])

  const loadJobs = useCallback(async (batchId: string) => {
    try {
      const data = await fetchBatch(batchId)
      setJobs(data.jobs.filter(j => j.status === 'done'))
    } catch {
      setJobs([])
    }
  }, [])

  useEffect(() => {
    loadBatches()
  }, [loadBatches])

  useEffect(() => {
    if (selectedBatchId) loadJobs(selectedBatchId)
  }, [selectedBatchId, loadJobs])

  const completedCount = jobs.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-[Lato]">
            Video Gallery ({completedCount})
          </h3>
        </div>
        {batches.length > 1 && (
          <select
            value={selectedBatchId || ''}
            onChange={e => setSelectedBatchId(e.target.value)}
            className="text-[10px] bg-white border border-[#D2D2D2] rounded-lg px-2 py-1 text-[#171717] focus:outline-none cursor-pointer"
          >
            {batches.map((b, i) => (
              <option key={b.id} value={b.id}>
                Batch {batches.length - i} ({b.total_frames} frames)
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-3 p-3 overflow-x-auto flex-1 min-h-0 items-center">
        {loading ? (
          <div className="text-[10px] text-[var(--color-text-muted)] w-full text-center">Loading...</div>
        ) : completedCount === 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] w-full text-center">
            {batches.length === 0
              ? 'No videos generated yet. Use AI Video Buddy to create videos from your storyboard.'
              : 'No completed videos in this batch yet.'}
          </div>
        ) : (
          jobs.map(job => (
            <div
              key={job.id}
              className="glass-card flex-shrink-0 w-48 overflow-hidden group cursor-pointer"
              onClick={() => job.local_video_url && onPlay(job.local_video_url, job.frame_title || `Frame ${job.frame_index + 1}`)}
            >
              <div className="w-full aspect-video bg-[#1a1a1a] rounded-t-[12px] relative overflow-hidden flex items-center justify-center">
                {job.frame_image_url && (
                  <img
                    src={job.frame_image_url}
                    alt={job.frame_title || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 group-hover:bg-white/50 flex items-center justify-center transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white font-medium">
                  {job.duration}s
                </div>
              </div>
              <div className="px-2.5 py-2 flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#171717] truncate">
                  {job.frame_title || `Frame ${job.frame_index + 1}`}
                </span>
                {job.local_video_url && (
                  <a
                    href={job.local_video_url}
                    download
                    onClick={e => e.stopPropagation()}
                    className="text-[9px] font-semibold text-[#8C8C8C] hover:text-[#546246] transition-colors"
                  >
                    DL
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
