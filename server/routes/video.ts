import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { downloadFromUrl } from '../lib/storage.js'
import { processQueueOnce } from '../services/videoQueue.js'

async function resolveFrameBuffer(dataUrl: string): Promise<Buffer> {
  return downloadFromUrl(dataUrl)
}

export function videoRouter(): Router {
  const router = Router()

  router.post('/batch', async (req, res) => {
    try {
      const { frames, prompt, duration = 8, aspectRatio = '16:9', resolution = '720p', perFramePrompts } = req.body

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({ error: 'frames array required' })
        return
      }
      if (!prompt) {
        res.status(400).json({ error: 'prompt required' })
        return
      }

      const { data: batch, error: batchErr } = await supabase
        .from('video_batches')
        .insert({
          total_frames: frames.length,
          default_prompt: prompt,
          default_duration: duration,
          default_aspect_ratio: aspectRatio,
          default_resolution: resolution,
        })
        .select()
        .single()

      if (batchErr || !batch) {
        res.status(500).json({ error: batchErr?.message || 'Failed to create batch' })
        return
      }

      const jobRows = []

      for (let i = 0; i < frames.length; i++) {
        const { dataUrl, title } = frames[i]
        const buffer = await resolveFrameBuffer(dataUrl)
        const storagePath = `${batch.id}/frame-${String(i).padStart(3, '0')}.png`

        const { error: uploadErr } = await supabase.storage
          .from('frame-images')
          .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })

        if (uploadErr) {
          console.error(`Upload error for frame ${i}:`, uploadErr)
          res.status(500).json({ error: `Failed to upload frame ${i}: ${uploadErr.message}` })
          return
        }

        console.log(`[video] Uploaded frame ${i} (${buffer.length} bytes) → ${storagePath}`)

        const framePrompt = perFramePrompts?.[i] || prompt

        jobRows.push({
          batch_id: batch.id,
          frame_index: i,
          frame_title: title || `scene-${String(i + 1).padStart(3, '0')}`,
          image_storage_path: storagePath,
          prompt: framePrompt,
          status: 'queued',
          duration,
          aspect_ratio: aspectRatio,
          resolution,
        })
      }

      const { error: jobsErr } = await supabase.from('video_jobs').insert(jobRows)

      if (jobsErr) {
        res.status(500).json({ error: jobsErr.message })
        return
      }

      // Kick off queue processing immediately so serverless picks up jobs
      try { await processQueueOnce() } catch (e) { console.error('[videoQueue] post-batch process error:', e) }

      res.json({ batchId: batch.id, jobCount: frames.length })
    } catch (err: any) {
      console.error('Batch creation error:', err)
      res.status(500).json({ error: err.message || 'Failed to create batch' })
    }
  })

  router.get('/batch/:batchId', async (req, res) => {
    try {
      const { batchId } = req.params

      // Await queue processing so serverless functions don't terminate before it completes
      try {
        await processQueueOnce()
      } catch (err) {
        console.error('[videoQueue] background process error:', err)
      }

      const { data: batch, error: batchErr } = await supabase
        .from('video_batches')
        .select('*')
        .eq('id', batchId)
        .single()

      if (batchErr || !batch) {
        res.status(404).json({ error: 'Batch not found' })
        return
      }

      const { data: jobs, error: jobsErr } = await supabase
        .from('video_jobs')
        .select('*')
        .eq('batch_id', batchId)
        .order('frame_index')

      if (jobsErr) {
        res.status(500).json({ error: jobsErr.message })
        return
      }

      const enrichedJobs = (jobs || []).map(job => {
        let frame_image_url: string | null = null
        if (job.image_storage_path) {
          const { data } = supabase.storage.from('frame-images').getPublicUrl(job.image_storage_path)
          frame_image_url = data.publicUrl
        }
        return { ...job, frame_image_url }
      })

      res.json({ ...batch, jobs: enrichedJobs })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/batches', async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('video_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.json({ batches: data || [] })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/job/:jobId/retry', async (req, res) => {
    try {
      const { jobId } = req.params

      const { data: job, error: fetchErr } = await supabase
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .single()

      if (fetchErr || !job) {
        res.status(404).json({ error: 'Job not found' })
        return
      }

      if (!['failed', 'expired'].includes(job.status)) {
        res.status(400).json({ error: `Cannot retry job with status "${job.status}"` })
        return
      }

      const { error } = await supabase
        .from('video_jobs')
        .update({
          status: 'queued',
          progress: 0,
          xai_request_id: null,
          video_url: null,
          local_video_url: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/job/:jobId/cancel', async (req, res) => {
    try {
      const { jobId } = req.params

      const { data: job, error: fetchErr } = await supabase
        .from('video_jobs')
        .select('status')
        .eq('id', jobId)
        .single()

      if (fetchErr || !job) {
        res.status(404).json({ error: 'Job not found' })
        return
      }

      if (job.status !== 'queued') {
        res.status(400).json({ error: `Cannot cancel job with status "${job.status}"` })
        return
      }

      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', jobId)

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/batch/:batchId/cancel', async (req, res) => {
    try {
      const { batchId } = req.params

      const { error } = await supabase
        .from('video_jobs')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('batch_id', batchId)
        .eq('status', 'queued')

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/stills-to-video', async (req, res) => {
    try {
      const { frames, prompt } = req.body

      if (!frames || !Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({ error: 'frames array required' })
        return
      }
      if (!prompt) {
        res.status(400).json({ error: 'prompt required' })
        return
      }

      const frameBuffers: Buffer[] = []
      for (const frame of frames) {
        const buffer = await resolveFrameBuffer(frame.dataUrl)
        frameBuffers.push(buffer)
      }

      const { data: batch, error: batchErr } = await supabase
        .from('video_batches')
        .insert({
          total_frames: frames.length,
          default_prompt: prompt,
          default_duration: 8,
          default_aspect_ratio: '16:9',
          default_resolution: '720p',
        })
        .select()
        .single()

      if (batchErr || !batch) {
        res.status(500).json({ error: batchErr?.message || 'Failed to create batch' })
        return
      }

      const framePaths: string[] = []
      for (let i = 0; i < frameBuffers.length; i++) {
        const storagePath = `${batch.id}/frame-${String(i).padStart(3, '0')}.png`
        const { error: uploadErr } = await supabase.storage
          .from('frame-images')
          .upload(storagePath, frameBuffers[i], { contentType: 'image/png', upsert: true })

        if (uploadErr) {
          console.error(`[stills-to-video] Upload error for frame ${i}:`, uploadErr)
          res.status(500).json({ error: `Failed to upload frame ${i}: ${uploadErr.message}` })
          return
        }

        framePaths.push(storagePath)
        console.log(`[stills-to-video] Uploaded frame ${i} (${frameBuffers[i].length} bytes) → ${storagePath}`)
      }

      const sequenceDesc = frames.map((f: any, i: number) => `Frame ${i + 1}: "${f.title}"`).join(', ')
      const compiledPrompt = `${prompt}\n\nAnimate and blend between these ${frames.length} sequential storyboard frames smoothly: ${sequenceDesc}.`

      const { data: job, error: jobErr } = await supabase
        .from('video_jobs')
        .insert({
          batch_id: batch.id,
          frame_index: 0,
          frame_title: 'stills-compilation',
          image_storage_path: framePaths[0],
          prompt: compiledPrompt,
          status: 'queued',
          duration: 8,
          aspect_ratio: '16:9',
          resolution: '720p',
        })
        .select()
        .single()

      if (jobErr || !job) {
        res.status(500).json({ error: jobErr?.message || 'Failed to create job' })
        return
      }

      console.log(`[stills-to-video] Created batch ${batch.id} with ${frames.length} individual frames`)

      // Kick off queue processing immediately so serverless picks up jobs
      try { await processQueueOnce() } catch (e) { console.error('[videoQueue] post-stills process error:', e) }

      res.json({ batchId: batch.id, jobId: job.id })
    } catch (err: any) {
      console.error('Stills-to-video error:', err)
      res.status(500).json({ error: err.message || 'Failed to create stills-to-video job' })
    }
  })

  return router
}
