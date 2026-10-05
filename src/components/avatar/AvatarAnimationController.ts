import * as THREE from 'three'
import type { VRM } from '@pixiv/three-vrm'
import type { AvatarState } from './AvatarState'
import { LipSyncAnimationController } from './lipsync/LipSyncAnimationController'
import type { SpeechActivity } from './lipsync/LipSyncTypes'
import { AvatarGestureController } from './AvatarGestureController'
import type { CompanionGestureType } from '../../services/EmotionIntentDetector'

export class AvatarAnimationController {
  private mixer: THREE.AnimationMixer | null = null
  private rootObject: THREE.Object3D
  private vrm: VRM | null = null
  private currentState: AvatarState = 'idle'
  private clockTime = 0

  private lipSyncAnimation: LipSyncAnimationController
  private gestureController: AvatarGestureController

  private chestNode: THREE.Object3D | null = null
  private spineNode: THREE.Object3D | null = null
  private initialChestY = 0

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[] = [], vrm?: VRM | null) {
    this.rootObject = root
    this.vrm = vrm || null
    this.lipSyncAnimation = new LipSyncAnimationController(root, vrm)
    this.gestureController = new AvatarGestureController(vrm)
    this.initMixer(animations)
    this.initProceduralNodes()
  }

  public setVRM(vrm: VRM | null) {
    this.vrm = vrm
    this.lipSyncAnimation.setVRM(vrm)
    this.gestureController.setVRM(vrm)
    this.initProceduralNodes()
  }

  private initMixer(animations: THREE.AnimationClip[]) {
    if (animations && animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.rootObject)
      const clip = animations[0]
      const action = this.mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
  }

  private initProceduralNodes() {
    if (this.vrm?.humanoid) {
      const vrmChest = this.vrm.humanoid.getNormalizedBoneNode('chest')
      const vrmSpine = this.vrm.humanoid.getNormalizedBoneNode('spine')

      if (vrmChest) {
        this.chestNode = vrmChest
        this.initialChestY = vrmChest.position.y
      }
      if (vrmSpine) this.spineNode = vrmSpine
    }

    if (!this.chestNode) {
      this.rootObject.traverse((child) => {
        const name = child.name.toLowerCase()
        if (name.includes('chest') && !this.chestNode) {
          this.chestNode = child
          this.initialChestY = child.position.y
        } else if (name.includes('spine') && !this.spineNode) {
          this.spineNode = child
        }
      })
    }
  }

  public getLipSyncAnimation(): LipSyncAnimationController {
    return this.lipSyncAnimation
  }

  public setState(state: AvatarState) {
    this.currentState = state
  }

  public update(
    delta: number,
    speech?: SpeechActivity,
    gesture?: { activeGesture: CompanionGestureType; weight: number }
  ) {
    this.clockTime += delta

    if (this.mixer) {
      this.mixer.update(delta)
    }

    this.applyProceduralBreathing(this.clockTime)

    if (gesture && gesture.weight > 0) {
      this.gestureController.update(delta, gesture.activeGesture, gesture.weight)
    } else {
      this.gestureController.update(delta, 'none', 0)
    }

    if (speech && (speech.isSpeaking || this.currentState === 'speaking' || speech.amplitude > 0.005)) {
      this.lipSyncAnimation.update(speech, delta)
    } else {
      this.lipSyncAnimation.decay(delta)
    }
  }

  private applyProceduralBreathing(t: number) {
    const breathFreq = 1.3
    const breathOffset = Math.sin(t * breathFreq)

    if (this.chestNode) {
      this.chestNode.position.y = this.initialChestY + breathOffset * 0.003
      const breathScale = 1 + breathOffset * 0.008
      this.chestNode.scale.set(breathScale, breathScale, breathScale)
    } else {
      this.rootObject.position.y += Math.sin(t * breathFreq) * 0.0005
    }

    if (this.spineNode) {
      this.spineNode.rotation.x = Math.sin(t * breathFreq) * 0.008
    }
  }

  public dispose() {
    this.lipSyncAnimation.dispose()
    this.gestureController.dispose()
    if (this.mixer) {
      this.mixer.stopAllAction()
      this.mixer.uncacheRoot(this.rootObject)
    }
  }
}
