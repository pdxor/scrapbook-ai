import 'dotenv/config'
import { createApp } from './app.js'
import { startVideoQueue } from './services/videoQueue.js'

const app = createApp()
const PORT = 3001

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  startVideoQueue()
})
