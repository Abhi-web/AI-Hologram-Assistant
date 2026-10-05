import fs from 'fs'

const buf = fs.readFileSync('public/models/aria-anime.vrm')
const jsonLen = buf.readUInt32LE(12)
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

const binHeaderOffset = 20 + jsonLen
const binChunkLen = buf.readUInt32LE(binHeaderOffset)
const binBuffer = buf.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binChunkLen)

// Map nodes
const humanoid = gltf.extensions?.VRMC_vrm?.humanoid?.humanBones || {}
console.log('--- Key Humanoid Bones Translations ---')
Object.entries(humanoid).forEach(([name, def]) => {
  const node = gltf.nodes[def.node]
  console.log(`${name.padEnd(20)}: node[${def.node}] "${node.name}" translation: [${node.translation || [0, 0, 0]}]`)
})
