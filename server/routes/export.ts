import { Router } from 'express'
import multer from 'multer'
import { uploadAssetBuffer } from '../lib/storage.js'

export function exportRouter(): Router {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage() })

  router.post('/composite', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image provided' })
        return
      }
      const filename = `composite-${Date.now()}.png`
      const url = await uploadAssetBuffer('composites', filename, req.file.buffer)
      res.json({ filename, url, type: 'composites' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/storyboard', async (req, res) => {
    try {
      const { frames } = req.body
      if (!frames || !Array.isArray(frames)) {
        res.status(400).json({ error: 'frames array required' })
        return
      }

      const timestamp = Date.now()
      const savedFiles: string[] = []

      for (let i = 0; i < frames.length; i++) {
        const { dataUrl, title } = frames[i]
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64, 'base64')
        const filename = `${title || `scene-${String(i + 1).padStart(3, '0')}`}-${timestamp}.png`
        await uploadAssetBuffer('storyboards', filename, buffer)
        savedFiles.push(filename)
      }

      res.json({ files: savedFiles })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
