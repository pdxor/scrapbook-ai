import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const VALID_TYPES = ['characters', 'objects', 'backgrounds', 'composites', 'storyboards']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

export function assetsRouter(assetsRoot: string): Router {
  const router = Router()

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const type = req.params.type
      cb(null, path.join(assetsRoot, type))
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname)
    },
  })
  const upload = multer({ storage })

  router.get('/:type', (req, res) => {
    const { type } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    const dir = path.join(assetsRoot, type)
    const files = fs.readdirSync(dir).filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))

    const filesWithTime = files.map(filename => ({
      filename,
      mtime: fs.statSync(path.join(dir, filename)).mtimeMs,
    }))
    filesWithTime.sort((a, b) => b.mtime - a.mtime)

    const assets = filesWithTime.map(({ filename }) => ({
      filename,
      url: `/api/asset-files/${type}/${filename}`,
      type,
    }))
    res.json(assets)
  })

  router.post('/:type', upload.single('file'), (req, res) => {
    const { type } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }
    res.json({
      filename: req.file.filename,
      url: `/api/asset-files/${type}/${req.file.filename}`,
      type,
    })
  })

  router.delete('/:type/:filename', (req, res) => {
    const { type, filename } = req.params
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid asset type' })
      return
    }
    const filePath = path.join(assetsRoot, type, filename)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' })
      return
    }
    fs.unlinkSync(filePath)
    res.json({ success: true })
  })

  return router
}
