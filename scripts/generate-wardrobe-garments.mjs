import fs from 'fs'
import path from 'path'
import * as THREE from 'three'

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf
        if (this.onloadend) this.onloadend()
      })
    }
  }
}

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// Bone definitions matching ARIA's exact skeleton
const BONE_NAMES = [
  'J_Bip_C_Hips',       // 0
  'J_Bip_C_Spine',      // 1
  'J_Bip_C_Chest',      // 2
  'J_Bip_C_UpperChest', // 3
  'J_Bip_C_Neck',       // 4
  'J_Bip_C_Head',       // 5
  'J_Bip_L_Shoulder',   // 6
  'J_Bip_L_UpperArm',   // 7
  'J_Bip_L_LowerArm',   // 8
  'J_Bip_R_Shoulder',   // 9
  'J_Bip_R_UpperArm',   // 10
  'J_Bip_R_LowerArm',   // 11
  'J_Bip_L_UpperLeg',   // 12
  'J_Bip_L_LowerLeg',   // 13
  'J_Bip_R_UpperLeg',   // 14
  'J_Bip_R_LowerLeg',   // 15
]

// World positions of bones for rigging reference
const BONE_POS = {
  Hips: new THREE.Vector3(0, 0.88, 0.004),
  Spine: new THREE.Vector3(0, 0.93, 0.009),
  Chest: new THREE.Vector3(0, 1.03, -0.003),
  UpperChest: new THREE.Vector3(0, 1.13, -0.004),
  Neck: new THREE.Vector3(0, 1.25, 0.002),
  Head: new THREE.Vector3(0, 1.32, 0.003),
  L_Shoulder: new THREE.Vector3(0.02, 1.23, 0.002),
  L_UpperArm: new THREE.Vector3(0.082, 1.23, 0.002),
  L_LowerArm: new THREE.Vector3(0.327, 1.23, 0.002),
  R_Shoulder: new THREE.Vector3(-0.02, 1.23, 0.002),
  R_UpperArm: new THREE.Vector3(-0.082, 1.23, 0.002),
  R_LowerArm: new THREE.Vector3(-0.327, 1.23, 0.002),
  L_UpperLeg: new THREE.Vector3(0.068, 0.84, 0.005),
  L_LowerLeg: new THREE.Vector3(0.068, 0.50, 0.005),
  R_UpperLeg: new THREE.Vector3(-0.068, 0.84, 0.005),
  R_LowerLeg: new THREE.Vector3(-0.068, 0.50, 0.005),
}

