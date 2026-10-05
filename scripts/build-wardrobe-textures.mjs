import fs from 'fs'
import { PNG } from 'pngjs'

fs.mkdirSync('public/wardrobe/textures', { recursive: true })

function loadPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath))
}

function savePng(png, outputPath) {
  const buf = PNG.sync.write(png)
  fs.writeFileSync(outputPath, buf)
  console.log(`Saved ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`)
}

// ─── 1. CYBER DEFAULT TEXTURES ───────────────────────────────────────────────
console.log('[BuildWardrobeTextures] Saving Cyber Default textures...')
const cyberBody = loadPng('scratch/extracted_textures/img_11__10.png')
const cyberShoes = loadPng('scratch/extracted_textures/img_13__12.png')
const cyberTop = loadPng('scratch/extracted_textures/img_14__13.png')
const cyberBottom = loadPng('scratch/extracted_textures/img_15__14.png')

savePng(cyberBody, 'public/wardrobe/textures/cyber_body.png')
savePng(cyberShoes, 'public/wardrobe/textures/cyber_shoes.png')
savePng(cyberTop, 'public/wardrobe/textures/cyber_top.png')
savePng(cyberBottom, 'public/wardrobe/textures/cyber_bottom.png')

// ─── 2. OUTFIT 2: BLACK GOTHIC DRESS ─────────────────────────────────────────
console.log('[BuildWardrobeTextures] Generating Black Gothic Dress textures...')

// 2a. Gothic Top (Corset Bodice & Off-Shoulder Frill)
const gothicTop = loadPng('scratch/extracted_textures/img_14__13.png')
const topW = gothicTop.width
const topH = gothicTop.height

for (let y = 0; y < topH; y++) {
  for (let x = 0; x < topW; x++) {
    const idx = (topW * y + x) << 2
    const a = gothicTop.data[idx + 3]
    if (a === 0) continue

    // Pure rich matte gothic charcoal/black
    let r = 18
    let g = 18
    let b = 22

    // Off-shoulder neckline ruffle (upper 35% of the sleeves/top panels)
    if (y < topH * 0.22) {
      const frill = Math.sin(x * 0.05) * 8
      r = Math.max(12, 24 + frill)
      g = Math.max(12, 24 + frill)
      b = Math.max(16, 28 + frill)
    }

    // Vertical corset boning lines in the front bodice
    if (y > topH * 0.4 && y < topH * 0.9) {
      const isBoningSeam = (x % 96 < 3)
      if (isBoningSeam) {
        r = 32
        g = 32
        b = 38
      }

      // Front center corset criss-cross lacing
      const isCenterLace = (Math.abs(x - topW * 0.25) < 65) || (Math.abs(x - topW * 0.75) < 65)
      if (isCenterLace) {
        // Gold eyelets
        const distFromCenter = Math.min(Math.abs(x - topW * 0.25), Math.abs(x - topW * 0.75))
        if (distFromCenter > 48 && distFromCenter < 62 && y % 72 < 10) {
          r = 214
          g = 175
          b = 55
        } else if (distFromCenter < 48) {
          // Criss-cross cord
          const cord = Math.abs((x + y) % 48) < 3 || Math.abs((x - y) % 48) < 3
          if (cord) {
            r = 38
            g = 38
            b = 44
          }
        }
      }
    }

    // Bottom hem seam
    if (y > topH * 0.95) {
      r = 28
      g = 28
      b = 34
    }

    gothicTop.data[idx] = r
    gothicTop.data[idx + 1] = g
    gothicTop.data[idx + 2] = b
  }
}
savePng(gothicTop, 'public/wardrobe/textures/gothic_top.png')

// 2b. Gothic Bottom (Layered Asymmetrical Gothic Skirt)
const gothicBottom = loadPng('scratch/extracted_textures/img_15__14.png')
const botW = gothicBottom.width
const botH = gothicBottom.height

