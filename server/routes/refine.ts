import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import OpenAI from 'openai'
import { generateBackdropMask } from '../utils/maskGenerator.js'
import { uploadAssetBuffer } from '../lib/storage.js'

function buildRefinementPrompt(userDirection: string, masked: boolean): string {
  const lines = [
    'CRITICAL: THIS IS A NON-GENERATIVE EDIT TASK.',
    'The image already contains the final subject. You are NOT allowed to reinterpret or regenerate it.',
    '',
    'PRIMARY GOAL:',
    'Fill ONLY the masked area (where the green/blue screen was) with a natural continuation of the background scene.',
    '',
  ]

  if (masked) {
    lines.push(
      'HARD CONSTRAINT — MASK INTERPRETATION:',
      '- ONLY modify pixels inside the transparent mask area.',
      '- All pixels outside the mask MUST remain EXACTLY identical — zero modification.',
      '- The subject is OUTSIDE the mask and is completely off-limits.',
      '',
    )
  }

  lines.push(
    'HARD CONSTRAINT — IDENTITY LOCK:',
    '- The character is LOCKED.',
    '- Treat the character as a pasted photograph layer.',
    '- You are NOT allowed to redraw, restyle, enhance, or reinterpret the character.',
    '- If ANY pixel of the character changes, the result is INVALID.',
    '',
    'HARD CONSTRAINT — PIXEL FREEZE:',
    '- 100% of pixels outside the mask must remain EXACTLY identical.',
    '- Do not modify lighting, color, texture, or sharpness outside the mask.',
    '- Do not apply global changes.',
    '',
    'HARD CONSTRAINT — FAILURE MODE:',
    '- If you cannot complete the task without modifying the character, RETURN THE ORIGINAL IMAGE UNCHANGED.',
    '',
    'CHARACTER CONSISTENCY ANCHOR:',
    '- The subject is a pre-rendered character asset with specific proportions, colors, and materials.',
    '- The exact design, proportions, and materials must remain unchanged.',
    '- Treat this as a fixed asset layer, not something to generate.',
    '',
    'ALLOWED AREA:',
    '- ONLY operate inside the mask region.',
    '- The mask represents missing background ONLY.',
    '',
    'ALLOWED OPERATIONS (ONLY THESE):',
    '1. Fill the masked area with a natural continuation of the surrounding background.',
    '2. Blend within 1-2 pixels of the mask boundary for feathering.',
    '3. Add a very subtle contact shadow directly beneath the subject.',
    '',
    'EDGE RULE:',
    '- You may only blend within 1-2 pixels of the mask boundary.',
    '- Do NOT touch the subject edge beyond minimal feathering.',
    '',
    'STYLE LOCK:',
    '- Do NOT apply cinematic grading, color shifts, or AI stylization.',
    '- Match existing background exactly. No enhancement.',
    '',
    'FORBIDDEN (ZERO TOLERANCE):',
    '- Do NOT change, redraw, or reinterpret ANY character or object.',
    '- Do NOT reposition or resize anything.',
    '- Do NOT add new elements, text, or watermarks.',
    '- Do NOT change the art style of anything.',
    '- Do NOT apply global color correction or enhancement.',
    '',
    'COMPOSITING RULE:',
    'This is NOT an artistic task. This is technical compositing cleanup like Photoshop content-aware fill.',
    'Preserve exact spatial composition and pixel alignment of all non-masked areas.',
    '',
    'If unsure about any area, leave it UNCHANGED.',
    '',
    'ADDITIONAL DIRECTION:',
    userDirection,
  )

  return lines.join('\n')
}

