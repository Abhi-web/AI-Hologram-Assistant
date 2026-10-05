import {
  emotionIntentDetector,
  type CompanionEmotion,
  type CompanionIntent,
  type CompanionGestureType,
  type EmotionAnalysisResult,
} from './EmotionIntentDetector'
import { avatarStateService } from './AvatarStateService'
import { textToSpeechService, type TTSLifecycleListener } from './TextToSpeechService'

export interface CompanionState {
  emotion: CompanionEmotion
  intent: CompanionIntent
  intensity: number
  activeGesture: CompanionGestureType
  gestureProgress: number // 0.0 to 1.0 (phase through gesture duration)
  gestureWeight: number // 0.0 to 1.0 (smooth blend factor)
  smileWeight: number
  surpriseWeight: number
  thinkingWeight: number
  headTilt: { x: number; y: number; z: number }
  eyeGazeOffset: { x: number; y: number }
}

export type CompanionStateListener = (state: CompanionState) => void

/**
 * CompanionBehaviorEngine — Central orchestrator bridging AI intelligence,
 * user interactions, and the 3D Anime Avatar's expressive channels.
 */
export class CompanionBehaviorEngine {
  private currentEmotion: CompanionEmotion = 'neutral'
  private currentIntent: CompanionIntent = 'casual'
  private intensity = 0.5

  private activeGesture: CompanionGestureType = 'none'
  private gestureTimer = 0
  private gestureDuration = 2.5
  private gestureWeight = 0 // smoothly lerped 0 -> 1 -> 0

  private smileWeight = 0.15
  private targetSmileWeight = 0.15
  private surpriseWeight = 0
  private targetSurpriseWeight = 0
  private thinkingWeight = 0
  private targetThinkingWeight = 0

  private targetHeadTilt = { x: 0, y: 0, z: 0 }
  private currentHeadTilt = { x: 0, y: 0, z: 0 }

  private targetEyeGaze = { x: 0, y: 0 }
  private currentEyeGaze = { x: 0, y: 0 }

  private listeners: Set<CompanionStateListener> = new Set()
  private cleanupFns: Array<() => void> = []

  constructor() {
    this.setupSubscriptions()
  }

  private setupSubscriptions() {
    // 1. Listen to AvatarStateService changes
    const unsubState = avatarStateService.subscribe((state) => {
      if (state === 'thinking') {
        this.targetThinkingWeight = 0.8
        this.targetSmileWeight = 0.05
        this.targetSurpriseWeight = 0
        this.targetHeadTilt = { x: -0.06, y: 0.04, z: -0.05 }
        this.targetEyeGaze = { x: 0.2, y: 0.3 } // Contemplative upward gaze
        this.triggerGesture('thinking_pose', 3.0)
      } else if (state === 'listening') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.2
        this.targetSmileWeight = 0.2
        this.targetHeadTilt = { x: 0.04, y: -0.02, z: 0.06 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'speaking') {
        this.targetThinkingWeight = 0
        this.targetEyeGaze = { x: 0, y: 0 }
        if (this.currentEmotion === 'happy' || this.currentEmotion === 'greeting') {
          this.targetSmileWeight = 0.65
        } else {
          this.targetSmileWeight = 0.35
        }
      } else if (state === 'concerned') {
        this.targetThinkingWeight = 0.2
        this.targetSurpriseWeight = 0.08
        this.targetSmileWeight = 0.12
        this.targetHeadTilt = { x: 0.03, y: 0.02, z: -0.05 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'curious') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.25
        this.targetSmileWeight = 0.25
        this.targetHeadTilt = { x: 0.035, y: 0.02, z: 0.085 }
        this.targetEyeGaze = { x: 0, y: 0.08 }
      } else if (state === 'playful') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.15
        this.targetSmileWeight = 0.65
        this.targetHeadTilt = { x: 0.025, y: 0, z: 0.065 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'excited') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.35
        this.targetSmileWeight = 0.95
        this.targetHeadTilt = { x: 0.03, y: 0, z: 0.04 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'happy') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.05
        this.targetSmileWeight = 0.8
        this.targetHeadTilt = { x: 0.02, y: 0.02, z: 0.04 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'surprised') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0.85
        this.targetSmileWeight = 0.25
        this.targetHeadTilt = { x: -0.04, y: 0, z: 0 }
        this.targetEyeGaze = { x: 0, y: 0 }
      } else if (state === 'idle') {
        this.targetThinkingWeight = 0
        this.targetSurpriseWeight = 0
        this.targetSmileWeight = 0.15
        this.targetHeadTilt = { x: 0, y: 0, z: 0 }
        this.targetEyeGaze = { x: 0, y: 0 }
      }
    })
    this.cleanupFns.push(unsubState)

