import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Node.js polyfill for FileReader required by GLTFExporter binary mode
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer
        if (this.onloadend) this.onloadend()
      })
    }
  }
}

// Ensure output directory exists
const outputDir = path.resolve(__dirname, '../public/models')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}
const outputPath = path.join(outputDir, 'avatar.glb')

console.log('[AvatarGenerator] Building ARIA 3D Humanoid Avatar...')

// Create root scene
const root = new THREE.Group()
root.name = 'AriaAvatar'

// Materials matching ARIA futuristic aesthetic
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x141824,
  roughness: 0.35,
  metalness: 0.8,
  name: 'BodyArmorMaterial',
})

const cyanAccentMaterial = new THREE.MeshStandardMaterial({
  color: 0x00d4ff,
  emissive: 0x00d4ff,
  emissiveIntensity: 0.7,
  roughness: 0.2,
  metalness: 0.9,
  name: 'CyanGlowMaterial',
})

const purpleAccentMaterial = new THREE.MeshStandardMaterial({
  color: 0x7b2fff,
  emissive: 0x7b2fff,
  emissiveIntensity: 0.5,
  roughness: 0.3,
  metalness: 0.8,
  name: 'PurpleAccentMaterial',
})

const visorMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x00d4ff,
  emissiveIntensity: 0.4,
  roughness: 0.1,
  metalness: 0.95,
  transparent: true,
  opacity: 0.9,
  name: 'VisorMaterial',
})

const skinMaterial = new THREE.MeshStandardMaterial({
  color: 0x222a3d,
  roughness: 0.6,
  metalness: 0.2,
  name: 'SyntheticSkinMaterial',
})

// ─── Humanoid Skeleton / Hierarchy ──────────────────────────────────────────
// Total height ~1.75m. Centered so chest/head is at natural portrait level.
const skeletonRoot = new THREE.Group()
skeletonRoot.name = 'Pelvis'
skeletonRoot.position.set(0, 0.84, 0)
root.add(skeletonRoot)

// Pelvis & hips
const pelvisGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.16, 16)
const pelvisMesh = new THREE.Mesh(pelvisGeo, bodyMaterial)
pelvisMesh.name = 'PelvisMesh'
skeletonRoot.add(pelvisMesh)

// Belt / waist ring glow
const beltGeo = new THREE.TorusGeometry(0.17, 0.015, 8, 32)
beltGeo.rotateX(Math.PI / 2)
const beltMesh = new THREE.Mesh(beltGeo, cyanAccentMaterial)
beltMesh.position.set(0, 0.06, 0)
skeletonRoot.add(beltMesh)

// Spine / Torso group (child of pelvis)
const spine = new THREE.Group()
spine.name = 'Spine'
spine.position.set(0, 0.08, 0)
skeletonRoot.add(spine)

// Lower torso / abdomen
const abdomenGeo = new THREE.CylinderGeometry(0.16, 0.17, 0.18, 16)
const abdomenMesh = new THREE.Mesh(abdomenGeo, bodyMaterial)
abdomenMesh.position.set(0, 0.09, 0)
spine.add(abdomenMesh)

// Chest / upper torso group (will animate with breathing)
const chest = new THREE.Group()
chest.name = 'Chest'
chest.position.set(0, 0.18, 0)
spine.add(chest)

// Chest armor plate
const chestGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.24, 16)
const chestMesh = new THREE.Mesh(chestGeo, bodyMaterial)
chestMesh.position.set(0, 0.12, 0)
chest.add(chestMesh)

// ARIA Core Reactor / Emotive Emblem on chest
const coreRingGeo = new THREE.TorusGeometry(0.045, 0.008, 8, 24)
const coreRingMesh = new THREE.Mesh(coreRingGeo, cyanAccentMaterial)
coreRingMesh.position.set(0, 0.13, 0.18)
chest.add(coreRingMesh)

const coreInnerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16)
coreInnerGeo.rotateX(Math.PI / 2)
const coreInnerMesh = new THREE.Mesh(coreInnerGeo, purpleAccentMaterial)
coreInnerMesh.position.set(0, 0.13, 0.18)
chest.add(coreInnerMesh)

