import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { CompanionGestureType } from '../../services/EmotionIntentDetector'

interface BoneReference {
  node: THREE.Object3D
  restEuler: THREE.Euler
}

/**
 * AvatarGestureController — Procedural kinematics controller for ARIA's 3D avatar.
 * Eliminates the default T-pose by maintaining a natural, relaxed, breathing
 * humanoid standing pose at all times, with smooth blend kinematics into expressive gestures.
 */
export class AvatarGestureController {
  private vrm: VRM | null = null

  private rightUpperArm: BoneReference | null = null
  private rightLowerArm: BoneReference | null = null
  private rightHand: BoneReference | null = null

  private leftUpperArm: BoneReference | null = null
  private leftLowerArm: BoneReference | null = null
  private leftHand: BoneReference | null = null

  private clockTime = 0

  constructor(vrm?: VRM | null) {
    if (vrm) {
      this.setVRM(vrm)
    }
  }

  public setVRM(vrm: VRM | null) {
    this.vrm = vrm
    this.initBones()
  }

  private initBones() {
    if (!this.vrm?.humanoid) return

    const getBoneRef = (boneName: any): BoneReference | null => {
      const node = this.vrm!.humanoid!.getNormalizedBoneNode(boneName)
      if (!node) return null
      return {
        node,
        restEuler: node.rotation.clone(),
      }
    }

    this.rightUpperArm = getBoneRef('rightUpperArm')
    this.rightLowerArm = getBoneRef('rightLowerArm')
    this.rightHand = getBoneRef('rightHand')

    this.leftUpperArm = getBoneRef('leftUpperArm')
    this.leftLowerArm = getBoneRef('leftLowerArm')
    this.leftHand = getBoneRef('leftHand')
  }

