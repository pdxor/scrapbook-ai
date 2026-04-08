import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ASSETS_ROOT = path.resolve(process.cwd(), 'assets')
const TYPES = ['characters', 'objects', 'backgrounds']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  return map[ext] || 'application/octet-stream'
}

async function main() {
  let total = 0
  let uploaded = 0
  let skipped = 0

  for (const type of TYPES) {
    const dir = path.join(ASSETS_ROOT, type)
    if (!fs.existsSync(dir)) continue

    const files = fs.readdirSync(dir).filter(f => {
      const ext = path.extname(f).toLowerCase()
      return IMAGE_EXTS.includes(ext) && !f.startsWith('.')
    })

    console.log(`\n${type}: ${files.length} files`)

    for (const filename of files) {
      total++
      const filePath = path.join(dir, filename)
      const buffer = fs.readFileSync(filePath)
      const ext = path.extname(filename).toLowerCase()
      const storagePath = `${type}/${filename}`

      const { error } = await supabase.storage
        .from('assets')
        .upload(storagePath, buffer, {
          contentType: getMimeType(ext),
          upsert: true,
        })

      if (error) {
        console.error(`  ✗ ${filename}: ${error.message}`)
        skipped++
      } else {
        console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
        uploaded++
      }
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} failed, ${total} total`)
}

main().catch(console.error)
