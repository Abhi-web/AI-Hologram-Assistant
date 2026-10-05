import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

console.log('--- GLTF Nodes with meshes ---')
gltf.nodes.forEach((n, i) => {
  if (n.mesh !== undefined) {
    console.log(`Node [${i}] "${n.name}" -> Mesh [${n.mesh}] "${gltf.meshes[n.mesh].name}"`)
  }
})

console.log('--- Mesh Primitives ---')
gltf.meshes.forEach((m, i) => {
  console.log(`Mesh [${i}] "${m.name}":`)
  m.primitives.forEach((p, pi) => {
    console.log(`  Primitive [${pi}]: material [${p.material}] "${gltf.materials[p.material]?.name}" mode=${p.mode || 4}`)
  })
})
