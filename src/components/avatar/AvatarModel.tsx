import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, type VRM, VRMUtils } from '@pixiv/three-vrm'
import * as THREE from 'three'
import { AvatarAnimationController } from './AvatarAnimationController'
import { AvatarExpressionController } from './AvatarExpressionController'
import { AvatarEyeHeadController } from './AvatarEyeHeadController'
import type { AvatarState } from './AvatarState'
import { lipSyncController } from './lipsync/LipSyncController'
import type { ModelFacialCapabilities } from './lipsync/LipSyncTypes'
import { companionBehaviorEngine } from '../../services/CompanionBehaviorEngine'
import { clothingAssetManager } from './wardrobe/ClothingAssetManager'
import { wardrobeManager } from '../../services/WardrobeManager'

export interface AvatarModelProps {
  modelUrl?: string
  state?: AvatarState
  wireframe?: boolean
  scale?: number | [number, number, number]
  position?: [number, number, number]
  rotation?: [number, number, number]
  onCapabilitiesReport?: (caps: ModelFacialCapabilities) => void
}

export const DEFAULT_AVATAR_URL = `${import.meta.env.BASE_URL}models/aria-anime.vrm`

export function AvatarModel({
  modelUrl = DEFAULT_AVATAR_URL,
  state = 'idle',
  wireframe = false,
  scale = 1.35,
  position = [0, -1.05, 0],
  rotation = [0, 0, 0],
  onCapabilitiesReport,
}: AvatarModelProps) {
  const groupRef = useRef<THREE.Group>(null)

  const [vrm, setVrm] = useState<VRM | null>(null)
  const [fallbackScene, setFallbackScene] = useState<THREE.Group | null>(null)
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([])

  useEffect(() => {
    let isMounted = true
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    loader.load(
      modelUrl,
      (gltf) => {
        if (!isMounted) return

        const loadedVrm = gltf.userData.vrm as VRM | undefined
        if (loadedVrm) {
          VRMUtils.removeUnnecessaryVertices(loadedVrm.scene)
          VRMUtils.removeUnnecessaryJoints(loadedVrm.scene)

          loadedVrm.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
              child.frustumCulled = false
            }
          })

          setVrm(loadedVrm)
          setFallbackScene(null)
          setAnimations(gltf.animations || [])
        } else {
          const cloned = gltf.scene.clone(true)
          cloned.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          setFallbackScene(cloned)
          setVrm(null)
          setAnimations(gltf.animations || [])
        }
      },
      undefined,
      (err) => {
        console.error('[AvatarModel] Failed to load 3D model:', err)
      }
    )

    return () => {
      isMounted = false
    }
  }, [modelUrl])

  const activeScene = vrm ? vrm.scene : fallbackScene

  const controllers = useMemo(() => {
    if (!activeScene) return null

    const anim = new AvatarAnimationController(activeScene, animations, vrm)
    const expr = vrm ? new AvatarExpressionController(vrm) : null
    const eyeHead = vrm ? new AvatarEyeHeadController(vrm) : null

    return { anim, expr, eyeHead }
  }, [activeScene, animations, vrm])

  useEffect(() => {
    if (!controllers) return
    const caps = controllers.anim.getLipSyncAnimation().getCapabilities()
    onCapabilitiesReport?.(caps)
  }, [controllers, onCapabilitiesReport])

  useEffect(() => {
    if (!controllers) return
    controllers.anim.setState(state)
    controllers.expr?.setState(state)
    controllers.eyeHead?.setState(state)
  }, [controllers, state])

  useEffect(() => {
    if (!activeScene) return
    activeScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          materials.forEach((mat) => {
            if ('wireframe' in mat) {
              ;(mat as THREE.MeshStandardMaterial).wireframe = wireframe
            }
          })
        }
      }
    })
  }, [activeScene, wireframe])

  // ── Synchronize 3D Clothing & Wardrobe Outfits ──────────────────────────────
  useEffect(() => {
    if (!activeScene) return

    clothingAssetManager.init(activeScene, vrm)

    const unsubWardrobe = wardrobeManager.subscribe(async () => {
      const targetOutfit = wardrobeManager.getCurrentOutfit()
      try {
        await clothingAssetManager.equipOutfit(targetOutfit)
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.'
        wardrobeManager.setErrorNotice(msg)
      }
    })

    return () => {
      unsubWardrobe()
      clothingAssetManager.dispose()
    }
  }, [activeScene, vrm])

  useFrame((stateObj, delta) => {
    if (!controllers || !activeScene) return

    const safeDelta = Math.min(delta, 0.1)

    // 1. Advance companion behavior engine (gestures, emotion decay, head tilts)
    companionBehaviorEngine.update(safeDelta)
    const compState = companionBehaviorEngine.getState()

    if (vrm) {
      vrm.update(safeDelta)
    }

    // 2. Drive lip sync and procedural arm gestures
    const speech = lipSyncController.update(safeDelta)
    controllers.anim.update(safeDelta, speech, {
      activeGesture: compState.activeGesture,
      weight: compState.gestureWeight,
    })

    // 3. Drive facial expressions with dynamic companion emotion weights
    controllers.expr?.setCompanionWeights(
      compState.smileWeight,
      compState.surpriseWeight,
      compState.thinkingWeight
    )
    controllers.expr?.update(safeDelta)

    // 4. Drive head posture with companion head tilt and gaze tracking
    controllers.eyeHead?.setHeadTiltOffset(compState.headTilt)
    controllers.eyeHead?.setEyeGazeOffset(compState.eyeGazeOffset)
    controllers.eyeHead?.update(safeDelta, stateObj.camera)
  })

  useEffect(() => {
    return () => {
      if (controllers) {
        controllers.anim.dispose()
        controllers.expr?.dispose()
        controllers.eyeHead?.dispose()
      }
      if (vrm) {
        VRMUtils.deepDispose(vrm.scene)
      }
    }
  }, [controllers, vrm])

  if (!activeScene) {
    return null
  }

  return (
    <group
      ref={groupRef}
      position={position}
      scale={typeof scale === 'number' ? [scale, scale, scale] : scale}
      rotation={rotation}
      dispose={null}
    >
      <primitive object={activeScene} />
    </group>
  )
}
