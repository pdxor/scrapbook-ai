import { supabase } from '../lib/supabase.js'

const XAI_BASE = 'https://api.x.ai/v1'
const CONCURRENCY = parseInt(process.env.VIDEO_CONCURRENCY || '2', 10)
const SUBMIT_INTERVAL_MS = 15_000
const POLL_INTERVAL_MS = 30_000

// Timestamp-based backoff: ignore all work until this time
let backoffUntil = 0

function isBackedOff(): boolean {
  return Date.now() < backoffUntil
}

function applyBackoff(resp?: Response) {
  let waitMs: number

  const retryAfter = resp?.headers.get('retry-after')
  if (retryAfter) {
    const secs = parseInt(retryAfter, 10)
    waitMs = isNaN(secs) ? 60_000 : (secs + 5) * 1000
  } else {
    const currentWait = Math.max(backoffUntil - Date.now(), 0)
    waitMs = Math.max(currentWait * 2, 60_000)
  }

  const capped = Math.min(waitMs, 600_000)
  backoffUntil = Date.now() + capped
  console.warn(`[videoQueue] rate limited — backing off ${Math.round(capped / 1000)}s until ${new Date(backoffUntil).toISOString()}`)
}

function getApiKey(): string {
  const key = process.env.GROK_API_KEY
  if (!key) throw new Error('GROK_API_KEY not set')
  return key
}

function getPublicImageUrl(storagePath: string): string {
  const { data } = supabase.storage.from('frame-images').getPublicUrl(storagePath)
  return data.publicUrl
}

async function cleanupStaleJobs() {
  const now = new Date()

  // Reset any stuck 'submitting' jobs back to queued
  const { error: submitErr } = await supabase
    .from('video_jobs')
    .update({ status: 'queued', updated_at: now.toISOString() })
    .eq('status', 'submitting')

  if (submitErr) console.error('[videoQueue] crash recovery error:', submitErr.message)
  else console.log('[videoQueue] crash recovery: reset submitting jobs to queued')

  // Expire pending jobs older than 30 minutes (xAI requests don't last forever)
  const staleDate = new Date(now.getTime() - 30 * 60_000).toISOString()
  const { data: stalePending, error: staleErr } = await supabase
    .from('video_jobs')
    .select('id')
    .eq('status', 'pending')
    .lt('updated_at', staleDate)

  if (!staleErr && stalePending && stalePending.length > 0) {
    for (const job of stalePending) {
      await supabase
        .from('video_jobs')
        .update({
          status: 'failed',
          error_message: 'Expired — pending too long without completion',
          progress: 0,
          updated_at: now.toISOString(),
        })
        .eq('id', job.id)
    }
    console.log(`[videoQueue] expired ${stalePending.length} stale pending jobs (>30min old)`)
  }
}

