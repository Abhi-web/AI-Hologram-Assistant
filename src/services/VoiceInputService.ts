// ─── Voice Input Service & Speech-To-Text Abstraction ─────────────────────────
// Dedicated speech-to-text service abstraction for AI Hologram Assistant.
// Provider-independent: outputs pure text to the chat input without direct AI coupling.

export type VoiceState = 'Idle' | 'Requesting Permission' | 'Listening' | 'Processing' | 'Error'

export type VoiceStateListener = (
  state: VoiceState,
  errorMessage: string | null,
  hypothesis: string
) => void

/**
 * Speech-to-Text Engine Abstraction.
 * Allows decoupling different underlying STT implementations (Windows Native vs Browser Web Speech).
 */
export interface ISpeechToTextEngine {
  readonly id: string
  readonly name: string
  isSupported(): Promise<boolean> | boolean
  startListening(onHypothesis?: (text: string) => void): Promise<{ success: boolean; text?: string; error?: string }>
  stopListening(): Promise<void>
  cancelListening(): Promise<void>
}

// ─── 1. Windows Native Speech Engine (Offline System.Speech) ───────────────────

class WindowsNativeSpeechEngine implements ISpeechToTextEngine {
  public readonly id = 'windows-native'
  public readonly name = 'Windows Native Speech (System.Speech)'
  private hypothesisListener: (() => void) | null = null

  public isSupported(): boolean {
    return Boolean(typeof window !== 'undefined' && window.electronAPI?.voice)
  }

  public async startListening(
    onHypothesis?: (text: string) => void
  ): Promise<{ success: boolean; text?: string; error?: string }> {
    if (!window.electronAPI?.voice) {
      return { success: false, error: 'Electron voice IPC is not available.' }
    }

    if (onHypothesis && window.electronAPI.voice.onHypothesis) {
      this.hypothesisListener = window.electronAPI.voice.onHypothesis(onHypothesis)
    }

    try {
      const result = await window.electronAPI.voice.startListening()
      return result
    } finally {
      if (this.hypothesisListener) {
        this.hypothesisListener()
        this.hypothesisListener = null
      }
    }
  }

  public async stopListening(): Promise<void> {
    if (window.electronAPI?.voice) {
      await window.electronAPI.voice.stopListening()
    }
  }

  public async cancelListening(): Promise<void> {
    if (window.electronAPI?.voice) {
      await window.electronAPI.voice.cancelListening()
    }
  }
}

// ─── 2. Web Speech API Engine (Fallback for Web Browsers) ─────────────────────

interface WebSpeechResultItem {
  transcript: string
}
interface WebSpeechResult {
  [index: number]: WebSpeechResultItem
  isFinal: boolean
}
interface WebSpeechResultList {
  [index: number]: WebSpeechResult
  length: number
}
interface WebSpeechEvent {
  resultIndex: number
  results: WebSpeechResultList
}
interface WebSpeechErrorEvent {
  error: string
  message?: string
}

