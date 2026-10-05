import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { ModelFacialCapabilities, SpeechActivity } from './LipSyncTypes'

const COMMON_MOUTH_TARGETS = [
  'Fcl_MTH_A',
  'Fcl_MTH_I',
  'Fcl_MTH_U',
  'Fcl_MTH_E',
  'Fcl_MTH_O',
  'Fcl_MTH_Large',
  'Fcl_MTH_Small',
  'Fcl_MTH_Joy',
  'Fcl_MTH_Close',
  'jawOpen',
  'mouthOpen',
  'mouthSmile',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'viseme_aa',
  'viseme_E',
  'viseme_I',
  'viseme_O',
  'viseme_U',
  'viseme_PP',
  'viseme_FF',
  'viseme_TH',
  'viseme_DD',
  'viseme_kk',
  'viseme_CH',
  'viseme_SS',
  'viseme_nn',
  'viseme_RR',
  'viseme_sil',
]

export class LipSyncAnimationController {
  private rootObject: THREE.Object3D
  private vrm: VRM | null = null
  private capabilities: ModelFacialCapabilities

  private morphMeshes: Array<{
    mesh: THREE.Mesh
    dict: { [key: string]: number }
    targets: { [key: string]: number }
  }> = []

  private jawBone: THREE.Bone | THREE.Object3D | null = null
  private initialJawRotationX = 0

  private headNode: THREE.Object3D | null = null
  private visorMaterials: THREE.MeshStandardMaterial[] = []
  private initialHeadRotX = 0

  constructor(root: THREE.Object3D, vrm?: VRM | null) {
    this.rootObject = root
    this.vrm = vrm || null
    this.capabilities = this.inspectModel()
  }

  public setVRM(vrm: VRM | null) {
    this.vrm = vrm
    this.capabilities = this.inspectModel()
  }