function createSkeleton() {
  const bones = []
  const boneMap = {}

  BONE_NAMES.forEach((name) => {
    const b = new THREE.Bone()
    b.name = name
    bones.push(b)
    boneMap[name] = b
  })

  // Set hierarchy and local transforms
  boneMap['J_Bip_C_Hips'].position.copy(BONE_POS.Hips)

  boneMap['J_Bip_C_Hips'].add(boneMap['J_Bip_C_Spine'])
  boneMap['J_Bip_C_Spine'].position.set(0, BONE_POS.Spine.y - BONE_POS.Hips.y, BONE_POS.Spine.z - BONE_POS.Hips.z)

  boneMap['J_Bip_C_Spine'].add(boneMap['J_Bip_C_Chest'])
  boneMap['J_Bip_C_Chest'].position.set(0, BONE_POS.Chest.y - BONE_POS.Spine.y, BONE_POS.Chest.z - BONE_POS.Spine.z)

  boneMap['J_Bip_C_Chest'].add(boneMap['J_Bip_C_UpperChest'])
  boneMap['J_Bip_C_UpperChest'].position.set(0, BONE_POS.UpperChest.y - BONE_POS.Chest.y, BONE_POS.UpperChest.z - BONE_POS.Chest.z)

  boneMap['J_Bip_C_UpperChest'].add(boneMap['J_Bip_C_Neck'])
  boneMap['J_Bip_C_Neck'].position.set(0, BONE_POS.Neck.y - BONE_POS.UpperChest.y, BONE_POS.Neck.z - BONE_POS.UpperChest.z)

  boneMap['J_Bip_C_Neck'].add(boneMap['J_Bip_C_Head'])
  boneMap['J_Bip_C_Head'].position.set(0, BONE_POS.Head.y - BONE_POS.Neck.y, BONE_POS.Head.z - BONE_POS.Neck.z)

  // Left Arm
  boneMap['J_Bip_C_UpperChest'].add(boneMap['J_Bip_L_Shoulder'])
  boneMap['J_Bip_L_Shoulder'].position.set(BONE_POS.L_Shoulder.x, BONE_POS.L_Shoulder.y - BONE_POS.UpperChest.y, BONE_POS.L_Shoulder.z)

  boneMap['J_Bip_L_Shoulder'].add(boneMap['J_Bip_L_UpperArm'])
  boneMap['J_Bip_L_UpperArm'].position.set(BONE_POS.L_UpperArm.x - BONE_POS.L_Shoulder.x, 0, 0)

  boneMap['J_Bip_L_UpperArm'].add(boneMap['J_Bip_L_LowerArm'])
  boneMap['J_Bip_L_LowerArm'].position.set(BONE_POS.L_LowerArm.x - BONE_POS.L_UpperArm.x, 0, 0)

  // Right Arm
  boneMap['J_Bip_C_UpperChest'].add(boneMap['J_Bip_R_Shoulder'])
  boneMap['J_Bip_R_Shoulder'].position.set(BONE_POS.R_Shoulder.x, BONE_POS.R_Shoulder.y - BONE_POS.UpperChest.y, BONE_POS.R_Shoulder.z)

  boneMap['J_Bip_R_Shoulder'].add(boneMap['J_Bip_R_UpperArm'])
  boneMap['J_Bip_R_UpperArm'].position.set(BONE_POS.R_UpperArm.x - BONE_POS.R_Shoulder.x, 0, 0)

  boneMap['J_Bip_R_UpperArm'].add(boneMap['J_Bip_R_LowerArm'])
  boneMap['J_Bip_R_LowerArm'].position.set(BONE_POS.R_LowerArm.x - BONE_POS.R_UpperArm.x, 0, 0)

  // Legs
  boneMap['J_Bip_C_Hips'].add(boneMap['J_Bip_L_UpperLeg'])
  boneMap['J_Bip_L_UpperLeg'].position.set(BONE_POS.L_UpperLeg.x, BONE_POS.L_UpperLeg.y - BONE_POS.Hips.y, BONE_POS.L_UpperLeg.z)

  boneMap['J_Bip_L_UpperLeg'].add(boneMap['J_Bip_L_LowerLeg'])
  boneMap['J_Bip_L_LowerLeg'].position.set(0, BONE_POS.L_LowerLeg.y - BONE_POS.L_UpperLeg.y, 0)

  boneMap['J_Bip_C_Hips'].add(boneMap['J_Bip_R_UpperLeg'])
  boneMap['J_Bip_R_UpperLeg'].position.set(BONE_POS.R_UpperLeg.x, BONE_POS.R_UpperLeg.y - BONE_POS.Hips.y, BONE_POS.R_UpperLeg.z)

  boneMap['J_Bip_R_UpperLeg'].add(boneMap['J_Bip_R_LowerLeg'])
  boneMap['J_Bip_R_LowerLeg'].position.set(0, BONE_POS.R_LowerLeg.y - BONE_POS.R_UpperLeg.y, 0)

  const skeleton = new THREE.Skeleton(bones)
  return { skeleton, rootBone: boneMap['J_Bip_C_Hips'], boneMap, bones }
}

