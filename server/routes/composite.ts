import { Router } from 'express'
import sharp from 'sharp'
import OpenAI from 'openai'
import { removeBackground } from '../utils/bgRemover.js'
import { uploadAssetBuffer, downloadFromUrl } from '../lib/storage.js'

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

export function compositeRouter(): Router {
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
        const bgRaw = await downloadFromUrl(backgroundUrl)
        const bgMeta = await sharp(bgRaw).metadata()
        canvasHeight = Math.round(CANVAS_WIDTH * (bgMeta.height! / bgMeta.width!))
        bgBuffer = await sharp(bgRaw)
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
          elBuffer = await downloadFromUrl(el.assetUrl)
        } catch (err: any) {
          console.warn(`[composite] Skipping element, download failed: ${el.assetUrl} — ${err.message}`)
          continue
        }

        const meta = await sharp(elBuffer).metadata()
        if (meta.orientation && meta.orientation > 1) {
          elBuffer = await sharp(elBuffer).rotate().png().toBuffer()
        }

        const { buffer: cleanBuffer } = await removeBackground(elBuffer)

        const targetW = Math.round(Math.abs(el.width))
        const targetH = Math.round(Math.abs(el.height))

        console.log(`[composite] Element transforms: flipH=${el.flipH}, flipV=${el.flipV}, rotation=${el.rotation}`)

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

        const shadowSigma = Math.max(3, Math.round(el.height * 0.04))
        const shadowPng = await buildShadow(processedBuffer, shadowSigma)
        const shadowOffsetY = offsetY + Math.round(el.height * 0.03)

        layers.push({
          input: shadowPng,
          left: Math.max(0, offsetX),
          top: Math.max(0, shadowOffsetY),
          blend: 'over' as const,
        })

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

      const placedFilename = `placed-${Date.now()}.png`
      const placedUrl = await uploadAssetBuffer('composites', placedFilename, composedBuffer)
      console.log(`[composite] Stage 2 saved: ${placedFilename}`)

      if (!refine) {
        res.json({
          url: placedUrl,
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

      const ar = CANVAS_WIDTH / canvasHeight
      const outputSize: '1024x1024' | '1536x1024' | '1024x1536' =
        ar > 1.2 ? '1536x1024' :
        ar < 0.8 ? '1024x1536' :
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
      const refinedBuffer = Buffer.from(imageData.b64_json, 'base64')
      const refinedUrl = await uploadAssetBuffer('composites', refinedFilename, refinedBuffer)
      console.log(`[composite] Stage 3 saved: ${refinedFilename}`)

      res.json({
        url: refinedUrl,
        filename: refinedFilename,
        placedUrl,
        stage: 'refined',
      })
    } catch (err: any) {
      console.error('Composite pipeline error:', err)
      res.status(500).json({ error: err.message || 'Pipeline failed' })
    }
  })

  return router
}
