import { Router } from 'express'
import multer from 'multer'
import { listAssets, uploadAssetBuffer, deleteAssetFile } from '../lib/storage.js'

const VALID_TYPES = ['characters', 'objects', 'backgrounds', 'composites', 'storyboards']

export function assetsRouter(): Router {
  const router = Router()
  const upload = multer({ storage: multer.memoryStorage() })

  router.get('/:type', async (req, res) => {
    const { type } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    try {
      const assets = await listAssets(type)
      res.json(assets)
    } catch (err: any) {
      console.error(`List assets error (${type}):`, err.message)
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/:type', upload.single('file'), async (req, res) => {
    const { type } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }
    try {
      const url = await uploadAssetBuffer(type, req.file.originalname, req.file.buffer, req.file.mimetype)
      res.json({ filename: req.file.originalname, url, type })
    } catch (err: any) {
      console.error(`Upload asset error (${type}):`, err.message)
      res.status(500).json({ error: err.message })
    }
  })

  router.delete('/:type/:filename', async (req, res) => {
    const { type, filename } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    try {
      await deleteAssetFile(type, filename)
      res.json({ success: true })
    } catch (err: any) {
      console.error(`Delete asset error:`, err.message)
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
