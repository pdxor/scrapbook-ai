import { Router } from 'express'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
import OpenAI from 'openai'
import { removeBackground } from '../utils/bgRemover.js'

interface ElementPayload {
  assetUrl: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipH?: boolean
  flipV?: boolean
}

interface PipelineRequest {
  backgroundUrl: string | null
  elements: ElementPayload[]
  refine: boolean
  prompt?: string
}

const CANVAS_WIDTH = 1024
const DEFAULT_HEIGHT = 576

function urlToAssetPath(url: string, assetsRoot: string): string {
  const prefix = '/api/asset-files/'
  if (url.startsWith(prefix)) {
    return path.join(assetsRoot, url.slice(prefix.length))
  }
  throw new Error(`Cannot resolve asset path: ${url}`)
}

function buildPolishPrompt(userDirection?: string): string {
  const lines = [
    'STRICT POST-COMPOSITING REFINEMENT',
    '',
    'The subjects have already been precisely composited onto the background.',
    "Every element's placement, size, and orientation is FINAL and LOCKED.",
    '',
    'DO NOT move, redesign, reinterpret, or redraw ANY element.',
    'DO NOT change the art style of any character or object.',
    'DO NOT add new elements, text, or watermarks.',
    'DO NOT reposition or resize anything.',
    '',
    'ONLY perform these minimal cleanup operations:',
    '1. Refine hard cutout edges with subtle anti-aliasing (1-3px feathering max)',
    '2. Remove any residual color spill from background removal at element edges',
    '3. Subtly match color temperature of foreground elements to the background lighting',
    '4. Enhance existing contact shadows beneath subjects (do not invent new shadows)',
    '',
    'CRITICAL: This is TECHNICAL compositing cleanup like Photoshop, NOT creative art.',
    'Every character and object must remain pixel-identical in shape, color, and style.',
    'If unsure about any area, leave it UNCHANGED.',
  ]

  if (userDirection) {
    lines.push('', 'ADDITIONAL DIRECTION:', userDirection)
  }

  return lines.join('\n')
}

/**
 * Build a contact-shadow PNG from a foreground element's alpha channel.
 * Returns a black silhouette at 30% opacity, blurred for soft falloff.
 */
