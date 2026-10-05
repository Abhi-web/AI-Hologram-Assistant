import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { AvatarState } from './AvatarState'

export class AvatarEyeHeadController {
  private vrm: VRM
  private currentState: AvatarState = 'idle'

  private blinkTimer = 0
  private nextBlinkInterval = 3.5
  private blinkDuration = 0.22
  private isBlinking = false
  private blinkProgress = 0
  private isDoubleBlink = false

  private cameraTarget = new THREE.Vector3(0, 1.45, 1.2)
  private currentLookTarget = new THREE.Vector3(0, 1.45, 1.2)

  private headBone: THREE.Object3D | null = null
  private initialHeadRot = new THREE.Euler()
  private clockTime = 0

  private headTiltOffset = { x: 0, y: 0, z: 0 }
  private eyeGazeOffset = { x: 0, y: 0 }

  // Micro-saccade simulation for natural, lifelike eye movements
  private saccadeTimer = 0
  private nextSaccadeInterval = 3.0
  private saccadeOffset = { x: 0, y: 0 }

  constructor(vrm: VRM) {
    this.vrm = vrm
    this.nextBlinkInterval = 2.5 + Math.random() * 2.5
    this.nextSaccadeInterval = 2.0 + Math.random() * 2.5

    const headNode = vrm.humanoid?.getNormalizedBoneNode('head')
    if (headNode) {
      this.headBone = headNode
      this.initialHeadRot.copy(headNode.rotation)
    }
  }

  public setState(state: AvatarState) {
    this.currentState = state
  }

  public setHeadTiltOffset(tilt: { x: number; y: number; z: number }) {
    this.headTiltOffset = tilt
  }

  public setEyeGazeOffset(offset: { x: number; y: number }) {
    this.eyeGazeOffset = offset
  }

  public update(delta: number, camera?: THREE.Camera) {
    this.clockTime += delta

    this.updateBlinking(delta)
    this.updateMicroSaccades(delta)

    if (camera) {
      let stateGazeX = this.eyeGazeOffset.x + this.saccadeOffset.x
      let stateGazeY = this.eyeGazeOffset.y + this.saccadeOffset.y

      if (this.currentState === 'thinking') {
        // Contemplative upward and sideways gaze
        stateGazeX += 0.12
        stateGazeY += 0.18
      } else if (this.currentState === 'listening') {
        // Attentive, focused gaze directly at user with minimal deviation
        stateGazeX = this.eyeGazeOffset.x * 0.4 + this.saccadeOffset.x * 0.3
        stateGazeY = this.eyeGazeOffset.y * 0.4 + this.saccadeOffset.y * 0.3
      } else if (this.currentState === 'curious') {
        stateGazeY += 0.08
      }

      this.cameraTarget.set(
        camera.position.x * 0.35 + stateGazeX,
        camera.position.y * 0.75 + 0.15 + stateGazeY,
        camera.position.z
      )
    } else {
      this.cameraTarget.set(this.eyeGazeOffset.x, 1.45 + this.eyeGazeOffset.y, 1.2)
    }
    this.currentLookTarget.lerp(this.cameraTarget, delta * 3.5)

    if (this.vrm.lookAt) {
      this.vrm.lookAt.lookAt(this.currentLookTarget)
    }

    this.updateHeadPosture(delta)
  }