  private inspectModel(): ModelFacialCapabilities {
    const discoveredMorphs: string[] = []
    let foundJaw: THREE.Bone | THREE.Object3D | null = null
    this.morphMeshes = []

    const hasVrmExpressions = Boolean(
      this.vrm?.expressionManager &&
        (this.vrm.expressionManager.expressionMap['aa'] ||
          this.vrm.expressionManager.expressionMap['ih'] ||
          this.vrm.expressionManager.expressionMap['oh'])
    )

    this.rootObject.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          const dict = mesh.morphTargetDictionary
          const matchedTargets: { [key: string]: number } = {}

          for (const target of COMMON_MOUTH_TARGETS) {
            const key = Object.keys(dict).find((k) => k.toLowerCase() === target.toLowerCase())
            if (key !== undefined) {
              matchedTargets[target] = dict[key]
              if (!discoveredMorphs.includes(key)) {
                discoveredMorphs.push(key)
              }
            }
          }

          if (Object.keys(matchedTargets).length > 0) {
            this.morphMeshes.push({ mesh, dict, targets: matchedTargets })
          }
        }

        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial && (m.name.includes('Cyan') || m.name.includes('Visor'))) {
              if (!this.visorMaterials.includes(m)) {
                this.visorMaterials.push(m)
              }
            }
          })
        }
      }

      const lowerName = child.name.toLowerCase()
      if (!foundJaw && (lowerName.includes('jaw') || lowerName.includes('chin') || lowerName === 'bone_jaw')) {
        foundJaw = child
      }

      if (!this.headNode && lowerName.includes('head')) {
        this.headNode = child
        this.initialHeadRotX = child.rotation.x
      }
    })

    if (foundJaw) {
      const jawObj = foundJaw as THREE.Object3D
      this.jawBone = jawObj
      this.initialJawRotationX = jawObj.rotation.x
    }

    let mode: 'morph-target' | 'jaw-bone' | 'cadence-fallback' = 'cadence-fallback'
    let diagnostics = ''

    if (hasVrmExpressions || discoveredMorphs.length > 0) {
      mode = 'morph-target'
      const names = hasVrmExpressions ? ['VRM:aa', 'VRM:ih', 'VRM:ou', 'VRM:ee', 'VRM:oh', ...discoveredMorphs] : discoveredMorphs
      diagnostics = `Found ${names.length} mouth morph targets/visemes: ${names.slice(0, 8).join(', ')}`
    } else if (this.jawBone) {
      mode = 'jaw-bone'
      diagnostics = `Found jaw bone: "${this.jawBone.name}". Morph targets: 0.`
    } else {
      mode = 'cadence-fallback'
      diagnostics = 'Model running in speech-cadence fallback mode.'
    }

    return {
      hasMorphTargets: hasVrmExpressions || discoveredMorphs.length > 0,
      hasJawBone: !!this.jawBone,
      morphTargetNames: discoveredMorphs,
      jawBoneName: this.jawBone?.name || null,
      mode,
      diagnostics,
    }
  }

  public getCapabilities(): ModelFacialCapabilities {
    return this.capabilities
  }

  public update(speech: SpeechActivity, _delta: number): void {
    if (this.capabilities.mode === 'morph-target') {
      this.applyMorphTargets(speech)
    } else if (this.capabilities.mode === 'jaw-bone') {
      this.applyJawBone(speech)
    } else {
      this.applyCadenceFallback(speech)
    }
  }

  private applyMorphTargets(speech: SpeechActivity): void {
    const amp = speech.amplitude
    const mouthOpen = amp

    if (this.vrm?.expressionManager) {
      const em = this.vrm.expressionManager
      const aa = (speech.visemeWeights['aa'] ?? mouthOpen) * amp * 0.85
      const ih = (speech.visemeWeights['ih'] ?? mouthOpen * 0.4) * amp
      const ou = (speech.visemeWeights['ou'] ?? mouthOpen * 0.3) * amp
      const ee = (speech.visemeWeights['ee'] ?? mouthOpen * 0.5) * amp
      const oh = (speech.visemeWeights['oh'] ?? mouthOpen * 0.6) * amp

      em.setValue('aa', Math.min(1.0, aa))
      em.setValue('ih', Math.min(1.0, ih))
      em.setValue('ou', Math.min(1.0, ou))
      em.setValue('ee', Math.min(1.0, ee))
      em.setValue('oh', Math.min(1.0, oh))
    }

    for (const item of this.morphMeshes) {
      const influences = item.mesh.morphTargetInfluences
      if (!influences) continue

      const fclA = item.targets['Fcl_MTH_A']
      const fclI = item.targets['Fcl_MTH_I']
      const fclU = item.targets['Fcl_MTH_U']
      const fclE = item.targets['Fcl_MTH_E']
      const fclO = item.targets['Fcl_MTH_O']

      if (fclA !== undefined) influences[fclA] = (speech.visemeWeights['aa'] ?? mouthOpen) * amp * 0.85
      if (fclI !== undefined) influences[fclI] = (speech.visemeWeights['ih'] ?? mouthOpen * 0.35) * amp
      if (fclU !== undefined) influences[fclU] = (speech.visemeWeights['ou'] ?? mouthOpen * 0.3) * amp
      if (fclE !== undefined) influences[fclE] = (speech.visemeWeights['ee'] ?? mouthOpen * 0.45) * amp
      if (fclO !== undefined) influences[fclO] = (speech.visemeWeights['oh'] ?? mouthOpen * 0.55) * amp

      const jawIndex = item.targets['jawOpen'] ?? item.targets['mouthOpen'] ?? item.targets['Fcl_MTH_Large']
      if (jawIndex !== undefined) {
        influences[jawIndex] = mouthOpen * amp * 0.8
      }
    }
  }

  private applyJawBone(speech: SpeechActivity): void {
    if (!this.jawBone) return
    const maxJawPitch = 0.18
    this.jawBone.rotation.x = this.initialJawRotationX + speech.amplitude * maxJawPitch
  }

  private applyCadenceFallback(speech: SpeechActivity): void {
    const amp = speech.amplitude
    if (this.headNode) {
      const speechPitch = Math.sin(speech.elapsedTime * 8) * 0.02 * amp
      this.headNode.rotation.x = this.initialHeadRotX + speechPitch + amp * 0.025
    }

    if (this.visorMaterials.length > 0) {
      const baseIntensity = 0.5
      const activeIntensity = baseIntensity + amp * 0.6
      for (const mat of this.visorMaterials) {
        mat.emissiveIntensity = activeIntensity
      }
    }
  }

  /**
   * Smoothly decays viseme and mouth weights to zero when speech ends.
   */
  public decay(delta: number): void {
    if (this.vrm?.expressionManager) {
      for (const v of ['aa', 'ih', 'ou', 'ee', 'oh']) {
        const val = this.vrm.expressionManager.getValue(v) || 0
        if (val > 0.005) {
          this.vrm.expressionManager.setValue(v, Math.max(0, val - delta * 10.0))
        } else if (val > 0) {
          this.vrm.expressionManager.setValue(v, 0)
        }
      }
    }

    if (this.jawBone) {
      this.jawBone.rotation.x += (this.initialJawRotationX - this.jawBone.rotation.x) * Math.min(1.0, delta * 8.0)
    }
  }

  public reset(): void {
    if (this.vrm?.expressionManager) {
      this.vrm.expressionManager.setValue('aa', 0)
      this.vrm.expressionManager.setValue('ih', 0)
      this.vrm.expressionManager.setValue('ou', 0)
      this.vrm.expressionManager.setValue('ee', 0)
      this.vrm.expressionManager.setValue('oh', 0)
    }

    for (const item of this.morphMeshes) {
      if (item.mesh.morphTargetInfluences) {
        for (let i = 0; i < item.mesh.morphTargetInfluences.length; i++) {
          item.mesh.morphTargetInfluences[i] = 0
        }
      }
    }

    if (this.jawBone) {
      this.jawBone.rotation.x = this.initialJawRotationX
    }

    if (this.headNode) {
      this.headNode.rotation.x = this.initialHeadRotX
    }

    for (const mat of this.visorMaterials) {
      mat.emissiveIntensity = 0.5
    }
  }

  public dispose(): void {
    this.reset()
    this.morphMeshes = []
    this.jawBone = null
    this.headNode = null
    this.visorMaterials = []
    this.vrm = null
  }
}
