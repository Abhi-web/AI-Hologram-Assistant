import fs from 'fs'

const buf = fs.readFileSync('scratch/AvatarSample_B.vrm')
const magic = buf.toString('utf8', 0, 4)
const version = buf.readUInt32LE(4)
const length = buf.readUInt32LE(8)
const chunkLen = buf.readUInt32LE(12)
const chunkType = buf.toString('utf8', 16, 20)
const jsonStr = buf.toString('utf8', 20, 20 + chunkLen)
const gltf = JSON.parse(jsonStr)

console.log('--- GLTF / VRM BASIC INFO ---')
console.log('Magic:', magic, 'Version:', version, 'Total length:', (length / 1024 / 1024).toFixed(2), 'MB')
console.log('VRM Meta:', gltf.extensions?.VRM?.meta)
console.log('\n--- HUMAN BONES (VRM) ---')
console.log(gltf.extensions?.VRM?.humanoid?.humanBones?.map((b) => ({ bone: b.bone, node: gltf.nodes[b.node]?.name })))

console.log('\n--- BLENDSHAPE GROUPS DETAILS ---')
gltf.extensions?.VRM?.blendShapeMaster?.blendShapeGroups?.forEach((g) => {
  console.log(`Group "${g.name}" (preset: ${g.presetName}):`, g.binds)
})

console.log('\n--- ALL MORPH TARGET NAMES ---')
const faceMesh = gltf.meshes[0]
console.log('Target Names in extras:', faceMesh.extras?.targetNames || 'No extras.targetNames, using VRM blendShapeMaster')

console.log('\n--- MESHES & MORPH TARGETS ---')
gltf.meshes.forEach((m, idx) => {
  console.log(`Mesh [${idx}] ${m.name}:`)
  m.primitives.forEach((p, pIdx) => {
    console.log(`  Primitive [${pIdx}]: targets count = ${p.targets?.length || 0}`)
  })
  if (m.extras?.targetNames) {
    console.log(`  Target Names:`, m.extras.targetNames)
  }
})

console.log('\n--- MATERIALS ---')
gltf.materials.forEach((mat, idx) => {
  console.log(`Material [${idx}] ${mat.name}: pbr =`, mat.pbrMetallicRoughness)
})
