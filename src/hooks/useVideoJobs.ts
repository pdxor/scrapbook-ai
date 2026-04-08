import { useState, useCallback, useEffect, useRef } from 'react'
import type { VideoBatchWithJobs, VideoJob } from '../types'
import * as videoApi from '../lib/videoApi'

const POLL_INTERVAL = 5_000

function hasActiveJobs(jobs: VideoJob[]): boolean {
  return jobs.some(j => ['queued', 'submitting', 'pending'].includes(j.status))
}

export function useVideoJobs() {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null)
  const [batch, setBatch] = useState<VideoBatchWithJobs | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollBatch = useCallback(async (batchId: string) => {
    try {
      const data = await videoApi.fetchBatch(batchId)
      setBatch(data)
      if (!hasActiveJobs(data.jobs)) {
        stopPolling()
      }
    } catch {
      // silent poll failure
    }
  }, [stopPolling])

  const startPolling = useCallback((batchId: string) => {
    stopPolling()
    pollBatch(batchId)
    pollRef.current = setInterval(() => pollBatch(batchId), POLL_INTERVAL)
  }, [stopPolling, pollBatch])

  const submitBatch = useCallback(async (
    frames: { dataUrl: string; title: string }[],
    options: {
      prompt: string
      duration: number
      aspectRatio: string
      resolution: string
      perFramePrompts?: Record<number, string>
    },
  ) => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await videoApi.submitVideoBatch(frames, options)
      setCurrentBatchId(result.batchId)
      startPolling(result.batchId)
      return result
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [startPolling])

  const loadBatch = useCallback(async (batchId: string) => {
    setLoading(true)
    setError(null)
    try {
      setCurrentBatchId(batchId)
      const data = await videoApi.fetchBatch(batchId)
      setBatch(data)
      if (hasActiveJobs(data.jobs)) {
        startPolling(batchId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [startPolling])

  const retryJob = useCallback(async (jobId: string) => {
    try {
      await videoApi.retryJob(jobId)
      if (currentBatchId) startPolling(currentBatchId)
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentBatchId, startPolling])

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await videoApi.cancelJob(jobId)
      if (currentBatchId) pollBatch(currentBatchId)
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentBatchId, pollBatch])

  const cancelAllQueued = useCallback(async () => {
    if (!currentBatchId) return
    try {
      await videoApi.cancelBatch(currentBatchId)
      pollBatch(currentBatchId)
    } catch (err: any) {
      setError(err.message)
    }
  }, [currentBatchId, pollBatch])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const jobs = batch?.jobs ?? []
  const isPolling = pollRef.current !== null

  return {
    batch,
    jobs,
    currentBatchId,
    loading,
    submitting,
    error,
    isPolling,
    submitBatch,
    loadBatch,
    retryJob,
    cancelJob,
    cancelAllQueued,
  }
}
