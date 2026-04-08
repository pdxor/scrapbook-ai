import type { VideoBatchWithJobs, VideoBatch } from '../types'

const BASE = '/api'

export async function submitVideoBatch(
  frames: { dataUrl: string; title: string }[],
  options: {
    prompt: string
    duration: number
    aspectRatio: string
    resolution: string
    perFramePrompts?: Record<number, string>
  },
): Promise<{ batchId: string; jobCount: number }> {
  const res = await fetch(`${BASE}/video/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frames,
      prompt: options.prompt,
      duration: options.duration,
      aspectRatio: options.aspectRatio,
      resolution: options.resolution,
      perFramePrompts: options.perFramePrompts,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to submit batch')
  }
  return res.json()
}

export async function fetchBatch(batchId: string): Promise<VideoBatchWithJobs> {
  const res = await fetch(`${BASE}/video/batch/${batchId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to fetch batch')
  }
  return res.json()
}

export async function fetchBatches(): Promise<VideoBatch[]> {
  const res = await fetch(`${BASE}/video/batches`)
  if (!res.ok) throw new Error('Failed to fetch batches')
  const data = await res.json()
  return data.batches
}

export async function retryJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE}/video/job/${jobId}/retry`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to retry job')
  }
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${BASE}/video/job/${jobId}/cancel`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to cancel job')
  }
}

export async function cancelBatch(batchId: string): Promise<void> {
  const res = await fetch(`${BASE}/video/batch/${batchId}/cancel`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to cancel batch')
  }
}

export async function submitStillsToVideo(
  frames: { dataUrl: string; title: string }[],
  prompt: string,
): Promise<{ batchId: string; jobId: string }> {
  const res = await fetch(`${BASE}/video/stills-to-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frames, prompt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to submit stills to video')
  }
  return res.json()
}
