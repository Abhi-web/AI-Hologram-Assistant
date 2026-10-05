import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'

// RGB <-> HSL helper
function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h,
    s,
    l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

async function processImageBuffer(imgBuffer, type) {
  return new Promise((resolve, reject) => {
    const png = new PNG()
    png.parse(imgBuffer, (err, data) => {
      if (err) return reject(err)

      const width = data.width
      const height = data.height
      const pixels = data.data

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (width * y + x) << 2
          const a = pixels[idx + 3]
          if (a === 0) continue

          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]
          const [h, s, l] = rgbToHsl(r, g, b)

          if (type === 'hair') {
            // Transform hair to golden blonde (hue ~0.12, warmth, high vibrance)
            const blondeHue = 0.12 // 43.2 degrees golden
            const blondeSat = Math.min(1.0, Math.max(0.65, s * 1.35))
            const blondeLight = Math.min(0.92, Math.max(0.25, l * 1.15 + 0.12))
            const [newR, newG, newB] = hslToRgb(blondeHue, blondeSat, blondeLight)
            pixels[idx] = newR
            pixels[idx + 1] = newG
            pixels[idx + 2] = newB
          } else if (type === 'eyebrow') {
            // Golden blonde eyebrows to match hair
            const blondeHue = 0.11
            const [newR, newG, newB] = hslToRgb(blondeHue, 0.75, Math.min(0.65, Math.max(0.35, l + 0.1)))
            pixels[idx] = newR
            pixels[idx + 1] = newG
            pixels[idx + 2] = newB
          } else if (type === 'eye') {
            // Radiant anime cyan/sapphire iris
            const eyeHue = 0.54 // Cyan-blue
            const [newR, newG, newB] = hslToRgb(eyeHue, Math.min(1.0, s * 1.25), Math.min(0.85, l * 1.05))
            pixels[idx] = newR
            pixels[idx + 1] = newG
            pixels[idx + 2] = newB
          } else if (type === 'top') {
            // Elegant futuristic cyber black top with glowing cyan accents
            // Accent detection: edges or high brightness patterns become cyan piping
            const isAccent = (y < height * 0.12 && (x % 32 < 6)) || (s > 0.4 && l > 0.4)
            if (isAccent) {
              // Glowing cyan piping
              pixels[idx] = 0
              pixels[idx + 1] = 212
              pixels[idx + 2] = 255
            } else {
              // Sleek dark charcoal/black
              const darkL = Math.min(0.22, l * 0.28 + 0.05)
              const [newR, newG, newB] = hslToRgb(0.6, 0.2, darkL)
              pixels[idx] = newR
              pixels[idx + 1] = newG
              pixels[idx + 2] = newB
            }
          } else if (type === 'bottom') {
            // Sleek black pleated cyber skirt / bottoms with cyan trim
            const isHem = y > height * 0.88 || (x % 48 < 4 && y > height * 0.5)
            if (isHem) {
              pixels[idx] = 0
              pixels[idx + 1] = 212
              pixels[idx + 2] = 255
            } else {
              const darkL = Math.min(0.2, l * 0.25 + 0.04)
              const [newR, newG, newB] = hslToRgb(0.6, 0.25, darkL)
              pixels[idx] = newR
              pixels[idx + 1] = newG
              pixels[idx + 2] = newB
            }
          } else if (type === 'shoes') {
            // Dark futuristic boots with glowing accents
            const isCyanAccent = y < height * 0.2 && x % 20 < 4
            if (isCyanAccent) {
              pixels[idx] = 0
              pixels[idx + 1] = 212
              pixels[idx + 2] = 255
            } else {
              const darkL = Math.min(0.18, l * 0.2 + 0.03)
              const [newR, newG, newB] = hslToRgb(0.6, 0.15, darkL)
              pixels[idx] = newR
              pixels[idx + 1] = newG
              pixels[idx + 2] = newB
            }
          }
        }
      }

      const outChunks = []
      png.pack()
      png.on('data', (c) => outChunks.push(c))
      png.on('end', () => resolve(Buffer.concat(outChunks)))
      png.on('error', reject)
    })
  })
}

