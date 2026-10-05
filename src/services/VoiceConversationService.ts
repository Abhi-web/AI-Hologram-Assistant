// ─── Voice Conversation Service ─────────────────────────────────────────────
// Dedicated orchestrator for hands-free voice dialogue with ARIA.
// Supports continuous turn-taking, interruption/barge-in, wake-word activation,
// silence detection, echo feedback suppression, and avatar synchronization.

import { voiceInputService } from './VoiceInputService'
import { textToSpeechService, SentenceChunker, type TTSLifecycleListener } from './TextToSpeechService'
import { chatService } from './ChatService'
import { avatarStateService } from './AvatarStateService'
import { companionBehaviorEngine } from './CompanionBehaviorEngine'
import type { Message } from '../types'

export type VoiceConversationMode = 'off' | 'continuous' | 'wake_word'

export type VoiceConversationState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'error'

export interface VoiceConversationEvent {
  mode: VoiceConversationMode
  state: VoiceConversationState
  stage?: VoiceConversationState
  hypothesis: string
  transcript?: string
  lastUserSpeech: string | null
  lastAssistantSpeech: string | null
  audioLevel: number // 0.0 to 1.0 (live mic energy)
  wakeWordDetected: boolean
  errorMessage: string | null
}

export type VoiceConversationListener = (event: VoiceConversationEvent) => void

export interface VoiceTurnMessageCallback {
  onUserMessage: (userText: string) => void
  onAssistantMessage: (assistantText: string) => void
}

const DEFAULT_WAKE_WORDS = ['hey aria', 'aria', 'hello aria', 'hi aria', 'ok aria']

export class VoiceConversationService {
  private mode: VoiceConversationMode = 'off'
  private state: VoiceConversationState = 'idle'
  private hypothesis = ''
  private lastUserSpeech: string | null = null
  private lastAssistantSpeech: string | null = null
  private errorMessage: string | null = null
  private audioLevel = 0

  private listeners: Set<VoiceConversationListener> = new Set()
  private messageCallbacks: Set<VoiceTurnMessageCallback> = new Set()

  // Loop control
  private isLoopRunning = false
  private abortController: AbortController | null = null
  private isInterrupted = false
  private isDestroyed = false

  // Audio energy / Barge-in monitor
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private analyserNode: AnalyserNode | null = null
  private energyCheckInterval: number | null = null
  private consecutiveBargeInFrames = 0

  // Guard against echo loops
  private recentSpokenTexts: string[] = []
  private refractoryEndTime = 0

  constructor() {
    this.setupTTSHooks()
  }

  private setupTTSHooks(): void {
    const ttsListener: TTSLifecycleListener = {
      onStart: (data) => {
        if (this.mode !== 'off' && (this.state === 'processing' || this.state === 'speaking')) {
          this.setState('speaking')
          this.recentSpokenTexts.push(data.text.toLowerCase().trim())
          if (this.recentSpokenTexts.length > 5) {
            this.recentSpokenTexts.shift()
          }
        }
      },
      onEnd: () => {
        if (this.mode !== 'off' && this.state === 'speaking') {
          // Refractory period of 500ms after speech ends to prevent acoustic feedback
          this.refractoryEndTime = performance.now() + 500
          this.onSpeechFinished()
        }
      },
      onStop: () => {
        if (this.mode !== 'off' && this.state === 'speaking') {
          this.refractoryEndTime = performance.now() + 300
        }
      },
      onError: () => {
        if (this.mode !== 'off' && this.state === 'speaking') {
          this.onSpeechFinished()
        }
      },
    }

    textToSpeechService.addLifecycleListener(ttsListener)
  }

  // ─── Mode Controls ────────────────────────────────────────────────────────

  public getMode(): VoiceConversationMode {
    return this.mode
  }

  public getState(): VoiceConversationState {
    return this.state
  }

  public getSnapshot(): VoiceConversationEvent {
    return {
      mode: this.mode,
      state: this.state,
      stage: this.state,
      hypothesis: this.hypothesis,
      transcript: this.hypothesis || this.lastUserSpeech || '',
      lastUserSpeech: this.lastUserSpeech,
      lastAssistantSpeech: this.lastAssistantSpeech,
      audioLevel: this.audioLevel,
      wakeWordDetected: false,
      errorMessage: this.errorMessage,
    }
  }