  private updateMicroSaccades(delta: number) {
    this.saccadeTimer += delta
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0
      this.nextSaccadeInterval = 2.2 + Math.random() * 3.0

      if (this.currentState === 'listening') {
        // Very tight focus during active listening
        this.saccadeOffset.x = (Math.random() - 0.5) * 0.02
        this.saccadeOffset.y = (Math.random() - 0.5) * 0.015
      } else {
        // Gentle lifelike eye dart
        this.saccadeOffset.x = (Math.random() - 0.5) * 0.05
        this.saccadeOffset.y = (Math.random() - 0.5) * 0.035
      }
    }
  }

  private updateBlinking(delta: number) {
    if (!this.vrm.expressionManager) return

    this.blinkTimer += delta

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true
      this.blinkProgress = 0
      this.isDoubleBlink = Math.random() < 0.25
    }

    if (this.isBlinking) {
      this.blinkProgress += delta / this.blinkDuration

      let blinkWeight = 0
      if (this.blinkProgress <= 0.5) {
        blinkWeight = Math.sin((this.blinkProgress / 0.5) * (Math.PI / 2))
      } else if (this.blinkProgress <= 1.0) {
        blinkWeight = Math.cos(((this.blinkProgress - 0.5) / 0.5) * (Math.PI / 2))
      } else {
        if (this.isDoubleBlink) {
          this.isDoubleBlink = false
          this.blinkProgress = 0
        } else {
          this.isBlinking = false
          this.blinkTimer = 0
          this.nextBlinkInterval = 3.0 + Math.random() * 3.0
          blinkWeight = 0
        }
      }

      this.vrm.expressionManager.setValue('blink', Math.max(0, Math.min(1, blinkWeight)))
    }
  }

  private updateHeadPosture(delta: number) {
    if (!this.headBone) return

    let targetRotX = this.initialHeadRot.x
    let targetRotY = this.initialHeadRot.y
    let targetRotZ = this.initialHeadRot.z

    const t = this.clockTime

    switch (this.currentState) {
      case 'listening':
        // Attentive forward posture with subtle listening nod
        targetRotX += 0.04 + this.headTiltOffset.x
        targetRotZ += 0.035 + this.headTiltOffset.z
        targetRotY += Math.sin(t * 1.5) * 0.02 + this.headTiltOffset.y
        break

      case 'interrupted':
        targetRotX += 0.05 + this.headTiltOffset.x
        targetRotZ += this.headTiltOffset.z
        targetRotY += this.headTiltOffset.y
        break

      case 'thinking':
        // Thoughtful contemplative posture
        targetRotX += -0.05 + this.headTiltOffset.x
        targetRotZ += -0.06 + this.headTiltOffset.z
        targetRotY += Math.sin(t * 0.8) * 0.03 + this.headTiltOffset.y
        break

      case 'speaking':
        // Conversational articulation cadence
        targetRotX += Math.sin(t * 3.5) * 0.03 + this.headTiltOffset.x
        targetRotY += Math.cos(t * 2.0) * 0.025 + this.headTiltOffset.y
        targetRotZ += this.headTiltOffset.z
        break

      case 'happy':
        targetRotX += 0.02 + this.headTiltOffset.x
        targetRotZ += 0.04 + this.headTiltOffset.z + Math.sin(t * 1.8) * 0.015
        targetRotY += Math.sin(t * 1.2) * 0.02 + this.headTiltOffset.y
        break

      case 'surprised':
        targetRotX += -0.04 + this.headTiltOffset.x
        targetRotZ += this.headTiltOffset.z
        targetRotY += this.headTiltOffset.y
        break

      case 'confused':
        targetRotX += 0.03 + this.headTiltOffset.x
        targetRotZ += 0.11 + this.headTiltOffset.z // prominent inquisitive tilt
        targetRotY += -0.04 + this.headTiltOffset.y
        break

      case 'concerned':
        // Gentle empathetic forward tilt with slight warmth
        targetRotX += 0.03 + this.headTiltOffset.x
        targetRotZ += -0.05 + this.headTiltOffset.z
        targetRotY += 0.02 + this.headTiltOffset.y
        break

      case 'curious':
        // Perked, lively head tilt
        targetRotX += 0.035 + this.headTiltOffset.x
        targetRotZ += 0.085 + this.headTiltOffset.z
        targetRotY += Math.sin(t * 1.0) * 0.02 + this.headTiltOffset.y
        break

      case 'playful':
        // Charming tilted posture with gentle lively movement
        targetRotX += 0.025 + this.headTiltOffset.x
        targetRotZ += 0.065 + this.headTiltOffset.z
        targetRotY += Math.sin(t * 1.4) * 0.03 + this.headTiltOffset.y
        break

      case 'excited':
        // Energetic perked posture with slight positive cadence
        targetRotX += 0.03 + this.headTiltOffset.x + Math.sin(t * 2.5) * 0.02
        targetRotZ += 0.04 + this.headTiltOffset.z
        targetRotY += Math.sin(t * 1.8) * 0.025 + this.headTiltOffset.y
        break

      case 'idle':
      default:
        targetRotX += this.headTiltOffset.x
        targetRotZ += Math.sin(t * 0.7) * 0.015 + this.headTiltOffset.z
        targetRotY += Math.cos(t * 0.5) * 0.018 + this.headTiltOffset.y
        break
    }

    const lerpSpeed = Math.min(1.0, delta * 4.0)
    this.headBone.rotation.x += (targetRotX - this.headBone.rotation.x) * lerpSpeed
    this.headBone.rotation.y += (targetRotY - this.headBone.rotation.y) * lerpSpeed
    this.headBone.rotation.z += (targetRotZ - this.headBone.rotation.z) * lerpSpeed
  }

  public dispose() {
    if (this.vrm.expressionManager) {
      this.vrm.expressionManager.setValue('blink', 0)
    }
  }
}