export function refineRouter(): Router {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage() })

  router.post('/', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image provided' })
        return
      }

      const userDirection = req.body.prompt || 'Fill the green screen area behind the character with a natural continuation of the background scene.'

      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured in .env' })
        return
      }

      const openai = new OpenAI({ apiKey })

      const metadata = await sharp(req.file.buffer).metadata()
      const imgWidth = metadata.width || 1024
      const imgHeight = metadata.height || 576
      const aspectRatio = imgWidth / imgHeight
      const outputSize: '1024x1024' | '1536x1024' | '1024x1536' =
        aspectRatio > 1.2 ? '1536x1024' :
        aspectRatio < 0.8 ? '1024x1536' :
        '1024x1024'

      const { maskBuffer, compositeMaskBuffer, hasEditableRegions, editPercent } = await generateBackdropMask(req.file.buffer)
      console.log(`Mask generated: ${editPercent.toFixed(1)}% editable, hasRegions=${hasEditableRegions}`)

      const imageBytes = new Uint8Array(req.file.buffer)
      const imageFile = new File([imageBytes], 'composite.png', { type: 'image/png' })

      const fullPrompt = buildRefinementPrompt(userDirection, hasEditableRegions)

      let response
      if (hasEditableRegions) {
        const maskBytes = new Uint8Array(maskBuffer)
        const maskFile = new File([maskBytes], 'mask.png', { type: 'image/png' })
        console.log('Using MASKED edit (surgical mode)')
        response = await openai.images.edit({
          model: 'gpt-image-1',
          image: imageFile,
          mask: maskFile,
          prompt: fullPrompt,
          size: outputSize,
        })
      } else {
        console.log('No backdrop detected, using unmasked edit')
        response = await openai.images.edit({
          model: 'gpt-image-1',
          image: imageFile,
          prompt: fullPrompt,
          size: outputSize,
        })
      }

      const imageData = response.data?.[0]
      if (!imageData?.b64_json) {
        res.status(500).json({ error: 'No image returned from OpenAI' })
        return
      }

      const aiBuffer = Buffer.from(imageData.b64_json, 'base64')

      let buffer: Buffer
      if (hasEditableRegions) {
        console.log('Compositing original subject back over AI result (2-pass pipeline)')

        const aiResized = await sharp(aiBuffer)
          .resize(imgWidth, imgHeight)
          .ensureAlpha()
          .raw()
          .toBuffer()

        const originalRaw = await sharp(req.file.buffer)
          .resize(imgWidth, imgHeight)
          .ensureAlpha()
          .raw()
          .toBuffer()

        const { data: maskData } = await sharp(compositeMaskBuffer)
          .resize(imgWidth, imgHeight)
          .grayscale()
          .raw()
          .toBuffer({ resolveWithObject: true })

        const totalPx = imgWidth * imgHeight
        const finalPixels = Buffer.alloc(totalPx * 4)

        for (let i = 0; i < totalPx; i++) {
          const rgbaOff = i * 4
          const blend = maskData[i] / 255
          finalPixels[rgbaOff]     = Math.round(originalRaw[rgbaOff]     * (1 - blend) + aiResized[rgbaOff]     * blend)
          finalPixels[rgbaOff + 1] = Math.round(originalRaw[rgbaOff + 1] * (1 - blend) + aiResized[rgbaOff + 1] * blend)
          finalPixels[rgbaOff + 2] = Math.round(originalRaw[rgbaOff + 2] * (1 - blend) + aiResized[rgbaOff + 2] * blend)
          finalPixels[rgbaOff + 3] = 255
        }

        buffer = await sharp(finalPixels, { raw: { width: imgWidth, height: imgHeight, channels: 4 } })
          .png()
          .toBuffer()
      } else {
        buffer = aiBuffer
      }

      const filename = `refined-${Date.now()}.png`
      const url = await uploadAssetBuffer('composites', filename, buffer)

      res.json({
        url,
        filename,
        masked: hasEditableRegions,
        editPercent: parseFloat(editPercent.toFixed(1)),
      })
    } catch (err: any) {
      console.error('Refinement error:', err)
      res.status(500).json({ error: err.message || 'Refinement failed' })
    }
  })

  return router
}
