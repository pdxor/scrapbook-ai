import sharp from 'sharp'

interface MaskResult {
  maskBuffer: Buffer
  compositeMaskBuffer: Buffer
  hasEditableRegions: boolean
  editPercent: number
}

// Strict green screen detection — only catches obvious chroma key green,
// NOT greenish tones that might appear on characters/objects
function isGreenScreen(r: number, g: number, b: number): boolean {
  return g > 120 && r < 100 && b < 100 && (g - r) > 40 && (g - b) > 40
}

// Strict blue screen detection
function isBlueScreen(r: number, g: number, b: number): boolean {
  return b > 120 && r < 80 && g < 80 && (b - r) > 50 && (b - g) > 50
}

// Solid white backdrop (very high RGB, near-zero variance)
function isSolidWhite(r: number, g: number, b: number): boolean {
  return r > 245 && g > 245 && b > 245
}

export async function generateBackdropMask(imageBuffer: Buffer): Promise<MaskResult> {
  const metadata = await sharp(imageBuffer).metadata()
  const width = metadata.width!
  const height = metadata.height!
  const totalPixels = width * height

  const { data } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Pass 1: strict per-pixel color classification
  const rawMask = new Uint8Array(totalPixels) // 0 = preserve, 255 = edit
  let editableCount = 0

  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4
    const r = data[off]
    const g = data[off + 1]
    const b = data[off + 2]

    if (isGreenScreen(r, g, b) || isBlueScreen(r, g, b)) {
      rawMask[i] = 255
      editableCount++
    }
  }

  // Pass 2: ERODE the mask by 4px — shrink editable area AWAY from subject edges
  // This prevents the model from touching any character pixels at the boundary
  const erodeRadius = 4
  const erodedMask = new Uint8Array(totalPixels)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (rawMask[idx] === 0) continue // already preserve

      // Only keep as editable if ALL neighbors within radius are also editable
      let allEditable = true
      for (let dy = -erodeRadius; dy <= erodeRadius && allEditable; dy++) {
        for (let dx = -erodeRadius; dx <= erodeRadius && allEditable; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) {
            allEditable = false
          } else if (rawMask[ny * width + nx] === 0) {
            allEditable = false
          }
        }
      }
      if (allEditable) {
        erodedMask[idx] = 255
      }
    }
  }

  // Build RGBA mask PNG: transparent (alpha=0) = edit, opaque (alpha=255) = preserve
  const maskPixels = Buffer.alloc(totalPixels * 4)
  let finalEditCount = 0

  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4
    maskPixels[off] = 0
    maskPixels[off + 1] = 0
    maskPixels[off + 2] = 0
    if (erodedMask[i] === 255) {
      maskPixels[off + 3] = 0 // transparent = edit this area
      finalEditCount++
    } else {
      maskPixels[off + 3] = 255 // opaque = LOCKED, do not touch
    }
  }

  const maskBuffer = await sharp(maskPixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer()

  // Build a feathered composite mask from the RAW (un-eroded) detection.
  // Used in the 2-pass pipeline: AI fills background, then we paste original
  // subject pixels back using this mask. Blur creates smooth edge blending.
  // Grayscale: 255 = editable (use AI pixels), 0 = preserve (use original pixels)
  const compositeMaskBuffer = await sharp(Buffer.from(rawMask), {
    raw: { width, height, channels: 1 },
  })
    .blur(1.5)
    .png()
    .toBuffer()

  const editPercent = (finalEditCount / totalPixels) * 100

  return {
    maskBuffer,
    compositeMaskBuffer,
    hasEditableRegions: editPercent > 0.3,
    editPercent,
  }
}
