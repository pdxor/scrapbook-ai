import express from 'express'
import cors from 'cors'
import { assetsRouter } from './routes/assets.js'
import { generateRouter } from './routes/generate.js'
import { refineRouter } from './routes/refine.js'
import { compositeRouter } from './routes/composite.js'
import { exportRouter } from './routes/export.js'
import { videoRouter } from './routes/video.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json({ limit: '50mb' }))

  // Netlify rewrites /api/* → /.netlify/functions/api/*
  // Normalize the path so Express routes match either way
  app.use((req, _res, next) => {
    const prefix = '/.netlify/functions/api'
    if (req.url.startsWith(prefix)) {
      req.url = '/api' + req.url.slice(prefix.length)
    }
    next()
  })

  app.use('/api/assets', assetsRouter())
  app.use('/api/generate', generateRouter())
  app.use('/api/refine', refineRouter())
  app.use('/api/composite', compositeRouter())
  app.use('/api/export', exportRouter())
  app.use('/api/video', videoRouter())

  return app
}