interface WebSpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: WebSpeechEvent) => void) | null
  onerror: ((event: WebSpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop?: () => void
  abort?: () => void
}

class WebSpeechEngine implements ISpeechToTextEngine {
  public readonly id = 'web-speech'
  public readonly name = 'Browser Web Speech API'
  private activeRecognition: WebSpeechRecognitionInstance | null = null

  private getRecognitionConstructor(): (new () => WebSpeechRecognitionInstance) | null {
    if (typeof window === 'undefined') return null
    const win = window as unknown as {
      SpeechRecognition?: new () => WebSpeechRecognitionInstance
      webkitSpeechRecognition?: new () => WebSpeechRecognitionInstance
    }
    return win.SpeechRecognition || win.webkitSpeechRecognition || null
  }

  public isSupported(): boolean {
    return Boolean(this.getRecognitionConstructor())
  }

  public startListening(
    onHypothesis?: (text: string) => void
  ): Promise<{ success: boolean; text?: string; error?: string }> {
    const SpeechRecognitionClass = this.getRecognitionConstructor()
    if (!SpeechRecognitionClass) {
      return Promise.resolve({
        success: false,
        error: 'Web Speech API is not supported in this browser.',
      })
    }

    return new Promise((resolve) => {
      let silenceTimer: ReturnType<typeof setTimeout> | null = null

      try {
        const recognition = new SpeechRecognitionClass()
        this.activeRecognition = recognition
        recognition.lang = 'en-US'
        recognition.continuous = false
        recognition.interimResults = true

        let finalTranscript = ''
        let lastInterim = ''

        const resetSilenceTimer = () => {
          if (silenceTimer) clearTimeout(silenceTimer)
          // 650ms natural silence timeout: stops waiting as soon as user completes speaking
          silenceTimer = setTimeout(() => {
            if (this.activeRecognition && (finalTranscript.trim() || lastInterim.trim())) {
              try {
                this.activeRecognition.stop?.()
              } catch {}
            }
          }, 650)
        }

        recognition.onresult = (event: WebSpeechEvent) => {
          let interim = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += piece
            } else {
              interim += piece
            }
          }
          lastInterim = interim
          if (onHypothesis) {
            onHypothesis(interim || finalTranscript)
          }
          resetSilenceTimer()
        }

        recognition.onerror = (event: WebSpeechErrorEvent) => {
          if (silenceTimer) clearTimeout(silenceTimer)
          console.warn('[WebSpeechEngine] Recognition error:', event.error)
          this.activeRecognition = null
          if (event.error === 'no-speech') {
            resolve({ success: false, error: 'no-speech' })
          } else if (event.error === 'not-allowed') {
            resolve({ success: false, error: 'not-allowed' })
          } else if (event.error === 'network') {
            resolve({
              success: false,
              error: 'Web Speech network error. Please use the Electron app for local speech recognition.',
            })
          } else {
            resolve({ success: false, error: event.error })
          }
        }

        recognition.onend = () => {
          if (silenceTimer) clearTimeout(silenceTimer)
          this.activeRecognition = null
          const text = (finalTranscript || lastInterim).trim()
          if (text) {
            resolve({ success: true, text })
          } else {
            resolve({ success: false, error: 'no-speech' })
          }
        }

        recognition.start()
      } catch (err: unknown) {
        if (silenceTimer) clearTimeout(silenceTimer)
        this.activeRecognition = null
        const msg = err instanceof Error ? err.message : 'Failed to start Web Speech.'
        resolve({ success: false, error: msg })
      }
    })
  }

  public async stopListening(): Promise<void> {
    if (this.activeRecognition?.stop) {
      try {
        this.activeRecognition.stop()
      } catch {}
    }
  }

  public async cancelListening(): Promise<void> {
    if (this.activeRecognition?.abort) {
      try {
        this.activeRecognition.abort()
      } catch {}
    }
    this.activeRecognition = null
  }
}

// ─── 3. VoiceInputService (Service Layer) ─────────────────────────────────────

export class VoiceInputService {
  private state: VoiceState = 'Idle'
  private errorMessage: string | null = null
  private hypothesis: string = ''
  private listeners: Set<VoiceStateListener> = new Set()
  private errorResetTimeout: NodeJS.Timeout | null = null

  private nativeEngine = new WindowsNativeSpeechEngine()
  private webSpeechEngine = new WebSpeechEngine()
  private permissionGranted = false

  /**
   * Retrieves the current voice engine in use.
   */
  public getActiveEngine(): ISpeechToTextEngine {
    if (this.nativeEngine.isSupported()) {
      return this.nativeEngine
    }
    return this.webSpeechEngine
  }

  // ─── State & Event Subscription ───────────────────────────────────────────

  public getState(): VoiceState {
    return this.state
  }

  public getErrorMessage(): string | null {
    return this.errorMessage
  }