// Cybernetic collar
const collarGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.06, 16)
const collarMesh = new THREE.Mesh(collarGeo, purpleAccentMaterial)
collarMesh.position.set(0, 0.25, 0)
chest.add(collarMesh)

// Neck
const neck = new THREE.Group()
neck.name = 'Neck'
neck.position.set(0, 0.26, 0)
chest.add(neck)

const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 16), skinMaterial)
neckMesh.position.set(0, 0.05, 0)
neck.add(neckMesh)

// Head group
const head = new THREE.Group()
head.name = 'Head'
head.position.set(0, 0.1, 0)
neck.add(head)

// Cranium / face base
const craniumGeo = new THREE.SphereGeometry(0.13, 24, 24)
craniumGeo.scale(0.9, 1.15, 1.0)
const craniumMesh = new THREE.Mesh(craniumGeo, skinMaterial)
craniumMesh.position.set(0, 0.1, 0)
head.add(craniumMesh)

// Futuristic holographic visor (upper face)
const visorGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.065, 24, 1, false, -Math.PI / 3, (2 * Math.PI) / 3)
const visorMesh = new THREE.Mesh(visorGeo, visorMaterial)
visorMesh.position.set(0, 0.1, 0.01)
head.add(visorMesh)

// Visor cyan light strip
const visorStripGeo = new THREE.TorusGeometry(0.124, 0.005, 8, 24, Math.PI * 0.6)
visorStripGeo.rotateY(-Math.PI * 0.3)
visorStripGeo.rotateX(Math.PI / 2)
const visorStripMesh = new THREE.Mesh(visorStripGeo, cyanAccentMaterial)
visorStripMesh.position.set(0, 0.105, 0.01)
head.add(visorStripMesh)

// Sleek helmet / cyber hair shell
const helmetGeo = new THREE.SphereGeometry(0.135, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.6)
const helmetMesh = new THREE.Mesh(helmetGeo, bodyMaterial)
helmetMesh.position.set(0, 0.11, -0.01)
head.add(helmetMesh)

// Left & right audio / comm nodules on temples
const commGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12)
commGeo.rotateZ(Math.PI / 2)
const commL = new THREE.Mesh(commGeo, cyanAccentMaterial)
commL.position.set(0.12, 0.1, 0)
const commR = new THREE.Mesh(commGeo, cyanAccentMaterial)
commR.position.set(-0.12, 0.1, 0)
head.add(commL)
head.add(commR)

// ─── Shoulders & Arms ────────────────────────────────────────────────────────
// Left Arm
const shoulderL = new THREE.Group()
shoulderL.name = 'Shoulder_L'
shoulderL.position.set(0.24, 0.2, 0)
chest.add(shoulderL)

const pouldronGeo = new THREE.SphereGeometry(0.065, 12, 12)
const pouldronL = new THREE.Mesh(pouldronGeo, bodyMaterial)
shoulderL.add(pouldronL)

const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.24, 12)
upperArmGeo.translate(0, -0.12, 0)
const upperArmL = new THREE.Mesh(upperArmGeo, skinMaterial)
shoulderL.add(upperArmL)

const elbowL = new THREE.Group()
elbowL.name = 'Elbow_L'
elbowL.position.set(0, -0.24, 0)
shoulderL.add(elbowL)

const forearmGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.22, 12)
forearmGeo.translate(0, -0.11, 0)
const forearmL = new THREE.Mesh(forearmGeo, bodyMaterial)
elbowL.add(forearmL)

// Hand Left (relaxed neutral pose)
const handLGeo = new THREE.BoxGeometry(0.04, 0.09, 0.03)
handLGeo.translate(0, -0.045, 0)
const handL = new THREE.Mesh(handLGeo, skinMaterial)
handL.position.set(0, -0.22, 0)
elbowL.add(handL)

// Right Arm
const shoulderR = new THREE.Group()
shoulderR.name = 'Shoulder_R'
shoulderR.position.set(-0.24, 0.2, 0)
chest.add(shoulderR)

const pouldronR = new THREE.Mesh(pouldronGeo, bodyMaterial)
shoulderR.add(pouldronR)

const upperArmR = new THREE.Mesh(upperArmGeo, skinMaterial)
shoulderR.add(upperArmR)