    // 2. Listen to TextToSpeechService lifecycle
    const ttsLifecycle: TTSLifecycleListener = {
      onStart: () => {
        if (this.currentEmotion === 'greeting' || this.currentIntent === 'greeting') {
          this.triggerGesture('wave', 2.8)
        } else if (this.activeGesture === 'none' || this.activeGesture === 'thinking_pose') {
          this.triggerGesture('speech_accent', 3.5)
        }
      },
      onEnd: () => {
        this.decayEmotion()
      },
      onStop: () => {
        this.resetGestures()
      },
    }
    const unsubTTS = textToSpeechService.addLifecycleListener(ttsLifecycle)
    this.cleanupFns.push(unsubTTS)
  }

  /**
   * Called when user submits a prompt (text or speech).
   */
  public onUserMessage(text: string): EmotionAnalysisResult {
    const analysis = emotionIntentDetector.analyze(text, false)
    this.applyAnalysis(analysis)
    return analysis
  }

  /**
   * Called incrementally as AI streaming chunks arrive.
   */
  public onAIStreamChunk(chunk: string): void {
    // Check for immediate emotional markers in early chunks
    if (chunk.includes('!') || chunk.includes('?') || chunk.length > 20) {
      const quickAnalysis = emotionIntentDetector.analyze(chunk, true)
      if (quickAnalysis.emotion !== 'neutral') {
        this.applyAnalysis(quickAnalysis, true)
      }
    }
  }

  /**
   * Called when AI response is completely generated.
   */
  public onAIResponseComplete(fullResponse: string): EmotionAnalysisResult {
    const analysis = emotionIntentDetector.analyze(fullResponse, true)
    this.applyAnalysis(analysis)
    return analysis
  }

  /**
   * Apply an emotion and intent analysis result to the companion behavior state.
   */
  public applyAnalysis(analysis: EmotionAnalysisResult, gentle = false): void {
    this.currentEmotion = analysis.emotion
    this.currentIntent = analysis.intent
    this.intensity = analysis.intensity

    this.targetSmileWeight = analysis.smileWeight
    this.targetSurpriseWeight = analysis.surpriseWeight
    this.targetThinkingWeight = analysis.thinkingWeight

    this.targetHeadTilt = {
      x: (analysis.emotion === 'thoughtful' ? -0.05 : 0.02) * analysis.intensity,
      y: 0,
      z: analysis.headTiltAngle,
    }

    if (analysis.recommendedGesture !== 'none' && (!gentle || this.activeGesture === 'none')) {
      const duration = analysis.recommendedGesture === 'wave' ? 2.8 : 3.2
      this.triggerGesture(analysis.recommendedGesture, duration)
    }

    // Bridge detected conversation emotion to central avatar state
    const currentState = avatarStateService.getState()
    if (currentState !== 'speaking' && currentState !== 'listening') {
      if (analysis.emotion === 'happy') {
        avatarStateService.setState('happy', 'CompanionBehaviorEngine:applyAnalysis')
      } else if (analysis.emotion === 'excited') {
        avatarStateService.setState('excited', 'CompanionBehaviorEngine:applyAnalysis')
      } else if (analysis.emotion === 'playful') {
        avatarStateService.setState('playful', 'CompanionBehaviorEngine:applyAnalysis')
      } else if (analysis.emotion === 'surprised') {
        avatarStateService.setState('surprised', 'CompanionBehaviorEngine:applyAnalysis')
      } else if (analysis.emotion === 'concerned') {
        avatarStateService.setState('concerned', 'CompanionBehaviorEngine:applyAnalysis')
      } else if (analysis.emotion === 'curious') {
        avatarStateService.setState('curious', 'CompanionBehaviorEngine:applyAnalysis')
      }
    }

    this.emotionHoldTimer = 0
    this.notifyState()
  }

  /**
   * Triggers a specific procedural avatar gesture.
   */
  public triggerGesture(gesture: CompanionGestureType, duration = 2.5): void {
    this.activeGesture = gesture
    this.gestureTimer = 0
    this.gestureDuration = Math.max(0.5, duration)
    this.notifyState()
  }

  /**
   * Sets emotion manually.
   */
  public setEmotion(emotion: CompanionEmotion, intensity = 0.8): void {
    this.currentEmotion = emotion
    this.intensity = intensity
    this.emotionHoldTimer = 0

    if (emotion === 'happy') {
      this.targetSmileWeight = 0.8 * intensity
      this.targetSurpriseWeight = 0.05
      avatarStateService.setState('happy', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'excited') {
      this.targetSmileWeight = 0.95 * intensity
      this.targetSurpriseWeight = 0.35 * intensity
      this.targetHeadTilt = { x: 0.03, y: 0, z: 0.04 }
      avatarStateService.setState('excited', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'playful') {
      this.targetSmileWeight = 0.65 * intensity
      this.targetSurpriseWeight = 0.15
      this.targetHeadTilt = { x: 0.025, y: 0, z: 0.065 }
      avatarStateService.setState('playful', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'surprised') {
      this.targetSurpriseWeight = 0.85 * intensity
      this.targetSmileWeight = 0.25
      avatarStateService.setState('surprised', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'concerned') {
      this.targetThinkingWeight = 0.2 * intensity
      this.targetSmileWeight = 0.12
      this.targetSurpriseWeight = 0.08
      this.targetHeadTilt = { x: 0.03, y: 0.02, z: -0.05 }
      avatarStateService.setState('concerned', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'curious') {
      this.targetThinkingWeight = 0
      this.targetSurpriseWeight = 0.25 * intensity
      this.targetSmileWeight = 0.25 * intensity
      this.targetHeadTilt = { x: 0.035, y: 0.02, z: 0.085 }
      avatarStateService.setState('curious', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'thoughtful') {
      this.targetThinkingWeight = 0.8 * intensity
      this.targetSmileWeight = 0.05
      avatarStateService.setState('thinking', 'CompanionBehaviorEngine:setEmotion')
    } else if (emotion === 'greeting') {
      this.targetSmileWeight = 0.65
      this.triggerGesture('wave', 2.8)
    } else {
      this.targetSmileWeight = 0.15
      this.targetSurpriseWeight = 0
      this.targetThinkingWeight = 0
      avatarStateService.setState('idle', 'CompanionBehaviorEngine:setEmotion')
    }

    this.notifyState()
  }

  private emotionHoldTimer = 0
  private emotionHoldDuration = 4.0

  /**
   * Called on every animation frame to update gesture timings,
   * smooth transitions, and coordinate companion micro-behaviors.
   */
  public update(delta: number): void {
    // 0. Manage natural emotion hold duration and exit decay (Part 5: enter -> hold -> exit)
    if (this.currentEmotion !== 'neutral') {
      this.emotionHoldTimer += delta
      if (this.emotionHoldTimer >= this.emotionHoldDuration) {
        this.decayEmotion()
      }
    }

    // 1. Advance gesture timer and smooth blend weight
    if (this.activeGesture !== 'none') {
      this.gestureTimer += delta
      const progress = Math.min(1.0, this.gestureTimer / this.gestureDuration)

      // Bell-shaped curve for gesture weight (ease in 25%, hold 50%, ease out 25%)
      let targetWeight = 1.0
      if (progress < 0.25) {
        targetWeight = progress / 0.25
      } else if (progress > 0.75) {
        targetWeight = (1.0 - progress) / 0.25
      }

      this.gestureWeight += (targetWeight - this.gestureWeight) * Math.min(1.0, delta * 6.0)

      if (progress >= 1.0) {
        this.activeGesture = 'none'
        this.gestureWeight = 0
      }
    } else {
      this.gestureWeight = Math.max(0, this.gestureWeight - delta * 4.0)
    }

    // 2. Smoothly interpolate facial weights
    const lerpSpeed = Math.min(1.0, delta * 5.0)
    this.smileWeight += (this.targetSmileWeight - this.smileWeight) * lerpSpeed
    this.surpriseWeight += (this.targetSurpriseWeight - this.surpriseWeight) * lerpSpeed
    this.thinkingWeight += (this.targetThinkingWeight - this.thinkingWeight) * lerpSpeed

    // 3. Smoothly interpolate head tilt
    this.currentHeadTilt.x += (this.targetHeadTilt.x - this.currentHeadTilt.x) * lerpSpeed
    this.currentHeadTilt.y += (this.targetHeadTilt.y - this.currentHeadTilt.y) * lerpSpeed
    this.currentHeadTilt.z += (this.targetHeadTilt.z - this.currentHeadTilt.z) * lerpSpeed

    // 4. Smoothly interpolate eye gaze offset
    this.currentEyeGaze.x += (this.targetEyeGaze.x - this.currentEyeGaze.x) * lerpSpeed
    this.currentEyeGaze.y += (this.targetEyeGaze.y - this.currentEyeGaze.y) * lerpSpeed
  }

  private decayEmotion() {
    this.currentEmotion = 'neutral'
    this.targetSmileWeight = 0.18
    this.targetSurpriseWeight = 0
    this.targetThinkingWeight = 0
    this.targetHeadTilt = { x: 0, y: 0, z: 0 }
    this.targetEyeGaze = { x: 0, y: 0 }

    const currentState = avatarStateService.getState()
    if (
      currentState !== 'speaking' &&
      currentState !== 'listening' &&
      currentState !== 'thinking' &&
      currentState !== 'interrupted'
    ) {
      avatarStateService.setState('idle', 'CompanionBehaviorEngine:decayEmotion')
    }
  }

  private resetGestures() {
    this.activeGesture = 'none'
    this.gestureWeight = 0
    this.decayEmotion()
  }

  // ─── Accessors for Avatar Controllers ──────────────────────────────────────

  public getState(): CompanionState {
    const progress = this.gestureDuration > 0 ? this.gestureTimer / this.gestureDuration : 0
    return {
      emotion: this.currentEmotion,
      intent: this.currentIntent,
      intensity: this.intensity,
      activeGesture: this.activeGesture,
      gestureProgress: Math.min(1.0, progress),
      gestureWeight: this.gestureWeight,
      smileWeight: this.smileWeight,
      surpriseWeight: this.surpriseWeight,
      thinkingWeight: this.thinkingWeight,
      headTilt: this.currentHeadTilt,
      eyeGazeOffset: this.currentEyeGaze,
    }
  }

  public subscribe(listener: CompanionStateListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyState() {
    const state = this.getState()
    for (const listener of this.listeners) {
      try {
        listener(state)
      } catch (err) {
        console.error('[CompanionBehaviorEngine] Error notifying listener:', err)
      }
    }
  }

  public dispose() {
    this.cleanupFns.forEach((fn) => fn())
    this.cleanupFns = []
    this.listeners.clear()
  }
}

export const companionBehaviorEngine = new CompanionBehaviorEngine()
