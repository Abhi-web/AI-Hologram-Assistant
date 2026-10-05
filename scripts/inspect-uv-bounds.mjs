import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

const binHeaderOffset = 20 + jsonLen
const binChunkLen = buf.readUInt32LE(binHeaderOffset)
const binBuffer = buf.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLen)

function readAccessor(accIdx) {
  const acc = gltf.accessors[accIdx]
  const bv = gltf.bufferViews[acc.bufferView]
  const offset = (bv.byteOffset || 0) + (acc.byteOffset || 0)
  const count = acc.count
  const type = acc.type
  const compType = acc.componentType // 5126 = float

  const itemSize = type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : type === 'SCALAR' ? 1 : 4
  const arr = new Float32Array(binBuffer.buffer, binBuffer.byteOffset + offset, count * itemSize)
  return arr
}

const bodyMesh = gltf.meshes[1]
console.log('--- Prim 2 (Tops) UV & Position bounds ---')
const topsPos = readAccessor(bodyMesh.primitives[2].attributes.POSITION)
const topsUv = readAccessor(bodyMesh.primitives[2].attributes.TEXCOORD_0)

let minY = Infinity, maxY = -Infinity
let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity

for (let i = 0; i < topsPos.length; i += 3) {
  const y = topsPos[i + 1]
  if (y < minY) minY = y
  if (y > maxY) maxY = y
}
for (let i = 0; i < topsUv.length; i += 2) {
  const u = topsUv[i]
  const v = topsUv[i + 1]
  if (u < minU) minU = u
  if (u > maxU) maxU = u
  if (v < minV) minV = v
  if (v > maxV) maxV = v
}
console.log('Tops Y range:', minY.toFixed(3), 'to', maxY.toFixed(3))
console.log('Tops U range:', minU.toFixed(3), 'to', maxU.toFixed(3))
console.log('Tops V range:', minV.toFixed(3), 'to', maxV.toFixed(3))

console.log('--- Prim 3 (Bottoms) UV & Position bounds ---')
const botPos = readAccessor(bodyMesh.primitives[3].attributes.POSITION)
const botUv = readAccessor(bodyMesh.primitives[3].attributes.TEXCOORD_0)

let bMinY = Infinity, bMaxY = -Infinity
for (let i = 0; i < botPos.length; i += 3) {
  const y = botPos[i + 1]
  if (y < bMinY) bMinY = y
  if (y > bMaxY) bMaxY = y
}
let bMinU = Infinity, bMaxU = -Infinity, bMinV = Infinity, bMaxV = -Infinity
for (let i = 0; i < botUv.length; i += 2) {
  const u = botUv[i]
  const v = botUv[i + 1]
  if (u < bMinU) bMinU = u
  if (u > bMaxU) bMaxU = u
  if (v < bMinV) bMinV = v
  if (v > bMaxV) bMaxV = v
}
console.log('Bottoms Y range:', bMinY.toFixed(3), 'to', bMaxY.toFixed(3))
console.log('Bottoms U range:', bMinU.toFixed(3), 'to', bMaxU.toFixed(3))
console.log('Bottoms V range:', bMinV.toFixed(3), 'to', bMaxV.toFixed(3))