// Compute skinning weights based on vertex position
function computeSkinWeights(geometry, boneMap, bones) {
  const pos = geometry.attributes.position
  const skinIndices = []
  const skinWeights = []

  const getBoneIndex = (name) => bones.findIndex((b) => b.name === name)
  const idxHips = getBoneIndex('J_Bip_C_Hips')
  const idxSpine = getBoneIndex('J_Bip_C_Spine')
  const idxChest = getBoneIndex('J_Bip_C_Chest')
  const idxUpperChest = getBoneIndex('J_Bip_C_UpperChest')
  const idxNeck = getBoneIndex('J_Bip_C_Neck')
  const idxLUpperArm = getBoneIndex('J_Bip_L_UpperArm')
  const idxRUpperArm = getBoneIndex('J_Bip_R_UpperArm')
  const idxLLowerArm = getBoneIndex('J_Bip_L_LowerArm')
  const idxRLowerArm = getBoneIndex('J_Bip_R_LowerArm')
  const idxLUpperLeg = getBoneIndex('J_Bip_L_UpperLeg')
  const idxRUpperLeg = getBoneIndex('J_Bip_R_UpperLeg')
  const idxLLowerLeg = getBoneIndex('J_Bip_L_LowerLeg')
  const idxRLowerLeg = getBoneIndex('J_Bip_R_LowerLeg')

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)

    let b1 = idxChest
    let w1 = 1.0
    let b2 = idxSpine
    let w2 = 0.0

    // Neck / Choker
    if (y > 1.22) {
      b1 = idxNeck
      w1 = 1.0
      b2 = idxUpperChest
      w2 = 0.0
    }
    // Arms / Sleeves
    else if (Math.abs(x) > 0.12 && y > 1.1) {
      if (x > 0) {
        if (Math.abs(x) > 0.22) {
          b1 = idxLLowerArm
          w1 = 0.8
          b2 = idxLUpperArm
          w2 = 0.2
        } else {
          b1 = idxLUpperArm
          w1 = 0.85
          b2 = idxUpperChest
          w2 = 0.15
        }
      } else {
        if (Math.abs(x) > 0.22) {
          b1 = idxRLowerArm
          w1 = 0.8
          b2 = idxRUpperArm
          w2 = 0.2
        } else {
          b1 = idxRUpperArm
          w1 = 0.85
          b2 = idxUpperChest
          w2 = 0.15
        }
      }
    }
    // Upper Chest / Bodice top
    else if (y > 1.08) {
      const t = (y - 1.08) / 0.14
      b1 = idxUpperChest
      w1 = t
      b2 = idxChest
      w2 = 1.0 - t
    }
    // Chest / Bust
    else if (y > 0.98) {
      const t = (y - 0.98) / 0.10
      b1 = idxChest
      w1 = t
      b2 = idxSpine
      w2 = 1.0 - t
    }
    // Spine / Waist
    else if (y > 0.88) {
      const t = (y - 0.88) / 0.10
      b1 = idxSpine
      w1 = t
      b2 = idxHips
      w2 = 1.0 - t
    }
    // Hips / Skirt / Thighs
    else if (y > 0.65) {
      if (Math.abs(x) > 0.04) {
        const legBone = x > 0 ? idxLUpperLeg : idxRUpperLeg
        const t = (y - 0.65) / 0.23
        b1 = idxHips
        w1 = t * 0.6 + 0.4
        b2 = legBone
        w2 = (1.0 - t) * 0.6
      } else {
        b1 = idxHips
        w1 = 0.9
        b2 = idxSpine
        w2 = 0.1
      }
    }
    // Lower Legs / Stockings
    else {
      const legBone = x > 0 ? idxLLowerLeg : idxRLowerLeg
      const upperLegBone = x > 0 ? idxLUpperLeg : idxRUpperLeg
      const t = Math.max(0, Math.min(1, (y - 0.3) / 0.35))
      b1 = legBone
      w1 = 1.0 - t
      b2 = upperLegBone
      w2 = t
    }

    // Normalize weights
    const total = w1 + w2 || 1.0
    w1 /= total
    w2 /= total

    skinIndices.push(b1, b2, 0, 0)
    skinWeights.push(w1, w2, 0, 0)
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4))
}

