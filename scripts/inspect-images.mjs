import fs from 'fs'

const buf = fs.readFileSync('scratch/AvatarSample_B.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))
console.log('Images count:', gltf.images?.length)
gltf.images?.forEach((img, i) => {
  console.log('Image [' + i + ']: name=' + img.name + ', mime=' + img.mimeType + ', bufferView=' + img.bufferView)
})

console.log('\nMaterials referencing images:')
gltf.materials?.forEach((mat, i) => {
  const pbr = mat.pbrMetallicRoughness
  console.log(
    'Mat [' +
      i +
      '] ' +
      mat.name +
      ': baseColorTexture=' +
      (pbr?.baseColorTexture ? gltf.textures[pbr.baseColorTexture.index]?.source : 'none')
  )
})
