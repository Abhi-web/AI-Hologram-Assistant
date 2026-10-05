import fs from 'fs'
import { PNG } from 'pngjs'

const body = PNG.sync.read(fs.readFileSync('scratch/extracted_textures/img_11__10.png'))
console.log('Body dimensions:', body.width, body.height)

// Find non-skin pixels in the upper torso area (y from 0 to 1200, x from 600 to 1400)
// Fair anime skin has R ~ 240-255, G ~ 200-230, B ~ 190-220
let printMinY = 2048, printMaxY = 0
for (let y = 0; y < 1400; y++) {
  for (let x = 600; x < 1500; x++) {
    const idx = (2048 * y + x) * 4
    const r = body.data[idx]
    const g = body.data[idx + 1]
    const b = body.data[idx + 2]
    // Check if dark or colorful (shirt / graphic)
    if (r < 180 || (r > 200 && g < 150)) {
      if (y < printMinY) printMinY = y
      if (y > printMaxY) printMaxY = y
    }
  }
}
console.log('Upper torso print/cloth Y range:', printMinY, 'to', printMaxY)
