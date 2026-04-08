import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import OpenAI from 'openai'

export function generateRouter(assetsRoot: string): Router {
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
        res.status(500).json({ error: 'OPENAI_API_KEY not configured in .env' })
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
      const filePath = path.join(assetsRoot, type, filename)
      const buffer = Buffer.from(imageData.b64_json, 'base64')
      fs.writeFileSync(filePath, buffer)

      res.json({
        filename,
        url: `/api/asset-files/${type}/${filename}`,
        type,
      })
    } catch (err: any) {
      console.error('Generation error:', err)
      res.status(500).json({ error: err.message || 'Generation failed' })
    }
  })

  return router
}
