import { useState } from 'react'
import type { VideoJob } from '../types'

interface VideoDashboardProps {
  jobs: VideoJob[]
  isPolling: boolean
  onRetry: (jobId: string) => void
  onCancel: (jobId: string) => void
  onCancelAll: () => void
  onPlay: (job: VideoJob) => void
  onClose: () => void
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; pulse?: boolean }> = {
  queued:     { label: 'Queued',      bg: 'bg-[#F0F0F0]', text: 'text-[#8C8C8C]' },
  submitting: { label: 'Submitting', bg: 'bg-amber-50',   text: 'text-amber-600', pulse: true },
  pending:    { label: 'Generating', bg: 'bg-blue-50',    text: 'text-blue-600',  pulse: true },
  done:       { label: 'Done',       bg: 'bg-emerald-50', text: 'text-emerald-600' },
  failed:     { label: 'Failed',     bg: 'bg-red-50',     text: 'text-red-600' },
  expired:    { label: 'Expired',    bg: 'bg-orange-50',  text: 'text-orange-600' },
  cancelled:  { label: 'Cancelled',  bg: 'bg-[#F0F0F0]', text: 'text-[#8C8C8C]' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.queued
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {cfg.label}
    </span>
  )
}

export function VideoDashboard({ jobs, isPolling: _isPolling, onRetry, onCancel, onCancelAll, onPlay, onClose: _onClose }: VideoDashboardProps) {
  const [collapsed, _setCollapsed] = useState(false)

  const counts = {
    done: jobs.filter(j => j.status === 'done').length,
    generating: jobs.filter(j => ['submitting', 'pending'].includes(j.status)).length,
    queued: jobs.filter(j => j.status === 'queued').length,
    failed: jobs.filter(j => ['failed', 'expired'].includes(j.status)).length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
  }
  const total = jobs.length
  const overallProgress = total > 0 ? Math.round((counts.done / total) * 100) : 0

  if (collapsed) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="px-4 py-1.5 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3 text-[10px] font-medium">
            <span className="text-emerald-600">{counts.done} done</span>
            <span className="text-blue-600">{counts.generating} generating</span>
            <span className="text-[#8C8C8C]">{counts.queued} queued</span>
            {counts.failed > 0 && <span className="text-red-600">{counts.failed} failed</span>}
          </div>
          <div className="flex items-center gap-2">
            {counts.queued > 0 && (
              <button
                onClick={onCancelAll}
                className="px-2 py-0.5 text-[9px] font-semibold rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Cancel All
              </button>
            )}
            <span className="text-[10px] font-semibold text-[#171717]">{overallProgress}%</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#546246] rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Job cards */}
      <div className="flex gap-3 p-3 overflow-x-auto flex-1 min-h-0 items-start">
        {jobs.map(job => (
          <div
            key={job.id}
            className={`glass-card flex-shrink-0 w-44 overflow-hidden ${
              job.status === 'cancelled' ? 'opacity-50' : ''
            }`}
          >
            <div className="w-full aspect-video bg-[#F0F0F0] rounded-t-[12px] relative overflow-hidden flex items-center justify-center">
              {job.frame_image_url && (
                <img
                  src={job.frame_image_url}
                  alt={job.frame_title || ''}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              )}
              {job.status === 'done' && job.local_video_url ? (
                <button
                  onClick={() => onPlay(job)}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#171717" stroke="none">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </button>
              ) : !job.frame_image_url ? (
                <div className="text-[10px] text-[#8C8C8C] font-medium">
                  {job.frame_title || `Frame ${job.frame_index + 1}`}
                </div>
              ) : null}
              {['submitting', 'pending'].includes(job.status) && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}
              {job.status === 'pending' && job.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}
            </div>

            <div className="px-2.5 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-[#171717] truncate flex-1">
                  {job.frame_title || `Frame ${job.frame_index + 1}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge status={job.status} />
                <div className="flex items-center gap-1">
                  {['failed', 'expired'].includes(job.status) && (
                    <button
                      onClick={() => onRetry(job.id)}
                      className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                  {job.status === 'queued' && (
                    <button
                      onClick={() => onCancel(job.id)}
                      className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-[#F0F0F0] text-[#8C8C8C] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  {job.status === 'done' && job.local_video_url && (
                    <a
                      href={job.local_video_url}
                      download
                      className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
                      onClick={e => e.stopPropagation()}
                    >
                      DL
                    </a>
                  )}
                </div>
              </div>
              {job.error_message && (
                <p className="text-[9px] text-red-500 mt-1 line-clamp-2">{job.error_message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