for (let y = 0; y < botH; y++) {
  for (let x = 0; x < botW; x++) {
    const idx = (botW * y + x) << 2
    const a = gothicBottom.data[idx + 3]
    if (a === 0) continue

    // Waist belt (top 16%)
    if (y < botH * 0.16) {
      // Leather belt
      gothicBottom.data[idx] = 12
      gothicBottom.data[idx + 1] = 12
      gothicBottom.data[idx + 2] = 15

      // Front gold buckle
      const inBuckle = Math.abs(x - botW * 0.5) < 32 && y > botH * 0.02 && y < botH * 0.14
      const isBuckleBorder = inBuckle && (Math.abs(x - botW * 0.5) > 24 || y < botH * 0.045 || y > botH * 0.115)
      const isBuckleProng = inBuckle && Math.abs(x - botW * 0.5) < 4
      if (isBuckleBorder || isBuckleProng) {
        gothicBottom.data[idx] = 214
        gothicBottom.data[idx + 1] = 175
        gothicBottom.data[idx + 2] = 55
      }
      continue
    }

    // Skirt pleats: rich black with crisp white/silver accent stitching lines
    const pleatShade = Math.sin(x * 0.15) * 4
    const isHemStitch = y > botH * 0.88 && y < botH * 0.91
    const isVerticalStitch = (x % 36 < 2) && y > botH * 0.35

    if (isHemStitch || isVerticalStitch) {
      // Contrast white/silver decorative stitching from reference
      gothicBottom.data[idx] = 225
      gothicBottom.data[idx + 1] = 228
      gothicBottom.data[idx + 2] = 235
    } else {
      const shade = Math.max(12, Math.min(26, 18 + pleatShade))
      gothicBottom.data[idx] = shade
      gothicBottom.data[idx + 1] = shade
      gothicBottom.data[idx + 2] = shade + 3
    }
  }
}
savePng(gothicBottom, 'public/wardrobe/textures/gothic_bottom.png')

// 2c. Gothic Body Skin (Clean Anime Base Skin + Gothic Choker + Stockings)
const gothicBody = loadPng('scratch/extracted_textures/fem_vroid_skin.png')
const bW = gothicBody.width
const bH = gothicBody.height

for (let y = 0; y < bH; y++) {
  for (let x = 0; x < bW; x++) {
    const idx = (bW * y + x) << 2

    // 1. High Gothic Black Choker Collar with Lace Scallops
    // Neck collar is at y: 0.03 to 0.10, x: 0.38 to 0.62
    if (y > bH * 0.03 && y < bH * 0.105 && x > bW * 0.36 && x < bW * 0.64) {
      const isLaceTrim = y > bH * 0.08 && Math.sin(x * 0.2) > -0.2
      if (y < bH * 0.08 || isLaceTrim) {
        gothicBody.data[idx] = 18
        gothicBody.data[idx + 1] = 18
        gothicBody.data[idx + 2] = 22

        // Front gold eyelets and lace cord
        if (Math.abs(x - bW * 0.5) < 22 && y > bH * 0.04 && y < bH * 0.075) {
          if (Math.abs(x - bW * 0.5) > 12 && y % 14 < 4) {
            gothicBody.data[idx] = 214
            gothicBody.data[idx + 1] = 175
            gothicBody.data[idx + 2] = 55
          }
        }
      }
      continue
    }

    // 2. Left Leg (x: 0.04 to 0.48, y: 0.54 to 0.94) -> FISHNET STOCKING
    if (y > bH * 0.54 && y < bH * 0.94 && x > bW * 0.04 && x < bW * 0.48) {
      // Top garter band
      if (y < bH * 0.575) {
        gothicBody.data[idx] = 16
        gothicBody.data[idx + 1] = 16
        gothicBody.data[idx + 2] = 20
      } else {
        // Crisp diamond fishnet grid
        const isNet = Math.abs((x + y) % 18) < 2 || Math.abs((x - y) % 18) < 2
        if (isNet) {
          gothicBody.data[idx] = 22
          gothicBody.data[idx + 1] = 22
          gothicBody.data[idx + 2] = 26
        }
      }
      continue
    }

    // 3. Right Leg (x: 0.52 to 0.96, y: 0.54 to 0.94) -> SHEER BLACK STOCKING WITH GARTER
    if (y > bH * 0.54 && y < bH * 0.94 && x > bW * 0.52 && x < bW * 0.96) {
      // Top garter band with ribbon bow
      if (y < bH * 0.575) {
        gothicBody.data[idx] = 16
        gothicBody.data[idx + 1] = 16
        gothicBody.data[idx + 2] = 20
      } else {
        // Semi-sheer dark stocking tone
        const curR = gothicBody.data[idx]
        const curG = gothicBody.data[idx + 1]
        const curB = gothicBody.data[idx + 2]
        gothicBody.data[idx] = Math.round(curR * 0.28 + 12)
        gothicBody.data[idx + 1] = Math.round(curG * 0.28 + 12)
        gothicBody.data[idx + 2] = Math.round(curB * 0.28 + 16)
      }
      continue
    }

    // 4. Arm Bands & Straps (wrist & forearm)
    if (y > bH * 0.78 && y < bH * 0.92 && (x < bW * 0.04 || x > bW * 0.96 || (x > bW * 0.32 && x < bW * 0.38))) {
      const isBand = (y % 40 < 12)
      if (isBand) {
        gothicBody.data[idx] = 18
        gothicBody.data[idx + 1] = 18
        gothicBody.data[idx + 2] = 22
      }
    }
  }
}
savePng(gothicBody, 'public/wardrobe/textures/gothic_body.png')

