import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

console.log('--- Humanoid Bones in VRMC_vrm ---')
const humanoid = gltf.extensions?.VRMC_vrm?.humanoid
if (humanoid) {
  Object.entries(humanoid.humanBones).forEach(([boneName, b]) => {
    const node = gltf.nodes[b.node]
    console.log(`VRM bone "${boneName}" -> Node [${b.node}] "${node.name}"`)
  })
}

console.log('\n--- Skins[1] (Body Skin) Joints ---')
const bodySkin = gltf.skins[1]
console.log('Joint count:', bodySkin.joints.length)
bodySkin.joints.slice(0, 30).forEach((jIdx, i) => {
  console.log(`Joint [${i}]: Node [${jIdx}] "${gltf.nodes[jIdx].name}"`)
})