async function countInflight(): Promise<number> {
  const { count, error } = await supabase
    .from('video_jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['submitting', 'pending'])

  if (error) {
    console.error('[videoQueue] count error:', error.message)
    return CONCURRENCY
  }
  return count ?? 0
}

async function submitNextJob() {
  if (isBackedOff()) return

  const inflight = await countInflight()
  if (inflight >= CONCURRENCY) return

  const { data: job, error: fetchErr } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at')
    .order('frame_index')
    .limit(1)
    .single()

  if (fetchErr || !job) return

  await supabase
    .from('video_jobs')
    .update({ status: 'submitting', updated_at: new Date().toISOString() })
    .eq('id', job.id)

  try {
    const imageUrl = getPublicImageUrl(job.image_storage_path)

    const body: Record<string, any> = {
      model: 'grok-imagine-video',
      prompt: job.prompt,
      image: { url: imageUrl },
      duration: job.duration,
      aspect_ratio: job.aspect_ratio,
      resolution: job.resolution,
    }

    if (job.frame_title === 'stills-compilation') {
      const { data: batch } = await supabase
        .from('video_batches')
        .select('total_frames')
        .eq('id', job.batch_id)
        .single()

      if (batch && batch.total_frames > 1) {
        delete body.image
        const refImages: { url: string }[] = []
        for (let i = 0; i < batch.total_frames; i++) {
          const framePath = `${job.batch_id}/frame-${String(i).padStart(3, '0')}.png`
          refImages.push({ url: getPublicImageUrl(framePath) })
        }
        body.reference_images = refImages
        console.log(`[videoQueue] stills-compilation: sending ${refImages.length} reference_images (R2V mode)`)
      }
    }

    const resp = await fetch(`${XAI_BASE}/videos/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify(body),
    })

    if (resp.status === 429) {
      applyBackoff(resp)
      await supabase
        .from('video_jobs')
        .update({ status: 'queued', updated_at: new Date().toISOString() })
        .eq('id', job.id)
      return
    }

    if (!resp.ok) {
      const errBody = await resp.text()
      throw new Error(`xAI API ${resp.status}: ${errBody}`)
    }

    // Successful API call — clear backoff
    backoffUntil = 0

    const data = await resp.json()
    const requestId = data.request_id

    if (!requestId) throw new Error('No request_id returned from xAI')

    await supabase
      .from('video_jobs')
      .update({
        status: 'pending',
        xai_request_id: requestId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    console.log(`[videoQueue] submitted job ${job.id} → request_id ${requestId}`)
  } catch (err: any) {
    console.error(`[videoQueue] submit error for job ${job.id}:`, err.message)
    await supabase
      .from('video_jobs')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
  }
}

async function pollPendingJobs() {
  if (isBackedOff()) return

  const { data: jobs, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('status', 'pending')

  if (error || !jobs || jobs.length === 0) return

  for (const job of jobs) {
    if (isBackedOff()) return
    if (!job.xai_request_id) continue

    try {
      const resp = await fetch(`${XAI_BASE}/videos/${job.xai_request_id}`, {
        headers: { Authorization: `Bearer ${getApiKey()}` },
      })

      if (resp.status === 429) {
        applyBackoff(resp)
        return
      }

      if (!resp.ok) {
        console.error(`[videoQueue] poll error ${resp.status} for job ${job.id}`)
        if (resp.status === 404) {
          await supabase
            .from('video_jobs')
            .update({
              status: 'failed',
              error_message: `xAI request ${job.xai_request_id} not found (404) — may have expired`,
              progress: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)
          console.log(`[videoQueue] marked job ${job.id} as failed (404 — request not found)`)
        }
        continue
      }

      // Successful API call — clear backoff
      backoffUntil = 0

      const data = await resp.json()
      const progress = data.progress ?? job.progress

      if (data.status === 'done') {
        const videoUrl = data.video?.url
        let localVideoUrl: string | null = null

        if (videoUrl) {
          try {
            const videoResp = await fetch(videoUrl)
            const videoBuffer = Buffer.from(await videoResp.arrayBuffer())
            const videoPath = `${job.batch_id}/${job.frame_title || `frame-${job.frame_index}`}.mp4`

            const { error: uploadErr } = await supabase.storage
              .from('videos')
              .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: true })

            if (uploadErr) {
              console.error(`[videoQueue] video upload error:`, uploadErr.message)
            } else {
              const { data: urlData } = supabase.storage.from('videos').getPublicUrl(videoPath)
              localVideoUrl = urlData.publicUrl
            }
          } catch (dlErr: any) {
            console.error(`[videoQueue] video download error:`, dlErr.message)
          }
        }

        await supabase
          .from('video_jobs')
          .update({
            status: 'done',
            progress: 100,
            video_url: videoUrl,
            local_video_url: localVideoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        console.log(`[videoQueue] job ${job.id} done → ${localVideoUrl || videoUrl}`)
      } else if (data.status === 'failed') {
        const errMsg = data.error?.message || 'Video generation failed'
        await supabase
          .from('video_jobs')
          .update({
            status: 'failed',
            error_message: errMsg,
            progress: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        console.log(`[videoQueue] job ${job.id} failed: ${errMsg}`)
      } else if (data.status === 'expired') {
        await supabase
          .from('video_jobs')
          .update({
            status: 'expired',
            error_message: 'Request expired',
            progress: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        console.log(`[videoQueue] job ${job.id} expired`)
      } else {
        await supabase
          .from('video_jobs')
          .update({ progress, updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
    } catch (err: any) {
      console.error(`[videoQueue] poll error for job ${job.id}:`, err.message)
    }
  }
}

export async function processQueueOnce() {
  if (isBackedOff()) {
    console.log(`[videoQueue] backed off until ${new Date(backoffUntil).toISOString()}, skipping`)
    return
  }

  // Recover stuck submitting jobs (>60s old)
  const { data: stuckJobs } = await supabase
    .from('video_jobs')
    .select('id, updated_at')
    .eq('status', 'submitting')

  if (stuckJobs && stuckJobs.length > 0) {
    const staleThresholdMs = 60_000
    const now = Date.now()
    for (const sj of stuckJobs) {
      const age = now - new Date(sj.updated_at).getTime()
      if (age > staleThresholdMs) {
        await supabase
          .from('video_jobs')
          .update({ status: 'queued', updated_at: new Date().toISOString() })
          .eq('id', sj.id)
        console.log(`[videoQueue] recovered stuck job ${sj.id} (stuck for ${Math.round(age / 1000)}s)`)
      }
    }
  }

  await submitNextJob()
  await pollPendingJobs()
}

export function startVideoQueue() {
  console.log(`[videoQueue] starting with concurrency=${CONCURRENCY}, submit=${SUBMIT_INTERVAL_MS / 1000}s, poll=${POLL_INTERVAL_MS / 1000}s`)

  cleanupStaleJobs()

  setInterval(() => {
    if (!isBackedOff()) submitNextJob()
  }, SUBMIT_INTERVAL_MS)

  setInterval(() => {
    if (!isBackedOff()) pollPendingJobs()
  }, POLL_INTERVAL_MS)
}
