import { supabase } from '../lib/supabase.js'

const XAI_BASE = 'https://api.x.ai/v1'
const CONCURRENCY = parseInt(process.env.VIDEO_CONCURRENCY || '2', 10)
const SUBMIT_INTERVAL_MS = 5_000
const POLL_INTERVAL_MS = 10_000

let backoffMs = 0

function getApiKey(): string {
  const key = process.env.GROK_API_KEY
  if (!key) throw new Error('GROK_API_KEY not set')
  return key
}

function getPublicImageUrl(storagePath: string): string {
  const { data } = supabase.storage.from('frame-images').getPublicUrl(storagePath)
  return data.publicUrl
}

async function recoverCrashedJobs() {
  const { error } = await supabase
    .from('video_jobs')
    .update({ status: 'queued', updated_at: new Date().toISOString() })
    .eq('status', 'submitting')

  if (error) console.error('[videoQueue] crash recovery error:', error.message)
  else console.log('[videoQueue] crash recovery: reset submitting jobs to queued')
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
  if (backoffMs > 0) return

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

    // For stills-compilation jobs, send ALL frames as reference_images (R2V mode)
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
      backoffMs = Math.min((backoffMs || 10_000) * 2, 120_000)
      console.warn(`[videoQueue] rate limited, backing off ${backoffMs / 1000}s`)
      await supabase
        .from('video_jobs')
        .update({ status: 'queued', updated_at: new Date().toISOString() })
        .eq('id', job.id)
      setTimeout(() => { backoffMs = 0 }, backoffMs)
      return
    }

    if (!resp.ok) {
      const errBody = await resp.text()
      throw new Error(`xAI API ${resp.status}: ${errBody}`)
    }

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
  const { data: jobs, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('status', 'pending')

  if (error || !jobs || jobs.length === 0) return

  for (const job of jobs) {
    if (!job.xai_request_id) continue

    try {
      const resp = await fetch(`${XAI_BASE}/videos/${job.xai_request_id}`, {
        headers: { Authorization: `Bearer ${getApiKey()}` },
      })

      if (resp.status === 429) {
        backoffMs = Math.min((backoffMs || 10_000) * 2, 120_000)
        console.warn(`[videoQueue] poll rate limited, backing off ${backoffMs / 1000}s`)
        setTimeout(() => { backoffMs = 0 }, backoffMs)
        return
      }

      if (!resp.ok) {
        console.error(`[videoQueue] poll error ${resp.status} for job ${job.id}`)
        continue
      }

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

export function startVideoQueue() {
  console.log(`[videoQueue] starting with concurrency=${CONCURRENCY}`)

  recoverCrashedJobs()

  setInterval(() => {
    if (backoffMs === 0) submitNextJob()
  }, SUBMIT_INTERVAL_MS)

  setInterval(() => {
    if (backoffMs === 0) pollPendingJobs()
  }, POLL_INTERVAL_MS)
}