  public interrupt(source = 'manual'): void {
    this.isInterrupted = true
    textToSpeechService.stop()
    voiceInputService.stopListening()
    this.setState('interrupted')
    avatarStateService.setState('interrupted', `VoiceConversation:${source}`)
  }

  public getIsInterrupted(): boolean {
    return this.isInterrupted
  }

  public setMode(mode: VoiceConversationMode): void {
    if (this.mode === mode) return
    console.log('[VoiceConversation] Mode changing from', this.mode, 'to', mode)
    this.mode = mode

    if (mode === 'off') {
      this.stopConversationLoop()
      this.setState('idle')
      avatarStateService.setState('idle', 'VoiceConversation:off')
    } else {
      this.startConversationLoop()
    }

    this.notify()
  }

  public toggleMode(): VoiceConversationMode {
    const nextMode: VoiceConversationMode =
      this.mode === 'off' ? 'continuous' : this.mode === 'continuous' ? 'wake_word' : 'off'
    this.setMode(nextMode)
    return nextMode
  }

  // ─── Subscriptions & Event Hooks ──────────────────────────────────────────

  public subscribe(listener: VoiceConversationListener): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  public registerMessageCallback(callback: VoiceTurnMessageCallback): () => void {
    this.messageCallbacks.add(callback)
    return () => {
      this.messageCallbacks.delete(callback)
    }
  }

