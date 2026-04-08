import { Router } from 'express'
import OpenAI from 'openai'
import { uploadAssetBuffer } from '../lib/storage.js'

export function generateRouter(): Router {
  const router = Router()

  router.post('/', async (req, res) => {
    try {
      const { type, prompt } = req.body
      if (!type || !prompt) {
        res.status(400).json({ error: 'type and prompt required' })
        return
      }

      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey || apiKey === 'your-openai-api-key-here') {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
        return
      }

      const openai = new OpenAI({ apiKey })

      const response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
      })

      const imageData = response.data?.[0]
      if (!imageData?.b64_json) {
        res.status(500).json({ error: 'No image returned from OpenAI' })
        return
      }

      const filename = `generated-${Date.now()}.png`
      const buffer = Buffer.from(imageData.b64_json, 'base64')
      const url = await uploadAssetBuffer(type, filename, buffer)

      res.json({ filename, url, type })
    } catch (err: any) {
      console.error('Generation error:', err)
      res.status(500).json({ error: err.message || 'Generation failed' })
    }
  })

  return router
}
