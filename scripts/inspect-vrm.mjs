import https from 'https'

async function checkVRM(url, name) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { Range: 'bytes=0-250000' } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks)
          const jsonLen = buf.readUInt32LE(12)
          const jsonStr = buf.toString('utf8', 20, 20 + Math.min(jsonLen, buf.length - 20))
          const titleMatch = jsonStr.match(/"title"\s*:\s*"([^"]+)"/)
          const authorMatch = jsonStr.match(/"author"\s*:\s*"([^"]+)"/)
          const licenseMatch = jsonStr.match(/"licenseName"\s*:\s*"([^"]+)"/)
          const materials = [...jsonStr.matchAll(/"material":\s*(\d+)|"name":\s*"([^"]*(?:Hair|Face|Body|Eye|Cloth|Dress|Outfit|Skirt|Cyber|Head)[^"]*)"/gi)].map(m => m[2]).filter(Boolean)
          const meshes = [...jsonStr.matchAll(/"name":\s*"([^"]*Mesh[^"]*|Fcl_[^"]*|Hair[^"]*|Face[^"]*|Body[^"]*)"/gi)].map(m => m[1])
          console.log(name, {
            title: titleMatch ? titleMatch[1] : 'unknown',
            author: authorMatch ? authorMatch[1] : 'unknown',
            license: licenseMatch ? licenseMatch[1] : 'unknown',
            materials: materials.slice(0, 15),
            meshes: meshes.slice(0, 10),
          })
        } catch (e) {
          console.log(name, 'error', e.message)
        }
        resolve()
      })
    })
    req.on('error', (err) => {
      console.log(name, 'net error', err.message)
      resolve()
    })
  })
}

async function main() {
  await checkVRM('https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/fem_vroid.vrm', 'fem_vroid')
  await checkVRM('https://raw.githubusercontent.com/vrm-c/UniVRM/master/Tests/Models/Alicia_vrm-0.51/AliciaSolid_vrm-0.51.vrm', 'AliciaSolid')
}
main()
