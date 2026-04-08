import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

export function exportRouter(assetsRoot: string): Router {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage() })

  router.post('/composite', upload.single('image'), (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image provided' })
        return
      }
      const filename = `composite-${Date.now()}.png`
      const filePath = path.join(assetsRoot, 'composites', filename)
      fs.writeFileSync(filePath, req.file.buffer)
      res.json({
        filename,
        url: `/api/asset-files/composites/${filename}`,
        type: 'composites',
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/storyboard', (req, res) => {
    try {
      const { frames } = req.body
      if (!frames || !Array.isArray(frames)) {
        res.status(400).json({ error: 'frames array required' })
        return
      }

      const storyDir = path.join(assetsRoot, 'storyboards')
      const timestamp = Date.now()
      const savedFiles: string[] = []

      for (let i = 0; i < frames.length; i++) {
        const { dataUrl, title } = frames[i]
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64, 'base64')
        const filename = `${title || `scene-${String(i + 1).padStart(3, '0')}`}-${timestamp}.png`
        const filePath = path.join(storyDir, filename)
        fs.writeFileSync(filePath, buffer)
        savedFiles.push(filename)
      }

      res.json({ files: savedFiles })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