  private notify(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[VoiceConversation] Listener error:', err)
      }
    }
  }

  private setState(state: VoiceConversationState, error: string | null = null): void {
    this.state = state
    this.errorMessage = error
    this.notify()
  }

  // ─── Audio Energy & Barge-in Monitor ───────────────────────────────────────

  private async startAudioMonitor(): Promise<boolean> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return true
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) {
        return false
      }

      this.audioContext = new AudioCtx()
      // Acoustic echo cancellation and noise suppression are mandatory for barge-in
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      source.connect(this.analyserNode)

      const buffer = new Uint8Array(this.analyserNode.frequencyBinCount)

      this.energyCheckInterval = window.setInterval(() => {
        if (!this.analyserNode) return
        this.analyserNode.getByteFrequencyData(buffer)

        let sum = 0
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i]
        }
        const level = sum / (buffer.length * 255)
        this.audioLevel = Math.min(1.0, level * 2.0)

        // ─── Barge-in Detection during Speaking ───
        if (this.state === 'speaking' && performance.now() > this.refractoryEndTime) {
          // If user speaks loudly over TTS audio (calibrated energy threshold)
          if (level > 0.14) {
            this.consecutiveBargeInFrames++
            if (this.consecutiveBargeInFrames >= 3) {
              console.log('[VoiceConversation] Barge-in triggered! User interrupted ARIA.')
              this.handleBargeIn()
            }
          } else {
            this.consecutiveBargeInFrames = Math.max(0, this.consecutiveBargeInFrames - 1)
          }
        } else {
          this.consecutiveBargeInFrames = 0
        }
      }, 50)

      return true
    } catch (err) {
      console.warn('[VoiceConversation] Could not start audio monitor for barge-in:', err)
      return false
    }
  }

  private stopAudioMonitor(): void {
    if (this.energyCheckInterval) {
      clearInterval(this.energyCheckInterval)
      this.energyCheckInterval = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
    this.analyserNode = null
    this.audioLevel = 0
  }

  // ─── Interruption / Barge-in Handler ───────────────────────────────────────

  public handleBargeIn(): void {
    if (this.state !== 'speaking') return

    this.isInterrupted = true
    // 1. Immediately cut off speech
    textToSpeechService.stop()

    // 2. Immediately stop avatar speech gestures & lip sync
    companionBehaviorEngine.setEmotion('neutral', 0.5)
    avatarStateService.setState('listening', 'VoiceConversation:bargeIn')

    // 3. Briefly mark as interrupted, then transition to listening
    this.setState('interrupted')
    setTimeout(() => {
      if (this.mode !== 'off' && this.state === 'interrupted') {
        this.isInterrupted = false
        this.runListeningTurn()
      }
    }, 180)
  }

  // ─── Continuous Conversation Loop ─────────────────────────────────────────

  private async startConversationLoop(): Promise<void> {
    if (this.isLoopRunning) return
    this.isLoopRunning = true
    this.isDestroyed = false

    await this.startAudioMonitor()
    this.runListeningTurn()
  }

  private stopConversationLoop(): void {
    this.isLoopRunning = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    voiceInputService.cancelListening().catch(() => {})
    this.stopAudioMonitor()
  }

  /**
   * Runs a single voice listening turn, then chains to AI processing and speaking.
   */
  private async runListeningTurn(): Promise<void> {
    if (!this.isLoopRunning || this.mode === 'off' || this.isDestroyed) {
      return
    }

    // Wait if we're in the refractory window to prevent acoustic feedback
    const waitTime = this.refractoryEndTime - performance.now()
    if (waitTime > 0) {
      await new Promise((r) => setTimeout(r, waitTime))
    }

    this.setState('listening')
    this.hypothesis = ''
    avatarStateService.setState('listening', 'VoiceConversation:listening')

    try {
      const recognized = await voiceInputService.startListening()

      if (!this.isLoopRunning || (this.mode as string) === 'off') {
        this.setState('idle')
        return
      }

      if (!recognized || !recognized.trim()) {
        // No speech detected in this turn -> small natural pause and listen again
        await new Promise((r) => setTimeout(r, 200))
        this.runListeningTurn()
        return
      }

      const cleanText = recognized.trim()

      // Feedback filter: check if this text matches what ARIA just said
      if (this.isEchoOfAssistant(cleanText)) {
        console.log('[VoiceConversation] Filtered out acoustic echo of assistant speech:', cleanText)
        await new Promise((r) => setTimeout(r, 200))
        this.runListeningTurn()
        return
      }

      // Handle Wake Word Mode
      if (this.mode === 'wake_word') {
        const parsed = this.parseWakeWord(cleanText)
        if (!parsed.hasWakeWord) {
          // No wake word detected; keep listening silently
          this.runListeningTurn()
          return
        }

        if (!parsed.promptText) {
          // User said only "Hey ARIA"
          this.lastUserSpeech = cleanText
          this.notify()
          await this.speakWakeAcknowledgement()
          return
        }

        // User said "Hey ARIA, [question]"
        await this.processUserSpeech(parsed.promptText)
        return
      }

      // Continuous Mode: directly process recognized speech
      await this.processUserSpeech(cleanText)
    } catch (err: unknown) {
      console.warn('[VoiceConversation] Error in listening turn:', err)
      const msg = err instanceof Error ? err.message : 'Listening error'
      this.setState('error', msg)
      await new Promise((r) => setTimeout(r, 1000))
      if ((this.mode as string) !== 'off') {
        this.runListeningTurn()
      }
    }
  }

  private isEchoOfAssistant(text: string): boolean {
    const lower = text.toLowerCase()
    return this.recentSpokenTexts.some((recent) => {
      if (recent === lower) return true
      if (recent.length > 15 && (recent.includes(lower) || lower.includes(recent))) return true
      return false
    })
  }

  private parseWakeWord(text: string): { hasWakeWord: boolean; promptText: string } {
    const lower = text.toLowerCase()
    for (const phrase of DEFAULT_WAKE_WORDS) {
      const regex = new RegExp(`^${phrase}[,!?:;.]?\\s*`, 'i')
      if (regex.test(lower)) {
        const remaining = text.replace(regex, '').trim()
        return { hasWakeWord: true, promptText: remaining }
      }
      if (lower.includes(phrase)) {
        const parts = text.split(new RegExp(phrase, 'i'))
        const remaining = (parts[1] || '').replace(/^[,!?:;.]*\s*/, '').trim()
        return { hasWakeWord: true, promptText: remaining }
      }
    }
    return { hasWakeWord: false, promptText: '' }
  }

  private async speakWakeAcknowledgement(): Promise<void> {
    this.setState('speaking')
    avatarStateService.setState('speaking', 'VoiceConversation:wakeAck')
    companionBehaviorEngine.setEmotion('greeting', 0.9)
    companionBehaviorEngine.triggerGesture('wave', 2.5)

    await textToSpeechService.speak("Yes, I'm listening! How can I help you?")
    // The TTS onEnd hook will naturally call onSpeechFinished() -> runs next listening turn
  }

  /**
   * Processes user speech: updates state to PROCESSING, streams AI response incrementally,
   * delivers first sentences to TextToSpeechService instantly without waiting for the full response,
   * and preserves conversation history WITHOUT typing anything into the manual text input box.
   */
  private async processUserSpeech(userText: string): Promise<void> {
    this.lastUserSpeech = userText
    this.setState('processing')
    avatarStateService.setState('thinking', 'VoiceConversation:processing')

    // Notify message callbacks (appends to UI conversation history cleanly)
    for (const cb of this.messageCallbacks) {
      try {
        cb.onUserMessage(userText)
      } catch {}
    }

    const controller = new AbortController()
    this.abortController = controller

    try {
      const userMessage: Message = {
        id: `voice-u-${Date.now()}`,
        role: 'user',
        content: userText,
        timestamp: new Date(),
      }

      // Ensure TextToSpeechService is enabled
      if (!textToSpeechService.isEnabled()) {
        textToSpeechService.setEnabled(true)
      }

      // Initialize sentence chunker for instant, low-latency streaming speech
      let hasStartedTTS = false
      textToSpeechService.startSentenceStream()

      const chunker = new SentenceChunker((sentence) => {
        if (!this.isLoopRunning || this.mode === 'off' || controller.signal.aborted) return

        if (!hasStartedTTS) {
          hasStartedTTS = true
          this.setState('speaking')
          avatarStateService.setState('speaking', 'VoiceConversation:speaking')
        }
        textToSpeechService.enqueueSentence(sentence)
      })

      let accumulatedResponse = ''

      // Stream response from active AI provider (Local Ollama or Cloud AI)
      const finalResponse = await chatService.streamMessage([userMessage], {
        signal: controller.signal,
        onChunk: (chunk: string) => {
          accumulatedResponse += chunk
          chunker.feed(chunk)
          for (const cb of this.messageCallbacks) {
            try {
              cb.onAssistantMessage(accumulatedResponse)
            } catch {}
          }
        },
      })

      if (!this.isLoopRunning || this.mode === 'off' || controller.signal.aborted) {
        textToSpeechService.stop()
        return
      }

      // Flush any remaining tokens to TTS
      chunker.flush()
      textToSpeechService.finishSentenceStream()

      this.abortController = null
      const fullText = finalResponse || accumulatedResponse
      this.lastAssistantSpeech = fullText

      if (!hasStartedTTS && fullText) {
        this.setState('speaking')
        avatarStateService.setState('speaking', 'VoiceConversation:speaking')
        await textToSpeechService.speak(fullText)
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        console.log('[VoiceConversation] Processing was aborted by user or barge-in.')
        return
      }
      console.error('[VoiceConversation] Error generating AI response:', err)
      this.abortController = null
      textToSpeechService.stop()
      const msg = err instanceof Error ? err.message : 'AI error'
      this.setState('error', msg)
      await new Promise((r) => setTimeout(r, 600))
      if (this.mode !== 'off') {
        this.runListeningTurn()
      }
    }
  }

  /**
   * Called when ARIA finishes speaking: waits a brief natural conversational pause
   * and automatically returns to listening.
   */
  private onSpeechFinished(): void {
    if (!this.isLoopRunning || this.mode === 'off' || this.isDestroyed) {
      this.setState('idle')
      avatarStateService.setState('idle', 'VoiceConversation:ended')
      return
    }

    // Natural 250ms breath/pause before ARIA resumes active listening
    setTimeout(() => {
      if (this.mode !== 'off' && (this.state === 'speaking' || this.state === 'interrupted')) {
        this.runListeningTurn()
      }
    }, 250)
  }

  public destroy(): void {
    this.isDestroyed = true
    this.stopConversationLoop()
    this.listeners.clear()
    this.messageCallbacks.clear()
  }
}

export const voiceConversationService = new VoiceConversationService()
