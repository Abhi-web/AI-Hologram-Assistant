import { useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { AvatarModel, DEFAULT_AVATAR_URL } from './AvatarModel'
import type { AvatarState } from './AvatarState'
import type { ModelFacialCapabilities } from './lipsync/LipSyncTypes'

export interface AvatarSceneProps {
  state?: AvatarState
  modelUrl?: string
  wireframe?: boolean
  devControls?: boolean
  isChatOpen?: boolean
  controlsRef?: React.MutableRefObject<OrbitControlsImpl | null>
  onCapabilitiesReport?: (caps: ModelFacialCapabilities) => void
}

/**
 * Dynamic Camera Controller that frames the 3D Avatar full-body (head to feet)
 * without cropping, adjusting smoothly between Chat Open (companion layout) and
 * Chat Closed (full-screen companion layout).
 */
function AvatarCameraController({
  isChatOpen = false,
  controlsRef,
}: {
  isChatOpen?: boolean
  controlsRef?: React.MutableRefObject<OrbitControlsImpl | null>
}) {
  const { camera, size } = useThree()
  const isUserInteracting = useRef(false)
  const lastInteractionTime = useRef(0)

  useEffect(() => {
    const controls = controlsRef?.current
    if (!controls) return

    const onStart = () => {
      isUserInteracting.current = true
      lastInteractionTime.current = performance.now()
    }
    const onEnd = () => {
      isUserInteracting.current = false
      lastInteractionTime.current = performance.now()
    }

    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
    }
  }, [controlsRef])

  useFrame((_, delta) => {
    // If user is actively dragging the camera with OrbitControls, pause automatic framing
    if (isUserInteracting.current) return
    const timeSinceInteraction = (performance.now() - lastInteractionTime.current) / 1000
    if (timeSinceInteraction < 1.2) return

    const aspect = Math.max(0.2, size.width / Math.max(1, size.height))
    const persCamera = camera as THREE.PerspectiveCamera
    const fovY = persCamera.fov * (Math.PI / 180)
    const tanFovY = Math.tan(fovY / 2)

    // Full-body avatar bounding dimensions with scale 1.05:
    // Total vertical height: 1.66m (feet to hair tips)
    // Width: 1.41m (hand to hand)
    // Add safety margins for breathing and head postures:
    const targetHeight = isChatOpen ? 1.94 : 1.88
    const targetWidth = 1.58

    const distY = (targetHeight / 2) / tanFovY
    const distX = (targetWidth / 2) / (aspect * tanFovY)
    const idealDist = Math.max(distY, distX)

    // Eye-level view centered on torso origin (0, 0, 0)
    const targetLookAt = new THREE.Vector3(0, 0, 0)
    const targetCamPos = new THREE.Vector3(0, 0.04, idealDist)

    const lerpSpeed = Math.min(1.0, delta * 5.0)
    camera.position.lerp(targetCamPos, lerpSpeed)

    if (controlsRef?.current) {
      controlsRef.current.target.lerp(targetLookAt, lerpSpeed)
      controlsRef.current.update()
    }
  })

  return null
}

/**
 * Futuristic holographic emitter platform directly beneath the avatar's feet.
 */
function HologramPedestal() {
  const ringRef = useRef<THREE.Mesh>(null)
  const outerRingRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.4
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= delta * 0.2
    }
  })

  return (
    <group position={[0, -0.83, 0]}>
      {/* Base dark emitter disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[0.65, 32]} />
        <meshBasicMaterial color="#080d1a" opacity={0.8} transparent depthWrite={false} />
      </mesh>

      {/* Inner cyan hologram ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.35, 0.38, 32]} />
        <meshBasicMaterial color="#00d4ff" opacity={0.7} transparent depthWrite={false} />
      </mesh>

      {/* Outer purple hologram ring */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[0.5, 0.52, 32]} />
        <meshBasicMaterial color="#7b2fff" opacity={0.5} transparent depthWrite={false} />
      </mesh>

      {/* Subtle floor grid ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.1, 0.65, 4]} />
        <meshBasicMaterial color="#00d4ff" opacity={0.15} transparent wireframe depthWrite={false} />
      </mesh>
    </group>
  )
}

export function AvatarScene({
  state = 'idle',
  modelUrl = DEFAULT_AVATAR_URL,
  wireframe = false,
  devControls = false,
  isChatOpen = false,
  controlsRef,
  onCapabilitiesReport,
}: AvatarSceneProps) {
  return (
    <Canvas
      camera={{
        position: [0, 0.05, 3.1],
        fov: 35,
        near: 0.1,
        far: 20,
      }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      }}
      style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
    >
      {/* Dynamic Camera Framing Controller */}
      <AvatarCameraController isChatOpen={isChatOpen} controlsRef={controlsRef} />

      {/* ── Holographic Lighting Rig for Anime Avatar ── */}
      {/* Soft futuristic ambient light */}
      <ambientLight intensity={1.1} color="#0c1228" />

      {/* Key light: Cyan holographic illumination from front-right */}
      <directionalLight
        position={[1.8, 2.5, 2.2]}
        intensity={1.6}
        color="#00d4ff"
      />

      {/* Fill light: Cyber purple glow from front-left */}
      <directionalLight
        position={[-1.8, 1.6, 1.8]}
        intensity={1.1}
        color="#9d4edd"
      />

      {/* Rim / Back light: Luminous cyan aura highlighting blonde twin-tails */}
      <directionalLight
        position={[0, 2.2, -1.8]}
        intensity={2.2}
        color="#00f0ff"
      />

      {/* Secondary hair highlight light */}
      <directionalLight
        position={[1.5, 3.0, -1.0]}
        intensity={1.5}
        color="#ffd166"
      />

      {/* Under-glow from holographic pedestal */}
      <pointLight
        position={[0, -0.75, 0.3]}
        intensity={1.8}
        color="#00d4ff"
        distance={2.5}
      />

      {/* ── Hologram Platform & Pedestal ── */}
      <HologramPedestal />

      {/* ── 3D Avatar Model (Full-Body Framed, Feet resting naturally on pedestal) ── */}
      <Suspense fallback={null}>
        <AvatarModel
          modelUrl={modelUrl}
          state={state}
          wireframe={wireframe}
          position={[0, -0.83, 0]}
          scale={1.05}
          onCapabilitiesReport={onCapabilitiesReport}
        />
      </Suspense>

      {/* ── Interactive Camera Controls ── */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
        enablePan={devControls}
        enableZoom={true}
        minDistance={1.2}
        maxDistance={5.5}
        minAzimuthAngle={devControls ? -Infinity : -Math.PI / 3}
        maxAzimuthAngle={devControls ? Infinity : Math.PI / 3}
        minPolarAngle={devControls ? 0 : Math.PI / 3.2}
        maxPolarAngle={devControls ? Math.PI : Math.PI / 1.6}
      />
    </Canvas>
  )
}