async function main() {
  console.log('[BuildAnimeAvatar] Reading scratch/AvatarSample_B.vrm...')
  const inputBuf = fs.readFileSync('scratch/AvatarSample_B.vrm')

  const jsonChunkLen = inputBuf.readUInt32LE(12)
  const jsonChunkType = inputBuf.readUInt32LE(16)
  const gltf = JSON.parse(inputBuf.toString('utf8', 20, 20 + jsonChunkLen))

  // Binary chunk
  const binHeaderOffset = 20 + jsonChunkLen
  const binChunkLen = inputBuf.readUInt32LE(binHeaderOffset)
  const binChunkType = inputBuf.readUInt32LE(binHeaderOffset + 4)
  const binBuffer = inputBuf.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLen)

  console.log('[BuildAnimeAvatar] Customizing character appearance...')

  // Mapping of image indices to processing types
  // Hair: images 16, 19, 21, 23, 25, 27
  // Eyebrows: image 8
  // Eye iris: image 3
  // Tops: image 14
  // Bottoms: image 15
  // Shoes: image 13
  const targetImageMap = {
    16: 'hair',
    19: 'hair',
    21: 'hair',
    23: 'hair',
    25: 'hair',
    27: 'hair',
    8: 'eyebrow',
    3: 'eye',
    14: 'top',
    15: 'bottom',
    13: 'shoes',
  }

  // We need to replace bufferView data for target images
  // To avoid byte length mismatches, we reconstruct the binary chunk with new bufferViews
  const newBufferViews = []
  const newBuffers = []
  let currentOffset = 0

  // First copy all existing bufferViews or replace if modified
  for (let i = 0; i < gltf.bufferViews.length; i++) {
    const bv = gltf.bufferViews[i]
    let slice = binBuffer.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)

    // Check if any image uses this bufferView
    const imgIdx = gltf.images.findIndex((img) => img.bufferView === i)
    if (imgIdx !== -1 && targetImageMap[imgIdx]) {
      const type = targetImageMap[imgIdx]
      console.log(`  Processing image [${imgIdx}] as ${type}...`)
      slice = await processImageBuffer(slice, type)
    }

    // glTF bufferViews should be aligned to 4-byte boundaries
    const padding = (4 - (slice.length % 4)) % 4
    const paddedSlice = padding > 0 ? Buffer.concat([slice, Buffer.alloc(padding)]) : slice

    newBufferViews.push({
      ...bv,
      byteOffset: currentOffset,
      byteLength: slice.length,
    })

    newBuffers.push(paddedSlice)
    currentOffset += paddedSlice.length
  }

  // Update gltf
  gltf.bufferViews = newBufferViews
  gltf.buffers[0].byteLength = currentOffset

  // Update VRM title
  if (gltf.extensions?.VRMC_vrm?.meta) {
    gltf.extensions.VRMC_vrm.meta.name = 'ARIA_Anime_Avatar'
    gltf.extensions.VRMC_vrm.meta.authors = ['ARIA AI Project', 'VRoid Project']
  }

  // Re-encode JSON chunk
  let newJsonStr = JSON.stringify(gltf)
  const jsonPadding = (4 - (Buffer.byteLength(newJsonStr) % 4)) % 4
  if (jsonPadding > 0) {
    newJsonStr += ' '.repeat(jsonPadding)
  }
  const newJsonBuf = Buffer.from(newJsonStr, 'utf8')

  // Combine binary chunks
  const newBinBuf = Buffer.concat(newBuffers)

  // Assemble GLB
  const totalLength = 12 + 8 + newJsonBuf.length + 8 + newBinBuf.length
  const outBuf = Buffer.alloc(totalLength)

  // Header
  outBuf.write('glTF', 0)
  outBuf.writeUInt32LE(2, 4)
  outBuf.writeUInt32LE(totalLength, 8)

  // JSON chunk
  outBuf.writeUInt32LE(newJsonBuf.length, 12)
  outBuf.writeUInt32LE(0x4e4f534a, 16) // JSON
  newJsonBuf.copy(outBuf, 20)

  // BIN chunk
  const binStart = 20 + newJsonBuf.length
  outBuf.writeUInt32LE(newBinBuf.length, binStart)
  outBuf.writeUInt32LE(0x004e4942, binStart + 4) // BIN\0
  newBinBuf.copy(outBuf, binStart + 8)

  const outPath = path.resolve('public/models/aria-anime.vrm')
  fs.writeFileSync(outPath, outBuf)
  console.log(`[BuildAnimeAvatar] Successfully generated ${outPath} (${(outBuf.length / 1024 / 1024).toFixed(2)} MB)!`)
}

main().catch(console.error)
