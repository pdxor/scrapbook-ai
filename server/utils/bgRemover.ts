import sharp from 'sharp'

interface RemoveBgResult {
  buffer: Buffer
  width: number
  height: number
  hadBackground: boolean
}

export async function removeBackground(imageBuffer: Buffer): Promise<RemoveBgResult> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const totalPixels = width * height

  // If image already has >5% transparent pixels, skip BG removal
  let transparentCount = 0
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 128) transparentCount++
  }
  if (transparentCount / totalPixels > 0.05) {
    const buffer = await sharp(imageBuffer).png().toBuffer()
    return { buffer, width, height, hadBackground: false }
  }

  // Sample edge pixels to detect dominant background color
  const sampleDepth = Math.max(3, Math.min(20, Math.floor(Math.min(width, height) * 0.05)))
  const edgeColors: { r: number; g: number; b: number }[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isEdge = x < sampleDepth || x >= width - sampleDepth ||
                     y < sampleDepth || y >= height - sampleDepth
      if (!isEdge) continue
      const off = (y * width + x) * 4
      edgeColors.push({ r: data[off], g: data[off + 1], b: data[off + 2] })
    }
  }

  // Use median of edge colors as the background color (robust to outliers)
  const mid = Math.floor(edgeColors.length / 2)
  const bgR = edgeColors.map(p => p.r).sort((a, b) => a - b)[mid]
  const bgG = edgeColors.map(p => p.g).sort((a, b) => a - b)[mid]
  const bgB = edgeColors.map(p => p.b).sort((a, b) => a - b)[mid]

  // Adaptive threshold based on edge color variance
  const avgDist = edgeColors.reduce((sum, p) => {
    return sum + Math.sqrt((p.r - bgR) ** 2 + (p.g - bgG) ** 2 + (p.b - bgB) ** 2)
  }, 0) / edgeColors.length

  const threshold = Math.max(30, Math.min(60, avgDist * 1.5 + 15))
  const featherRange = 15

  const result = Buffer.from(data)

  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4
    const r = data[off]
    const g = data[off + 1]
    const b = data[off + 2]

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2)

    if (dist < threshold) {
      result[off + 3] = 0
    } else if (dist < threshold + featherRange) {
      const alpha = Math.round(((dist - threshold) / featherRange) * 255)
      result[off + 3] = Math.min(result[off + 3], alpha)
    }
  }

  const outputBuffer = await sharp(result, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer()

  return { buffer: outputBuffer, width, height, hadBackground: true }
}