  /**
   * Called every animation frame with delta, active gesture type, and blend weight (0.0 to 1.0).
   */
  public update(delta: number, activeGesture: CompanionGestureType, weight: number) {
    this.clockTime += delta
    const t = this.clockTime

    // ─── 1. Natural Idle Resting Pose (Arms down along torso, relaxed elbows, gentle breathing sway) ───
    const breathSway = Math.sin(t * 1.3) * 0.015
    const breathElbow = Math.sin(t * 1.3 + 0.5) * 0.01

    // Right Arm Idle Pose (z = +1.28 brings arm DOWN from horizontal T-pose)
    const idleRUpper = new THREE.Euler(0.08, -0.04, 1.25 + breathSway)
    const idleRLower = new THREE.Euler(0.18 + breathElbow, 0.0, 0.22)
    const idleRHand = new THREE.Euler(0.05, 0.0, 0.05)

    // Left Arm Idle Pose (z = -1.28 brings arm DOWN from horizontal T-pose)
    const idleLUpper = new THREE.Euler(0.08, 0.04, -1.25 - breathSway)
    const idleLLower = new THREE.Euler(0.18 + breathElbow, 0.0, -0.22)
    const idleLHand = new THREE.Euler(0.05, 0.0, -0.05)

    // ─── 2. Gesture Target Rotations ───
    const targetRUpper = idleRUpper.clone()
    const targetRLower = idleRLower.clone()
    const targetRHand = idleRHand.clone()

    const targetLUpper = idleLUpper.clone()
    const targetLLower = idleLLower.clone()
    const targetLHand = idleLHand.clone()

    switch (activeGesture) {
      case 'wave': {
        // Friendly energetic greeting wave
        // Right upper arm raises up and outward
        targetRUpper.x = 0.35 + Math.sin(t * 2.0) * 0.04
        targetRUpper.y = -0.2
        targetRUpper.z = -0.75 // Lift arm upward above shoulder

        // Forearm bends upward towards head
        targetRLower.x = 0.4
        targetRLower.y = 0.1
        targetRLower.z = -0.65

        // Hand oscillates side-to-side in a lively wave
        targetRHand.z = Math.sin(t * 8.5) * 0.38
        targetRHand.x = Math.cos(t * 4.0) * 0.08
        break
      }

      case 'thinking_pose': {
        // Contemplative pose: right hand brought up near chin
        targetRUpper.x = 0.45 + Math.sin(t * 1.5) * 0.03
        targetRUpper.y = 0.35
        targetRUpper.z = 0.55

        targetRLower.x = 0.65
        targetRLower.y = 0.2
        targetRLower.z = -1.05

        targetRHand.x = 0.25
        targetRHand.z = -0.2 + Math.sin(t * 2.0) * 0.04
        break
      }

      case 'welcome': {
        // Welcoming open-arms posture
        targetRUpper.x = 0.25
        targetRUpper.y = -0.15
        targetRUpper.z = 0.85

        targetRLower.x = 0.3
        targetRLower.z = 0.35

        targetLUpper.x = 0.25
        targetLUpper.y = 0.15
        targetLUpper.z = -0.85

        targetLLower.x = 0.3
        targetLLower.z = -0.35
        break
      }

      case 'speech_accent': {
        // Conversational hand accents punctuating speech
        const accentA = Math.sin(t * 3.2)
        const accentB = Math.cos(t * 2.4)

        targetRUpper.x = 0.18 + accentA * 0.06
        targetRUpper.y = -0.08
        targetRUpper.z = 1.05 - Math.max(0, accentA) * 0.2

        targetRLower.x = 0.28 + accentA * 0.08
        targetRLower.z = 0.3

        targetRHand.z = accentB * 0.12

        // Left arm gentle counter-balance
        targetLUpper.x = 0.12 + accentB * 0.04
        targetLUpper.z = -1.15
        targetLLower.x = 0.22
        break
      }

      case 'curious_tilt':
      case 'nod':
      case 'none':
      default:
        // Stays in natural resting pose
        break
    }

    // ─── 3. Interpolate from Idle Pose to Gesture Pose based on weight ───
    const clampedWeight = Math.max(0, Math.min(1, weight))
    const blendRate = Math.min(1.0, delta * 8.0)

    const finalRUpper = new THREE.Euler(
      THREE.MathUtils.lerp(idleRUpper.x, targetRUpper.x, clampedWeight),
      THREE.MathUtils.lerp(idleRUpper.y, targetRUpper.y, clampedWeight),
      THREE.MathUtils.lerp(idleRUpper.z, targetRUpper.z, clampedWeight)
    )
    const finalRLower = new THREE.Euler(
      THREE.MathUtils.lerp(idleRLower.x, targetRLower.x, clampedWeight),
      THREE.MathUtils.lerp(idleRLower.y, targetRLower.y, clampedWeight),
      THREE.MathUtils.lerp(idleRLower.z, targetRLower.z, clampedWeight)
    )
    const finalRHand = new THREE.Euler(
      THREE.MathUtils.lerp(idleRHand.x, targetRHand.x, clampedWeight),
      THREE.MathUtils.lerp(idleRHand.y, targetRHand.y, clampedWeight),
      THREE.MathUtils.lerp(idleRHand.z, targetRHand.z, clampedWeight)
    )

    const finalLUpper = new THREE.Euler(
      THREE.MathUtils.lerp(idleLUpper.x, targetLUpper.x, clampedWeight),
      THREE.MathUtils.lerp(idleLUpper.y, targetLUpper.y, clampedWeight),
      THREE.MathUtils.lerp(idleLUpper.z, targetLUpper.z, clampedWeight)
    )
    const finalLLower = new THREE.Euler(
      THREE.MathUtils.lerp(idleLLower.x, targetLLower.x, clampedWeight),
      THREE.MathUtils.lerp(idleLLower.y, targetLLower.y, clampedWeight),
      THREE.MathUtils.lerp(idleLLower.z, targetLLower.z, clampedWeight)
    )
    const finalLHand = new THREE.Euler(
      THREE.MathUtils.lerp(idleLHand.x, targetLHand.x, clampedWeight),
      THREE.MathUtils.lerp(idleLHand.y, targetLHand.y, clampedWeight),
      THREE.MathUtils.lerp(idleLHand.z, targetLHand.z, clampedWeight)
    )

    // ─── 4. Apply smooth lerp to actual VRM bone rotations ───
    this.applyTargetRotation(this.rightUpperArm, finalRUpper, blendRate)
    this.applyTargetRotation(this.rightLowerArm, finalRLower, blendRate)
    this.applyTargetRotation(this.rightHand, finalRHand, blendRate)

    this.applyTargetRotation(this.leftUpperArm, finalLUpper, blendRate)
    this.applyTargetRotation(this.leftLowerArm, finalLLower, blendRate)
    this.applyTargetRotation(this.leftHand, finalLHand, blendRate)
  }

  private applyTargetRotation(
    boneRef: BoneReference | null,
    targetEuler: THREE.Euler,
    blendRate: number
  ) {
    if (!boneRef) return
    boneRef.node.rotation.x += (targetEuler.x - boneRef.node.rotation.x) * blendRate
    boneRef.node.rotation.y += (targetEuler.y - boneRef.node.rotation.y) * blendRate
    boneRef.node.rotation.z += (targetEuler.z - boneRef.node.rotation.z) * blendRate
  }

  public dispose() {
    const reset = (boneRef: BoneReference | null) => {
      if (boneRef) {
        boneRef.node.rotation.copy(boneRef.restEuler)
      }
    }
    reset(this.rightUpperArm)
    reset(this.rightLowerArm)
    reset(this.rightHand)
    reset(this.leftUpperArm)
    reset(this.leftLowerArm)
    reset(this.leftHand)
  }
}
