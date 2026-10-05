import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

const bodyMesh = gltf.meshes[1]
console.log('Body mesh name:', bodyMesh.name)
bodyMesh.primitives.forEach((p, idx) => {
  const mat = gltf.materials[p.material]
  const posAccessor = gltf.accessors[p.attributes.POSITION]
  const idxAccessor = p.indices !== undefined ? gltf.accessors[p.indices] : null
  console.log(`Primitive ${idx}: mat=${mat.name}`)
  console.log(`  Vertices: ${posAccessor.count}, Indices: ${idxAccessor ? idxAccessor.count : 'no index'}`)
  console.log(`  Attributes:`, Object.keys(p.attributes))
  console.log(`  Position bounds: min=[${posAccessor.min}], max=[${posAccessor.max}]`)
})
