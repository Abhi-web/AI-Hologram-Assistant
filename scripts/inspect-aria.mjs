import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

console.log('--- GLTF Images ---')
gltf.images.forEach((img, i) => {
  const bv = gltf.bufferViews[img.bufferView]
  console.log('Image [' + i + '] name=' + img.name + ' mime=' + img.mimeType + ' bytes=' + bv?.byteLength)
})

console.log('\n--- GLTF Materials & Textures ---')
gltf.materials.forEach((m, i) => {
  const texIdx = m.pbrMetallicRoughness?.baseColorTexture?.index
  const tex = texIdx !== undefined ? gltf.textures[texIdx] : null
  const imgIdx = tex?.source
  const imgName = imgIdx !== undefined ? gltf.images[imgIdx]?.name : 'none'
  console.log('Material [' + i + '] ' + m.name + ' -> tex[' + texIdx + '] -> img[' + imgIdx + '] (' + imgName + ')')
})

console.log('\n--- GLTF VRM Extensions ---')
console.log('VRM extension keys:', Object.keys(gltf.extensions || {}))
if (gltf.extensions?.VRM) {
  console.log('VRM meta title:', gltf.extensions.VRM.meta?.title)
  console.log('VRM humanoid bones count:', gltf.extensions.VRM.humanoid?.humanBones?.length)
}
if (gltf.extensions?.VRMC_vrm) {
  console.log('VRMC_vrm meta:', gltf.extensions.VRMC_vrm.meta)
}