// 2d. Gothic Platform Shoes
const gothicShoes = loadPng('scratch/extracted_textures/img_13__12.png')
for (let i = 0; i < gothicShoes.data.length; i += 4) {
  if (gothicShoes.data[i + 3] === 0) continue
  gothicShoes.data[i] = 16
  gothicShoes.data[i + 1] = 16
  gothicShoes.data[i + 2] = 18
}
savePng(gothicShoes, 'public/wardrobe/textures/gothic_shoes.png')

// ─── 3. OUTFIT 1: DARK LACE OUTFIT ───────────────────────────────────────────
console.log('[BuildWardrobeTextures] Generating Dark Lace Outfit textures...')

// 3a. Lace Top (Dark lace sheer bra top with center bow & scalloped lace)
const laceTop = loadPng('scratch/extracted_textures/img_14__13.png')
for (let y = 0; y < topH; y++) {
  for (let x = 0; x < topW; x++) {
    const idx = (topW * y + x) << 2
    if (laceTop.data[idx + 3] === 0) continue

    const isLacePattern = (Math.sin(x * 0.12) * Math.cos(y * 0.12) > 0.1) || (Math.abs(x % 28 - 14) < 3)
    if (isLacePattern) {
      laceTop.data[idx] = 28
      laceTop.data[idx + 1] = 20
      laceTop.data[idx + 2] = 18
      laceTop.data[idx + 3] = 245
    } else {
      // Translucent sheer chiffon
      laceTop.data[idx] = 48
      laceTop.data[idx + 1] = 34
      laceTop.data[idx + 2] = 30
      laceTop.data[idx + 3] = 190
    }
  }
}
savePng(laceTop, 'public/wardrobe/textures/lace_top.png')

