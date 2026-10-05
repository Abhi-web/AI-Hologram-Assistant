import type { VRM } from '@pixiv/three-vrm'
import type { AvatarState } from './AvatarState'

/**
 * AvatarExpressionController — Controls emotive facial expressions
 * for the anime avatar across different assistant runtime states.
 *
 * Supported VRM 1.0 expressions:
 * - happy, angry, sad, relaxed, surprised, neutral
 */
export class AvatarExpressionController {
  private vrm: VRM
  private currentState: AvatarState = 'idle'
  private currentWeights: { [key: string]: number } = {
    happy: 0.15,
    neutral: 0.85,
    surprised: 0,
    relaxed: 0,
    sad: 0,
    angry: 0,
  }

  private companionWeights = {
    smile: 0,
    surprise: 0,
    thinking: 0,
  }

  constructor(vrm: VRM) {
    this.vrm = vrm
    this.applyExpressionImmediate()
  }

  public setState(state: AvatarState) {
    this.currentState = state
  }

  public setCompanionWeights(smile: number, surprise: number, thinking: number) {
    this.companionWeights.smile = smile
    this.companionWeights.surprise = surprise
    this.companionWeights.thinking = thinking
  }

  /**
   * Called every frame to smoothly interpolate toward the target expression weights.
   */
  public update(delta: number) {
    const baseWeights = this.getTargetWeights(this.currentState)
    const lerpSpeed = Math.min(1.0, delta * 8.0)

    // Blend base state weights with dynamic companion emotion weights
    const targetHappy = Math.min(1.0, (baseWeights.happy || 0) + this.companionWeights.smile * 0.7)
    const targetSurprised = Math.min(1.0, (baseWeights.surprised || 0) + this.companionWeights.surprise * 0.8)
    const targetRelaxed = Math.min(1.0, (baseWeights.relaxed || 0) + this.companionWeights.thinking * 0.4)
    const targetNeutral = Math.max(0.1, 1.0 - (targetHappy * 0.7 + targetSurprised * 0.6))

    const blendedTargets: { [key: string]: number } = {
      happy: targetHappy,
      surprised: targetSurprised,
      relaxed: targetRelaxed,
      neutral: targetNeutral,
      sad: baseWeights.sad || 0,
      angry: baseWeights.angry || 0,
    }

    for (const key of Object.keys(this.currentWeights)) {
      const target = blendedTargets[key] || 0
      this.currentWeights[key] += (target - this.currentWeights[key]) * lerpSpeed

      // Apply to VRM Expression Manager
      if (this.vrm.expressionManager) {
        this.vrm.expressionManager.setValue(key, this.currentWeights[key])
      }
    }
  }

  private getTargetWeights(state: AvatarState): { [key: string]: number } {
    switch (state) {
      case 'listening':
        // Attentive, focused expression with slightly widened eyes
        return {
          surprised: 0.25,
          neutral: 0.75,
          happy: 0.1,
          relaxed: 0,
          sad: 0,
          angry: 0,
        }

      case 'interrupted':
        // Alert, attentive pause facing user
        return {
          surprised: 0.35,
          neutral: 0.65,
          happy: 0,
          relaxed: 0,
          sad: 0,
          angry: 0,
        }

      case 'thinking':
        // Contemplative, thoughtful expression
        return {
          relaxed: 0.35,
          neutral: 0.65,
          surprised: 0.05,
          happy: 0.05,
          sad: 0,
          angry: 0,
        }

      case 'speaking':
        // Friendly, engaged, smiling anime expression
        return {
          happy: 0.35,
          neutral: 0.65,
          relaxed: 0.15,
          surprised: 0,
          sad: 0,
          angry: 0,
        }

      case 'happy':
        // Radiant joyful anime smile
        return {
          happy: 0.85,
          neutral: 0.15,
          relaxed: 0.1,
          surprised: 0,
          sad: 0,
          angry: 0,
        }

      case 'surprised':
        // Alert wide-eyed anime surprise
        return {
          surprised: 0.85,
          neutral: 0.15,
          happy: 0.2,
          relaxed: 0,
          sad: 0,
          angry: 0,
        }

      case 'confused':
        // Inquisitive, slightly puzzled anime expression
        return {
          relaxed: 0.38,
          surprised: 0.32,
          neutral: 0.5,
          happy: 0.05,
          sad: 0,
          angry: 0,
        }

      case 'concerned':
        // Gentle, empathetic concern with caring eyes and brow
        return {
          sad: 0.28,
          relaxed: 0.3,
          neutral: 0.55,
          happy: 0.05,
          surprised: 0.05,
          angry: 0,
        }

      case 'curious':
        // Alert, inquisitive, engaging anime curiosity
        return {
          surprised: 0.35,
          happy: 0.25,
          neutral: 0.5,
          relaxed: 0.1,
          sad: 0,
          angry: 0,
        }

      case 'playful':
        // Charming subtle anime smile with lively relaxed eyes
        return {
          happy: 0.65,
          relaxed: 0.25,
          surprised: 0.15,
          neutral: 0.35,
          sad: 0,
          angry: 0,
        }

      case 'excited':
        // Vibrant radiant smile with bright alert eyes
        return {
          happy: 0.95,
          surprised: 0.35,
          relaxed: 0.1,
          neutral: 0.05,
          sad: 0,
          angry: 0,
        }

      case 'idle':
      default:
        // Warm, approachable, gentle neutral anime smile
        return {
          neutral: 0.85,
          happy: 0.2,
          relaxed: 0.1,
          surprised: 0,
          sad: 0,
          angry: 0,
        }
    }
  }

  private applyExpressionImmediate() {
    if (!this.vrm.expressionManager) return
    for (const [key, val] of Object.entries(this.currentWeights)) {
      this.vrm.expressionManager.setValue(key, val)
    }
  }

  public dispose() {
    if (this.vrm.expressionManager) {
      for (const key of Object.keys(this.currentWeights)) {
        this.vrm.expressionManager.setValue(key, 0)
      }
    }
  }
}
