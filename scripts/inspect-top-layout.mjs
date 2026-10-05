import fs from 'fs'
import { PNG } from 'pngjs'

const top = PNG.sync.read(fs.readFileSync('scratch/extracted_textures/img_14__13.png'))
console.log('Top dimensions:', top.width, top.height)

// Find bounding boxes of opaque regions in img_14__13.png
let minX = top.width, maxX = 0, minY = top.height, maxY = 0
for (let y = 0; y < top.height; y++) {
  for (let x = 0; x < top.width; x++) {
    const a = top.data[(top.width * y + x) * 4 + 3]
    if (a > 20) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
}
console.log('Opaque bounding box: X [', minX, maxX, '] Y [', minY, maxY, ']')

// Sample sections: y=100 (top shoulders), y=1000 (mid torso), y=1800 (waist hem)
console.log('Row 100 opaque count:', countOpaqueInRow(top, 100))
console.log('Row 500 opaque count:', countOpaqueInRow(top, 500))
console.log('Row 1000 opaque count:', countOpaqueInRow(top, 1000))
console.log('Row 1500 opaque count:', countOpaqueInRow(top, 1500))

function countOpaqueInRow(png, y) {
  let count = 0
  for (let x = 0; x < png.width; x++) {
    if (png.data[(png.width * y + x) * 4 + 3] > 20) count++
  }
  return count
}