// 3b. Lace Bottom (Sheer smoky chiffon skirt with scalloped lace hem)
const laceBottom = loadPng('scratch/extracted_textures/img_15__14.png')
for (let y = 0; y < botH; y++) {
  for (let x = 0; x < botW; x++) {
    const idx = (botW * y + x) << 2
    if (laceBottom.data[idx + 3] === 0) continue

    // Scalloped lace hem border (bottom 18%)
    if (y > botH * 0.82) {
      const isHemLace = Math.sin(x * 0.18) > -0.3
      if (isHemLace) {
        laceBottom.data[idx] = 24
        laceBottom.data[idx + 1] = 18
        laceBottom.data[idx + 2] = 16
        laceBottom.data[idx + 3] = 255
      } else {
        laceBottom.data[idx + 3] = 0
      }
      continue
    }

    // Translucent smoky chiffon layer
    laceBottom.data[idx] = 45
    laceBottom.data[idx + 1] = 32
    laceBottom.data[idx + 2] = 28
    laceBottom.data[idx + 3] = 165
  }
}
savePng(laceBottom, 'public/wardrobe/textures/lace_bottom.png')

// 3c. Lace Body Skin (Clean Anime Base + Lace Bra + Choker + Opera Gloves + Fishnet Stockings)
const laceBody = loadPng('scratch/extracted_textures/fem_vroid_skin.png')

for (let y = 0; y < bH; y++) {
  for (let x = 0; x < bW; x++) {
    const idx = (bW * y + x) << 2

    // 1. Choker with lace scallops
    if (y > bH * 0.03 && y < bH * 0.105 && x > bW * 0.36 && x < bW * 0.64) {
      const isLace = Math.sin(x * 0.22) > -0.3
      if (isLace) {
        laceBody.data[idx] = 26
        laceBody.data[idx + 1] = 18
        laceBody.data[idx + 2] = 16
      }
      continue
    }

    // 2. Lace Bra Top on Upper Chest (y: 0.14 to 0.28, x: 0.36 to 0.64)
    if (y > bH * 0.135 && y < bH * 0.28 && x > bW * 0.35 && x < bW * 0.65) {
      const isBraArea = Math.sin((x - bW * 0.5) * 0.03) > -0.6
      if (isBraArea) {
        const isLaceFiligree = Math.sin(x * 0.15) * Math.sin(y * 0.15) > 0.05
        if (isLaceFiligree) {
          laceBody.data[idx] = 24
          laceBody.data[idx + 1] = 18
          laceBody.data[idx + 2] = 16
        } else {
          // Sheer cup
          laceBody.data[idx] = 55
          laceBody.data[idx + 1] = 40
          laceBody.data[idx + 2] = 36
        }
        continue
      }
    }

    // 3. Fishnet Stockings on Both Legs (y: 0.54 to 0.94)
    if (y > bH * 0.54 && y < bH * 0.94 && ((x > bW * 0.04 && x < bW * 0.48) || (x > bW * 0.52 && x < bW * 0.96))) {
      // Garter band
      if (y < bH * 0.58) {
        laceBody.data[idx] = 22
        laceBody.data[idx + 1] = 16
        laceBody.data[idx + 2] = 14
      } else {
        const isNet = Math.abs((x + y) % 18) < 2 || Math.abs((x - y) % 18) < 2
        if (isNet) {
          laceBody.data[idx] = 26
          laceBody.data[idx + 1] = 18
          laceBody.data[idx + 2] = 16
        }
      }
      continue
    }

    // 4. Opera Length Satin Gloves (forearms to hands)
    if (y > bH * 0.78 && y < bH * 0.96 && (x < bW * 0.15 || x > bW * 0.85)) {
      laceBody.data[idx] = 18
      laceBody.data[idx + 1] = 14
      laceBody.data[idx + 2] = 12
    }
  }
}
savePng(laceBody, 'public/wardrobe/textures/lace_body.png')

// 3d. Lace Shoes
const laceShoes = loadPng('scratch/extracted_textures/img_13__12.png')
for (let i = 0; i < laceShoes.data.length; i += 4) {
  if (laceShoes.data[i + 3] === 0) continue
  laceShoes.data[i] = 18
  laceShoes.data[i + 1] = 14
  laceShoes.data[i + 2] = 12
}
savePng(laceShoes, 'public/wardrobe/textures/lace_shoes.png')

console.log('[BuildWardrobeTextures] Complete! All high-fidelity wardrobe textures generated.')
