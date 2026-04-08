import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { assetsRouter } from './routes/assets.js'
import { generateRouter } from './routes/generate.js'
import { refineRouter } from './routes/refine.js'
import { compositeRouter } from './routes/composite.js'
import { exportRouter } from './routes/export.js'
import { videoRouter } from './routes/video.js'
import { startVideoQueue } from './services/videoQueue.js'

const app = express()
const PORT = 3001
const ASSETS_ROOT = path.resolve(process.cwd(), 'assets')

const ASSET_DIRS = ['characters', 'objects', 'backgrounds', 'composites', 'storyboards', 'videos']
for (const dir of ASSET_DIRS) {
  const dirPath = path.join(ASSETS_ROOT, dir)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/api/asset-files', express.static(ASSETS_ROOT))

app.use('/api/assets', assetsRouter(ASSETS_ROOT))
app.use('/api/generate', generateRouter(ASSETS_ROOT))
app.use('/api/refine', refineRouter(ASSETS_ROOT))
app.use('/api/composite', compositeRouter(ASSETS_ROOT))
app.use('/api/export', exportRouter(ASSETS_ROOT))
app.use('/api/video', videoRouter())

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  startVideoQueue()
})