// ─── BUILD OUTFIT 2: BLACK GOTHIC DRESS ────────────────────────────────────────
function buildBlackGothicDress(skeletonData) {
  const group = new THREE.Group()
  group.name = 'AriaBlackGothicDress'

  const { skeleton, rootBone, boneMap, bones } = skeletonData

  // 1. Corset Bodice Geometry (lathe / cylinder around torso)
  // Torso runs from y=0.88 (waist) to y=1.17 (off-shoulder neckline)
  const bodiceGeom = new THREE.CylinderGeometry(0.165, 0.142, 0.28, 32, 12, true)
  bodiceGeom.translate(0, 1.02, -0.002)
  computeSkinWeights(bodiceGeom, boneMap, bones)

  const bodiceMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Corset_Fabric',
    color: 0x141416,
    roughness: 0.45,
    metalness: 0.15,
    side: THREE.DoubleSide,
  })
  const bodiceMesh = new THREE.SkinnedMesh(bodiceGeom, bodiceMat)
  bodiceMesh.name = 'Garment_CorsetBodice'
  bodiceMesh.bind(skeleton)
  group.add(bodiceMesh)

  // 2. Off-shoulder ruffled neckline trim
  const ruffGeom = new THREE.TorusGeometry(0.18, 0.022, 12, 32)
  ruffGeom.rotateX(Math.PI / 2)
  ruffGeom.translate(0, 1.16, -0.005)
  computeSkinWeights(ruffGeom, boneMap, bones)

  const ruffMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_NecklineRuffle',
    color: 0x1f1f24,
    roughness: 0.6,
    metalness: 0.1,
  })
  const ruffMesh = new THREE.SkinnedMesh(ruffGeom, ruffMat)
  ruffMesh.name = 'Garment_NecklineRuffle'
  ruffMesh.bind(skeleton)
  group.add(ruffMesh)

  // 3. Waist Belt with Gold Buckle
  const beltGeom = new THREE.CylinderGeometry(0.146, 0.146, 0.038, 32, 2, true)
  beltGeom.translate(0, 0.935, 0.002)
  computeSkinWeights(beltGeom, boneMap, bones)

  const beltMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Belt_Leather',
    color: 0x0c0c0e,
    roughness: 0.3,
    metalness: 0.3,
    side: THREE.DoubleSide,
  })
  const beltMesh = new THREE.SkinnedMesh(beltGeom, beltMat)
  beltMesh.name = 'Garment_WaistBelt'
  beltMesh.bind(skeleton)
  group.add(beltMesh)

  // Gold Buckle
  const buckleGeom = new THREE.BoxGeometry(0.045, 0.035, 0.015)
  buckleGeom.translate(0, 0.935, 0.152)
  computeSkinWeights(buckleGeom, boneMap, bones)
  const buckleMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Buckle_Gold',
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
  })
  const buckleMesh = new THREE.SkinnedMesh(buckleGeom, buckleMat)
  buckleMesh.name = 'Garment_GoldBuckle'
  buckleMesh.bind(skeleton)
  group.add(buckleMesh)

  // 4. Layered Asymmetrical Flared Gothic Skirt
  // Outer layer
  const skirtGeom = new THREE.CylinderGeometry(0.145, 0.34, 0.32, 32, 16, true)
  // Make hem asymmetrical by modulating vertex Y based on angle
  const pos = skirtGeom.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i)
    const px = pos.getX(i)
    const pz = pos.getZ(i)
    if (py < 0) {
      // Bottom vertices: add gothic handkerchief / petal peaks
      const angle = Math.atan2(pz, px)
      const scallop = Math.sin(angle * 6) * 0.04 - (px > 0 ? 0.05 : 0)
      pos.setY(i, py + scallop)
    }
  }
  skirtGeom.computeVertexNormals()
  skirtGeom.translate(0, 0.77, 0.005)
  computeSkinWeights(skirtGeom, boneMap, bones)

  const skirtMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Skirt_Fabric',
    color: 0x111114,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide,
  })
  const skirtMesh = new THREE.SkinnedMesh(skirtGeom, skirtMat)
  skirtMesh.name = 'Garment_LayeredSkirt'
  skirtMesh.bind(skeleton)
  group.add(skirtMesh)

  // Inner skirt layer
  const innerSkirtGeom = new THREE.CylinderGeometry(0.143, 0.28, 0.24, 28, 8, true)
  innerSkirtGeom.translate(0, 0.80, 0.005)
  computeSkinWeights(innerSkirtGeom, boneMap, bones)
  const innerSkirtMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_InnerSkirt',
    color: 0x1a1a1f,
    roughness: 0.6,
    side: THREE.DoubleSide,
  })
  const innerSkirtMesh = new THREE.SkinnedMesh(innerSkirtGeom, innerSkirtMat)
  innerSkirtMesh.name = 'Garment_InnerSkirt'
  innerSkirtMesh.bind(skeleton)
  group.add(innerSkirtMesh)

  // 5. Puff Sleeves (Left & Right)
  const createPuffSleeve = (isLeft) => {
    const sign = isLeft ? 1 : -1
    const sleeveGeom = new THREE.SphereGeometry(0.065, 16, 16)
    sleeveGeom.scale(0.85, 1.2, 0.85)
    sleeveGeom.translate(sign * 0.15, 1.14, 0.005)
    computeSkinWeights(sleeveGeom, boneMap, bones)

    const sleeveMat = new THREE.MeshStandardMaterial({
      name: 'Gothic_PuffSleeve',
      color: 0x161619,
      roughness: 0.5,
      metalness: 0.1,
    })
    const sleeveMesh = new THREE.SkinnedMesh(sleeveGeom, sleeveMat)
    sleeveMesh.name = isLeft ? 'Garment_PuffSleeve_L' : 'Garment_PuffSleeve_R'
    sleeveMesh.bind(skeleton)
    return sleeveMesh
  }
  group.add(createPuffSleeve(true))
  group.add(createPuffSleeve(false))

  // 6. Gothic Choker with Scalloped Lace
  const chokerGeom = new THREE.CylinderGeometry(0.062, 0.065, 0.045, 32, 4, true)
  chokerGeom.translate(0, 1.255, 0.002)
  computeSkinWeights(chokerGeom, boneMap, bones)

  const chokerMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Choker_Lace',
    color: 0x111113,
    roughness: 0.4,
    metalness: 0.2,
    side: THREE.DoubleSide,
  })
  const chokerMesh = new THREE.SkinnedMesh(chokerGeom, chokerMat)
  chokerMesh.name = 'Garment_GothicChoker'
  chokerMesh.bind(skeleton)
  group.add(chokerMesh)

  // 7. Back Bow & Ribbons
  const bowGeom = new THREE.BoxGeometry(0.12, 0.06, 0.02)
  bowGeom.translate(0, 0.93, -0.15)
  computeSkinWeights(bowGeom, boneMap, bones)
  const bowMat = new THREE.MeshStandardMaterial({
    name: 'Gothic_Ribbon_Bow',
    color: 0x18181c,
    roughness: 0.35,
  })
  const bowMesh = new THREE.SkinnedMesh(bowGeom, bowMat)
  bowMesh.name = 'Garment_BackBow'
  bowMesh.bind(skeleton)
  group.add(bowMesh)

  // 8. Stockings (Left fishnet, Right sheer/ribbon)
  const createStocking = (isLeft) => {
    const sign = isLeft ? 1 : -1
    const legGeom = new THREE.CylinderGeometry(0.076, 0.052, 0.42, 24, 12, true)
    legGeom.translate(sign * 0.068, 0.65, 0.005)
    computeSkinWeights(legGeom, boneMap, bones)

    const legMat = new THREE.MeshStandardMaterial({
      name: isLeft ? 'Gothic_Stocking_Fishnet' : 'Gothic_Stocking_Sheer',
      color: isLeft ? 0x222228 : 0x18181d,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
    const legMesh = new THREE.SkinnedMesh(legGeom, legMat)
    legMesh.name = isLeft ? 'Garment_Stocking_L' : 'Garment_Stocking_R'
    legMesh.bind(skeleton)
    return legMesh
  }
  group.add(createStocking(true))
  group.add(createStocking(false))

  return group
}

// ─── BUILD OUTFIT 1: DARK LACE OUTFIT ─────────────────────────────────────────
function buildDarkLaceOutfit(skeletonData) {
  const group = new THREE.Group()
  group.name = 'AriaDarkLaceOutfit'

  const { skeleton, rootBone, boneMap, bones } = skeletonData

  // 1. Dark Lace Bra Top with Cutout
  const braGeom = new THREE.CylinderGeometry(0.162, 0.148, 0.14, 32, 8, true)
  braGeom.translate(0, 1.08, -0.002)
  computeSkinWeights(braGeom, boneMap, bones)

  const braMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_Bra_Fabric',
    color: 0x1f1816, // subtle dark lace brown-black tone
    roughness: 0.4,
    metalness: 0.1,
    side: THREE.DoubleSide,
  })
  const braMesh = new THREE.SkinnedMesh(braGeom, braMat)
  braMesh.name = 'Garment_LaceBraTop'
  braMesh.bind(skeleton)
  group.add(braMesh)

  // Bra center bow
  const bowGeom = new THREE.BoxGeometry(0.04, 0.025, 0.015)
  bowGeom.translate(0, 1.06, 0.165)
  computeSkinWeights(bowGeom, boneMap, bones)
  const bowMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_FrontBow',
    color: 0x14100e,
    roughness: 0.35,
  })
  const bowMesh = new THREE.SkinnedMesh(bowGeom, bowMat)
  bowMesh.name = 'Garment_BraFrontBow'
  bowMesh.bind(skeleton)
  group.add(bowMesh)

  // 2. Sheer Smoky Outer Dress / Skirt Layer
  // Flaring gracefully from underbust (y=1.0) down over hips (y=0.68)
  const sheerGeom = new THREE.CylinderGeometry(0.148, 0.33, 0.34, 32, 16, true)
  // Subtle scallop flutter at the hem
  const sPos = sheerGeom.attributes.position
  for (let i = 0; i < sPos.count; i++) {
    const py = sPos.getY(i)
    if (py < 0) {
      const px = sPos.getX(i)
      const pz = sPos.getZ(i)
      const angle = Math.atan2(pz, px)
      sPos.setY(i, py + Math.sin(angle * 8) * 0.025)
    }
  }
  sheerGeom.computeVertexNormals()
  sheerGeom.translate(0, 0.83, 0.005)
  computeSkinWeights(sheerGeom, boneMap, bones)

  const sheerMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_SheerChiffon',
    color: 0x3d2b27, // translucent dark lace/burgundy brown
    roughness: 0.3,
    metalness: 0.05,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const sheerMesh = new THREE.SkinnedMesh(sheerGeom, sheerMat)
  sheerMesh.name = 'Garment_SheerDressLayer'
  sheerMesh.bind(skeleton)
  group.add(sheerMesh)

  // 3. Lace Hem Border on Sheer Skirt
  const hemGeom = new THREE.TorusGeometry(0.33, 0.012, 8, 32)
  hemGeom.rotateX(Math.PI / 2)
  hemGeom.translate(0, 0.66, 0.005)
  computeSkinWeights(hemGeom, boneMap, bones)

  const hemMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_SkirtHemLace',
    color: 0x18110f,
    roughness: 0.5,
    side: THREE.DoubleSide,
  })
  const hemMesh = new THREE.SkinnedMesh(hemGeom, hemMat)
  hemMesh.name = 'Garment_SkirtHemLace'
  hemMesh.bind(skeleton)
  group.add(hemMesh)

  // 4. Intricate Lace Choker
  const chokerGeom = new THREE.CylinderGeometry(0.062, 0.065, 0.05, 32, 4, true)
  chokerGeom.translate(0, 1.255, 0.002)
  computeSkinWeights(chokerGeom, boneMap, bones)

  const chokerMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_NeckChoker',
    color: 0x161211,
    roughness: 0.45,
    side: THREE.DoubleSide,
  })
  const chokerMesh = new THREE.SkinnedMesh(chokerGeom, chokerMat)
  chokerMesh.name = 'Garment_DarkLaceChoker'
  chokerMesh.bind(skeleton)
  group.add(chokerMesh)

  // 5. Lace Arm Bands with Ribbon Bows (Left & Right)
  const createArmBand = (isLeft) => {
    const sign = isLeft ? 1 : -1
    const bandGeom = new THREE.CylinderGeometry(0.055, 0.052, 0.045, 20, 2, true)
    bandGeom.translate(sign * 0.13, 1.15, 0.005)
    computeSkinWeights(bandGeom, boneMap, bones)

    const bandMat = new THREE.MeshStandardMaterial({
      name: 'DarkLace_ArmBand',
      color: 0x1a1412,
      roughness: 0.4,
      side: THREE.DoubleSide,
    })
    const bandMesh = new THREE.SkinnedMesh(bandGeom, bandMat)
    bandMesh.name = isLeft ? 'Garment_ArmBand_L' : 'Garment_ArmBand_R'
    bandMesh.bind(skeleton)
    return bandMesh
  }
  group.add(createArmBand(true))
  group.add(createArmBand(false))

  // 6. Sleek Opera Gloves (Lower Arms)
  const createGlove = (isLeft) => {
    const sign = isLeft ? 1 : -1
    const gloveGeom = new THREE.CylinderGeometry(0.042, 0.038, 0.22, 16, 8, true)
    gloveGeom.rotateZ((sign * Math.PI) / 2)
    gloveGeom.translate(sign * 0.24, 1.23, 0.002)
    computeSkinWeights(gloveGeom, boneMap, bones)

    const gloveMat = new THREE.MeshStandardMaterial({
      name: 'DarkLace_Gloves',
      color: 0x110f0e,
      roughness: 0.25,
      metalness: 0.2,
      side: THREE.DoubleSide,
    })
    const gloveMesh = new THREE.SkinnedMesh(gloveGeom, gloveMat)
    gloveMesh.name = isLeft ? 'Garment_Glove_L' : 'Garment_Glove_R'
    gloveMesh.bind(skeleton)
    return gloveMesh
  }
  group.add(createGlove(true))
  group.add(createGlove(false))

  // 7. Thigh-High Stockings & Garter Straps
  const createLaceStocking = (isLeft) => {
    const sign = isLeft ? 1 : -1
    const stockingGeom = new THREE.CylinderGeometry(0.076, 0.052, 0.45, 24, 12, true)
    stockingGeom.translate(sign * 0.068, 0.62, 0.005)
    computeSkinWeights(stockingGeom, boneMap, bones)

    const stockingMat = new THREE.MeshStandardMaterial({
      name: 'DarkLace_Stocking_Fishnet',
      color: 0x221a18,
      roughness: 0.65,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    })
    const stockingMesh = new THREE.SkinnedMesh(stockingGeom, stockingMat)
    stockingMesh.name = isLeft ? 'Garment_LaceStocking_L' : 'Garment_LaceStocking_R'
    stockingMesh.bind(skeleton)
    return stockingMesh
  }
  group.add(createLaceStocking(true))
  group.add(createLaceStocking(false))

  // Garter Straps
  const garterGeom = new THREE.BoxGeometry(0.015, 0.12, 0.005)
  garterGeom.translate(0.068, 0.82, 0.078)
  computeSkinWeights(garterGeom, boneMap, bones)
  const garterMat = new THREE.MeshStandardMaterial({
    name: 'DarkLace_GarterStraps',
    color: 0x120e0d,
    roughness: 0.4,
  })
  const garterMesh = new THREE.SkinnedMesh(garterGeom, garterMat)
  garterMesh.name = 'Garment_GarterStraps'
  garterMesh.bind(skeleton)
  group.add(garterMesh)

  return group
}