  public getHypothesis(): string {
    return this.hypothesis
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener)
    listener(this.state, this.errorMessage, this.hypothesis)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(newState: VoiceState, error: string | null = null): void {
    this.state = newState
    this.errorMessage = error

    if (this.errorResetTimeout) {
      clearTimeout(this.errorResetTimeout)
      this.errorResetTimeout = null
    }

    // Auto-clear error back to Idle after 4 seconds
    if (newState === 'Error') {
      this.errorResetTimeout = setTimeout(() => {
        if (this.state === 'Error') {
          this.state = 'Idle'
          this.errorMessage = null
          this.hypothesis = ''
          this.notifyListeners()
        }
      }, 4000)
    }

    if (newState === 'Idle') {
      this.hypothesis = ''
    }

    this.notifyListeners()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, this.errorMessage, this.hypothesis)
      } catch (err) {
        console.error('[VoiceInputService] Error in listener callback:', err)
      }
    }
  }

  // ─── Microphone Permission & Hardware Verification ────────────────────────

  public async requestPermission(): Promise<boolean> {
    if (this.permissionGranted) return true

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setState('Error', 'Audio input is not supported in this environment.')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Release tracks immediately
      stream.getTracks().forEach((track) => track.stop())
      this.permissionGranted = true
      return true
    } catch (err: unknown) {
      console.warn('[VoiceInputService] getUserMedia failed:', err)
      if (err && typeof err === 'object' && 'name' in err) {
        const errorName = (err as { name: string }).name
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          this.setState('Error', 'Microphone access denied. Please grant microphone permissions.')
          return false
        }
        if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          this.setState('Error', 'Microphone unavailable. Please connect an audio input device.')
          return false
        }
      }
      this.setState('Error', 'Unable to access microphone. Please check your system settings.')
      return false
    }
  }

  // ─── Voice Recognition Lifecycle ──────────────────────────────────────────

  /**
   * Starts speech recognition.
   * Resolves with the recognized text, or null if cancelled / no speech.
   */
  public async startListening(): Promise<string | null> {
    if (this.state === 'Listening' || this.state === 'Requesting Permission') {
      return null
    }

    this.hypothesis = ''
    this.setState('Requesting Permission')

    const hasPermission = await this.requestPermission()
    if (!hasPermission) {
      return null
    }

    const engine = this.getActiveEngine()
    const supported = await engine.isSupported()
    if (!supported) {
      this.setState(
        'Error',
        'Speech recognition requires the Electron desktop app or a supported browser.'
      )
      return null
    }

    this.setState('Listening')

    try {
      const result = await engine.startListening((text) => {
        this.hypothesis = text
        this.notifyListeners()
      })

      if (result.success && result.text) {
        this.setState('Processing')
        const recognized = result.text.trim()
        this.setState('Idle')
        return recognized
      }

      if (result.error === 'cancelled') {
        this.setState('Idle')
        return null
      }

      if (result.error === 'no-speech') {
        this.setState('Error', 'No speech detected. Please speak clearly into the microphone.')
        return null
      }

      if (result.error === 'not-allowed') {
        this.setState('Error', 'Microphone access denied. Please grant microphone permissions.')
        return null
      }

      this.setState('Error', result.error || 'Speech recognition failed.')
      return null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speech recognition encountered an error.'
      this.setState('Error', msg)
      return null
    }
  }

  /**
   * Stops listening and finalizes the recognized speech.
   */
  public async stopListening(): Promise<void> {
    if (this.state !== 'Listening') return
    this.setState('Processing')
    await this.getActiveEngine().stopListening()
  }

  /**
   * Cancels listening and returns immediately to Idle without returning text.
   */
  public async cancelListening(): Promise<void> {
    if (this.state !== 'Listening' && this.state !== 'Requesting Permission') {
      return
    }
    await this.getActiveEngine().cancelListening()
    this.hypothesis = ''
    this.setState('Idle')
  }

  public destroy(): void {
    if (this.errorResetTimeout) {
      clearTimeout(this.errorResetTimeout)
      this.errorResetTimeout = null
    }
    this.listeners.clear()
  }
}

// Global singleton instance
export const voiceInputService = new VoiceInputService()