async function buildShadow(
  elementBuffer: Buffer,
  blurSigma: number,
): Promise<Buffer> {
  const { data, info } = await sharp(elementBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const shadowRGBA = Buffer.alloc(width * height * 4)

  for (let i = 0; i < width * height; i++) {
    const alpha = data[i * 4 + 3]
    shadowRGBA[i * 4 + 3] = Math.round(alpha * 0.3)
  }

  return sharp(shadowRGBA, { raw: { width, height, channels: 4 } })
    .blur(Math.max(0.5, blurSigma))
    .png()
    .toBuffer()
}

export function compositeRouter(assetsRoot: string): Router {
  const router = Router()

  router.post('/pipeline', async (req, res) => {
    try {
      const { backgroundUrl, elements, refine, prompt } = req.body as PipelineRequest

      if (!elements || elements.length === 0) {
        res.status(400).json({ error: 'No elements to compose' })
        return
      }

      // ── STAGE 1: Prepare background ──
      let bgBuffer: Buffer
      let canvasHeight: number

      if (backgroundUrl) {
        const bgPath = urlToAssetPath(backgroundUrl, assetsRoot)
        if (!fs.existsSync(bgPath)) {
          res.status(404).json({ error: 'Background image not found' })
          return
        }
        const bgMeta = await sharp(bgPath).metadata()
        canvasHeight = Math.round(CANVAS_WIDTH * (bgMeta.height! / bgMeta.width!))
        bgBuffer = await sharp(bgPath)
          .resize(CANVAS_WIDTH, canvasHeight, { fit: 'fill' })
          .ensureAlpha()
          .png()
          .toBuffer()
      } else {
        canvasHeight = DEFAULT_HEIGHT
        bgBuffer = await sharp({
          create: { width: CANVAS_WIDTH, height: canvasHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
        }).png().toBuffer()
      }

      console.log(`[composite] Canvas: ${CANVAS_WIDTH}x${canvasHeight}, ${elements.length} element(s)`)

      // ── STAGE 2: Process elements + deterministic placement ──
      const layers: sharp.OverlayOptions[] = []

      for (const el of elements) {
        let elBuffer: Buffer
        try {
          const elPath = urlToAssetPath(el.assetUrl, assetsRoot)
          elBuffer = fs.readFileSync(elPath)
        } catch {
          console.warn(`[composite] Skipping element, file not found: ${el.assetUrl}`)
          continue
        }

        // Auto-orient only if EXIF says so (matches browser's auto-orientation)
        const meta = await sharp(elBuffer).metadata()
        if (meta.orientation && meta.orientation > 1) {
          elBuffer = await sharp(elBuffer).rotate().png().toBuffer()
        }

        const { buffer: cleanBuffer } = await removeBackground(elBuffer)

        const targetW = Math.round(Math.abs(el.width))
        const targetH = Math.round(Math.abs(el.height))

        console.log(`[composite] Element transforms: flipH=${el.flipH}, flipV=${el.flipV}, rotation=${el.rotation}`)

        // Each transform in its own pipeline to avoid sharp's internal reordering
        let buf = await sharp(cleanBuffer)
          .resize(targetW, targetH, { fit: 'fill' })
          .png()
          .toBuffer()

        if (el.flipH) {
          buf = await sharp(buf).flop().png().toBuffer()
          console.log(`[composite] Applied flop (horizontal flip)`)
        }

        if (el.flipV) {
          buf = await sharp(buf).flip().png().toBuffer()
          console.log(`[composite] Applied flip (vertical flip)`)
        }

        const normalizedRotation = ((el.rotation % 360) + 360) % 360
        if (normalizedRotation > 0.5 && normalizedRotation < 359.5) {
          buf = await sharp(buf)
            .rotate(normalizedRotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()
          console.log(`[composite] Applied rotation: ${normalizedRotation}°`)
        }

        const processedBuffer = buf
        const processedMeta = await sharp(processedBuffer).metadata()

        const rotW = processedMeta.width!
        const rotH = processedMeta.height!
        const offsetX = Math.round(el.x - (rotW - targetW) / 2)
        const offsetY = Math.round(el.y - (rotH - targetH) / 2)

        // Shadow layer (placed before the element so it renders underneath)
        const shadowSigma = Math.max(3, Math.round(el.height * 0.04))
        const shadowPng = await buildShadow(processedBuffer, shadowSigma)
        const shadowOffsetY = offsetY + Math.round(el.height * 0.03)

        layers.push({
          input: shadowPng,
          left: Math.max(0, offsetX),
          top: Math.max(0, shadowOffsetY),
          blend: 'over' as const,
        })

        // Element layer
        layers.push({
          input: processedBuffer,
          left: Math.max(0, offsetX),
          top: Math.max(0, offsetY),
          blend: 'over' as const,
        })

        console.log(`[composite] Placed element at (${offsetX},${offsetY}) ${rotW}x${rotH}`)
      }

      const composedBuffer = await sharp(bgBuffer)
        .composite(layers)
        .png()
        .toBuffer()

      // Save the deterministic composite
      const placedFilename = `placed-${Date.now()}.png`
      const placedPath = path.join(assetsRoot, 'composites', placedFilename)
      fs.writeFileSync(placedPath, composedBuffer)
      console.log(`[composite] Stage 2 saved: ${placedFilename}`)

      if (!refine) {
        res.json({
          url: `/api/asset-files/composites/${placedFilename}`,
          filename: placedFilename,
          stage: 'placed',
        })
        return
      }

      // ── STAGE 3: AI refinement (polish only) ──
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
        return
      }

      const openai = new OpenAI({ apiKey })
      const refinementPrompt = buildPolishPrompt(prompt)

      const aspectRatio = CANVAS_WIDTH / canvasHeight
      const outputSize: '1024x1024' | '1536x1024' | '1024x1536' =
        aspectRatio > 1.2 ? '1536x1024' :
        aspectRatio < 0.8 ? '1024x1536' :
        '1024x1024'

      console.log(`[composite] Stage 3: AI polish (${outputSize})`)

      const imageBytes = new Uint8Array(composedBuffer)
      const imageFile = new File([imageBytes], 'composed.png', { type: 'image/png' })

      const response = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageFile,
        prompt: refinementPrompt,
        size: outputSize,
      })

      const imageData = response.data?.[0]
      if (!imageData?.b64_json) {
        res.status(500).json({ error: 'No image returned from OpenAI' })
        return
      }

      const refinedFilename = `refined-${Date.now()}.png`
      const refinedPath = path.join(assetsRoot, 'composites', refinedFilename)
      const refinedBuffer = Buffer.from(imageData.b64_json, 'base64')
      fs.writeFileSync(refinedPath, refinedBuffer)
      console.log(`[composite] Stage 3 saved: ${refinedFilename}`)

      res.json({
        url: `/api/asset-files/composites/${refinedFilename}`,
        filename: refinedFilename,
        placedUrl: `/api/asset-files/composites/${placedFilename}`,
        stage: 'refined',
      })
    } catch (err: any) {
      console.error('Composite pipeline error:', err)
      res.status(500).json({ error: err.message || 'Pipeline failed' })
    }
  })

  return router
}