async function exportGlb(rootObject, outputPath) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      rootObject,
      (result) => {
        try {
          const buf = Buffer.from(result)
          fs.writeFileSync(outputPath, buf)
          console.log(`[GLTFExporter] Successfully generated ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`)
          resolve()
        } catch (e) {
          reject(e)
        }
      },
      (error) => {
        reject(error)
      },
      { binary: true, embedImages: true }
    )
  })
}

async function main() {
  console.log('[GenerateWardrobeGarments] Initializing ARIA skeleton hierarchy...')
  const skeletonData1 = createSkeleton()
  const skeletonData2 = createSkeleton()

  // Build Black Gothic Dress
  console.log('[GenerateWardrobeGarments] Building Black Gothic Dress (Outfit 2)...')
  const gothicDressGroup = buildBlackGothicDress(skeletonData1)
  const gothicDressScene = new THREE.Scene()
  gothicDressScene.add(skeletonData1.rootBone)
  gothicDressScene.add(gothicDressGroup)

  const gothicPath = path.resolve('public/wardrobe/models/aria-black-gothic-dress.glb')
  await exportGlb(gothicDressScene, gothicPath)

  // Build Dark Lace Outfit
  console.log('[GenerateWardrobeGarments] Building Dark Lace Outfit (Outfit 1)...')
  const laceOutfitGroup = buildDarkLaceOutfit(skeletonData2)
  const laceOutfitScene = new THREE.Scene()
  laceOutfitScene.add(skeletonData2.rootBone)
  laceOutfitScene.add(laceOutfitGroup)

  const lacePath = path.resolve('public/wardrobe/models/aria-dark-lace-outfit.glb')
  await exportGlb(laceOutfitScene, lacePath)

  console.log('[GenerateWardrobeGarments] Both 3D garments successfully built and exported!')
}

main().catch(console.error)