const elbowR = new THREE.Group()
elbowR.name = 'Elbow_R'
elbowR.position.set(0, -0.24, 0)
shoulderR.add(elbowR)

const forearmR = new THREE.Mesh(forearmGeo, bodyMaterial)
elbowR.add(forearmR)

const handR = new THREE.Mesh(handLGeo, skinMaterial)
handR.position.set(0, -0.22, 0)
elbowR.add(handR)

// ─── Legs & Feet ─────────────────────────────────────────────────────────────
// Left Leg
const hipL = new THREE.Group()
hipL.name = 'Hip_L'
hipL.position.set(0.1, -0.08, 0)
skeletonRoot.add(hipL)

const thighGeo = new THREE.CylinderGeometry(0.075, 0.055, 0.38, 14)
thighGeo.translate(0, -0.19, 0)
const thighL = new THREE.Mesh(thighGeo, bodyMaterial)
hipL.add(thighL)

const kneeL = new THREE.Group()
kneeL.name = 'Knee_L'
kneeL.position.set(0, -0.38, 0)
hipL.add(kneeL)

const shinGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.36, 14)
shinGeo.translate(0, -0.18, 0)
const shinL = new THREE.Mesh(shinGeo, skinMaterial)
kneeL.add(shinL)

const footGeo = new THREE.BoxGeometry(0.08, 0.06, 0.18)
footGeo.translate(0, -0.03, 0.04)
const footL = new THREE.Mesh(footGeo, bodyMaterial)
footL.position.set(0, -0.36, 0)
kneeL.add(footL)

// Right Leg
const hipR = new THREE.Group()
hipR.name = 'Hip_R'
hipR.position.set(-0.1, -0.08, 0)
skeletonRoot.add(hipR)

const thighR = new THREE.Mesh(thighGeo, bodyMaterial)
hipR.add(thighR)

const kneeR = new THREE.Group()
kneeR.name = 'Knee_R'
kneeR.position.set(0, -0.38, 0)
hipR.add(kneeR)

const shinR = new THREE.Mesh(shinGeo, skinMaterial)
kneeR.add(shinR)

const footR = new THREE.Mesh(footGeo, bodyMaterial)
footR.position.set(0, -0.36, 0)
kneeR.add(footR)

// Neutral stance adjustments (hands resting slightly forward/inward naturally)
shoulderL.rotation.z = -0.08
shoulderR.rotation.z = 0.08
elbowL.rotation.x = 0.1
elbowR.rotation.x = 0.1

// ─── Native Idle Animation Track ─────────────────────────────────────────────
// Subtle 4-second breathing loop for chest and head
const times = [0, 2.0, 4.0]

// Chest breathing: subtle scale and translation
const chestPosValues = [
  0, 0.18, 0,
  0, 0.19, 0.005,
  0, 0.18, 0,
]
const chestPosTrack = new THREE.VectorKeyframeTrack('Chest.position', times, chestPosValues)

const chestScaleValues = [
  1.0, 1.0, 1.0,
  1.03, 1.02, 1.04,
  1.0, 1.0, 1.0,
]
const chestScaleTrack = new THREE.VectorKeyframeTrack('Chest.scale', times, chestScaleValues)

// Head subtle micro-movement
const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0))
const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0.015, -0.01))
const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0))
const headRotValues = [
  q0.x, q0.y, q0.z, q0.w,
  q1.x, q1.y, q1.z, q1.w,
  q2.x, q2.y, q2.z, q2.w,
]
const headRotTrack = new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headRotValues)

const idleClip = new THREE.AnimationClip('idle', 4.0, [chestPosTrack, chestScaleTrack, headRotTrack])

console.log('[AvatarGenerator] Exporting to GLB format with idle animation clip...')

const exporter = new GLTFExporter()
exporter.parse(
  root,
  (gltf) => {
    const buffer = Buffer.from(gltf)
    fs.writeFileSync(outputPath, buffer)
    console.log(`[AvatarGenerator] SUCCESS: Generated avatar GLB at ${outputPath} (${buffer.length} bytes)`)
  },
  (err) => {
    console.error('[AvatarGenerator] Export failed:', err)
    process.exit(1)
  },
  {
    binary: true,
    animations: [idleClip],
  }
)
