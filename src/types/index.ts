export type AssetType = 'characters' | 'objects' | 'backgrounds' | 'composites' | 'storyboards'

export interface Asset {
  filename: string
  url: string
  type: AssetType
}

export interface CanvasElementData {
  id: string
  assetUrl: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
  type: 'character' | 'object'
}

export interface TimelineFrame {
  id: string
  imageDataUrl: string
  title: string
}

export type VideoJobStatus = 'queued' | 'submitting' | 'pending' | 'done' | 'failed' | 'expired' | 'cancelled'

export interface VideoJob {
  id: string
  batch_id: string
  frame_index: number
  frame_title: string | null
  image_storage_path: string | null
  frame_image_url: string | null
  prompt: string | null
  status: VideoJobStatus
  xai_request_id: string | null
  progress: number
  video_url: string | null
  local_video_url: string | null
  error_message: string | null
  duration: number
  aspect_ratio: string
  resolution: string
  created_at: string
  updated_at: string
}

export interface VideoBatch {
  id: string
  total_frames: number
  default_prompt: string | null
  default_duration: number
  default_aspect_ratio: string
  default_resolution: string
  created_at: string
}

export interface VideoBatchWithJobs extends VideoBatch {
  jobs: VideoJob[]
}

export interface VideoSubmitOptions {
  prompt: string
  duration: number
  aspectRatio: string
  resolution: string
  perFramePrompts?: Record<number, string>
}
