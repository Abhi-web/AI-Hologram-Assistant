// ─── Text-to-Speech Service & Abstraction ───────────────────────────────────
// Dedicated service abstraction for AI Voice Output / Text-to-Speech.
// Provider-independent: converts completed AI text responses into spoken audio
// using local Windows-compatible system voices (SpeechSynthesis).

export type TTSState = 'Disabled' | 'Ready' | 'Speaking' | 'Stopped' | 'Error'

export interface TTSVoice {
  name: string
  lang: string
  voiceURI: string
  default: boolean
  localService: boolean
}

export type TTSListener = (
  state: TTSState,
  currentVoice: string | null,
  errorMessage: string | null
) => void

export interface TTSAudioProgress {
  charIndex: number
  charLength?: number
  name?: string
  elapsedTime?: number
  spokenText: string
}

export interface TTSLifecycleListener {
  onStart?: (data: { text: string }) => void
  onAudioProgress?: (progress: TTSAudioProgress) => void
  onEnd?: () => void
  onStop?: () => void
  onError?: (error: string) => void
}

export interface ITextToSpeechEngine {
  readonly id: string
  readonly name: string
  isSupported(): boolean
  getVoices(): Promise<TTSVoice[]>
  speak(
    text: string,
    options?: {
      voiceURI?: string | null
      rate?: number
      pitch?: number
      onStart?: (text: string) => void
      onBoundary?: (charIndex: number, charLength?: number, name?: string, elapsedTime?: number) => void
      onEnd?: () => void
      onError?: (err: string) => void
    }
  ): Promise<void>
  stop(): void
  pause(): void
  resume(): void
}

// ─── Text Sanitizer for Natural Speech ────────────────────────────────────────

/**
 * Strips markdown markup, code blocks, URLs, and noisy symbols so the TTS
 * engine produces natural, pleasant conversational speech.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  if (!rawText) return ''

  let text = rawText

  // 1. Replace multi-line code blocks with brief spoken indicator
  text = text.replace(/```[\s\S]*?```/g, ' [code block omitted] ')

  // 2. Replace inline code `code` with just the code content
  text = text.replace(/`([^`]+)`/g, '$1')

  // 3. Remove markdown URLs [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 4. Remove standalone URLs
  text = text.replace(/https?:\/\/\S+/g, 'link')

  // 5. Remove markdown headers (#, ##, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 6. Remove bold / italics (*, **, _, __)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')

  // 7. Remove list bullet asterisks / dashes at line starts
  text = text.replace(/^\s*[-*+]\s+/gm, '')

  // 8. Remove blockquotes (> quote)
  text = text.replace(/^\s*>\s+/gm, '')

  // 9. Normalize multiple newlines and extra spaces
  text = text.replace(/\n+/g, '. ')
  text = text.replace(/\s{2,}/g, ' ')

  return text.trim()
}

// ─── Sentence Chunker for Streaming Low-Latency TTS ──────────────────────────

/**
 * SentenceChunker — Buffers streaming LLM tokens and extracts complete, safe sentences
 * to immediately dispatch to TextToSpeechService without waiting for the entire LLM response.
 */
export class SentenceChunker {
  private buffer = ''
  private onSentence: (sentence: string) => void

  constructor(onSentence: (sentence: string) => void) {
    this.onSentence = onSentence
  }

  public feed(chunk: string): void {
    this.buffer += chunk

    // Look for sentence boundaries (. ! ? \n) followed by whitespace, or paragraph break (\n\n)
    const boundaryPattern = /([.!?]+(?:\s+|\n+)|\n\n+)/
    let match = boundaryPattern.exec(this.buffer)

    while (match) {
      const splitIdx = match.index + match[0].length
      const candidate = this.buffer.slice(0, splitIdx).trim()
      this.buffer = this.buffer.slice(splitIdx)

      if (candidate.length > 0) {
        this.onSentence(candidate)
      }
      match = boundaryPattern.exec(this.buffer)
    }
  }

  public flush(): void {
    const remaining = this.buffer.trim()
    this.buffer = ''
    if (remaining.length > 0) {
      this.onSentence(remaining)
    }
  }

  public reset(): void {
    this.buffer = ''
  }
}

// ─── 1. Web Speech Synthesis Engine (Local Windows SAPI / OneCore Voices) ────

class WebSpeechSynthesisEngine implements ITextToSpeechEngine {
  public readonly id = 'web-speech-synthesis'
  public readonly name = 'Windows System Speech Synthesis'
  private cachedVoices: TTSVoice[] = []

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  public getVoices(): Promise<TTSVoice[]> {
    if (!this.isSupported()) {
      return Promise.resolve([])
    }

    const synth = window.speechSynthesis
    const available = synth.getVoices()

    if (available && available.length > 0) {
      this.cachedVoices = available.map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        default: v.default,
        localService: v.localService,
      }))
      return Promise.resolve(this.cachedVoices)
    }

    return new Promise((resolve) => {
      let resolved = false

      const updateVoices = () => {
        if (resolved) return
        const voices = synth.getVoices()
        if (voices.length > 0) {
          resolved = true
          this.cachedVoices = voices.map((v) => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            default: v.default,
            localService: v.localService,
          }))
          synth.removeEventListener('voiceschanged', updateVoices)
          resolve(this.cachedVoices)
        }
      }

      synth.addEventListener('voiceschanged', updateVoices)

      // Fallback timeout in case voiceschanged already fired
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          synth.removeEventListener('voiceschanged', updateVoices)
          const fallbackVoices = synth.getVoices().map((v) => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            default: v.default,
            localService: v.localService,
          }))
          this.cachedVoices = fallbackVoices
          resolve(fallbackVoices)
        }
      }, 500)
    })
  }

  public speak(
    text: string,
    options?: {
      voiceURI?: string | null
      rate?: number
      pitch?: number
      onStart?: (text: string) => void
      onBoundary?: (charIndex: number, charLength?: number, name?: string, elapsedTime?: number) => void
      onEnd?: () => void
      onError?: (err: string) => void
    }
  ): Promise<void> {
    if (!this.isSupported()) {
      return Promise.reject(new Error('SpeechSynthesis is not supported in this environment.'))
    }

    const clean = sanitizeTextForSpeech(text)
    if (!clean) {
      return Promise.resolve()
    }

    const synth = window.speechSynthesis

    // Ensure any previous speech is completely halted
    synth.cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.rate = options?.rate ?? 1.0
      utterance.pitch = options?.pitch ?? 1.0

      // Match chosen voice if provided
      if (options?.voiceURI) {
        const voices = synth.getVoices()
        const matched = voices.find((v) => v.voiceURI === options.voiceURI || v.name === options.voiceURI)
        if (matched) {
          utterance.voice = matched
        }
      }

      utterance.onstart = () => {
        options?.onStart?.(clean)
      }

      utterance.onboundary = (event) => {
        options?.onBoundary?.(event.charIndex, event.charLength, event.name, event.elapsedTime)
      }

      utterance.onend = () => {
        options?.onEnd?.()
        resolve()
      }

      utterance.onerror = (event) => {
        // 'canceled' or 'interrupted' is expected when user clicks Stop or speaks new message
        if (event.error === 'canceled' || event.error === 'interrupted') {
          options?.onEnd?.()
          resolve()
        } else {
          console.warn('[WebSpeechSynthesisEngine] Utterance error:', event.error)
          options?.onError?.(event.error)
          reject(new Error(`Speech synthesis failed: ${event.error}`))
        }
      }

      synth.speak(utterance)
    })
  }

  public stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel()
    }
  }

  public pause(): void {
    if (this.isSupported()) {
      window.speechSynthesis.pause()
    }
  }

  public resume(): void {
    if (this.isSupported()) {
      window.speechSynthesis.resume()
    }
  }
}

// ─── 2. TextToSpeechService (Orchestrator & State Management) ─────────────────

const STORAGE_KEY = 'aria_tts_settings'

interface StoredTTSSettings {
  enabled: boolean
  voiceURI: string | null
  rate: number
  pitch: number
}

export class TextToSpeechService {
  private state: TTSState = 'Ready'
  private errorMessage: string | null = null
  private listeners: Set<TTSListener> = new Set()
  private lifecycleListeners: Set<TTSLifecycleListener> = new Set()
  private engine: ITextToSpeechEngine

  // Settings
  private enabled = true
  private selectedVoiceURI: string | null = null
  private rate = 1.0
  private pitch = 1.0

  // Guard against overlapping speak calls
  private currentSpeakPromise: Promise<void> | null = null

  constructor(engine: ITextToSpeechEngine = new WebSpeechSynthesisEngine()) {
    this.engine = engine
    this.loadSettings()
    this.state = this.enabled ? 'Ready' : 'Disabled'
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private loadSettings(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredTTSSettings>
        if (typeof parsed.enabled === 'boolean') {
          this.enabled = parsed.enabled
        }
        if (parsed.voiceURI) {
          this.selectedVoiceURI = parsed.voiceURI
        }
        if (typeof parsed.rate === 'number') {
          this.rate = parsed.rate
        }
        if (typeof parsed.pitch === 'number') {
          this.pitch = parsed.pitch
        }
      }
    } catch (err) {
      console.warn('[TextToSpeechService] Failed to load TTS settings from localStorage:', err)
    }
  }

  private saveSettings(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return
      const toSave: StoredTTSSettings = {
        enabled: this.enabled,
        voiceURI: this.selectedVoiceURI,
        rate: this.rate,
        pitch: this.pitch,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch (err) {
      console.warn('[TextToSpeechService] Failed to save TTS settings to localStorage:', err)
    }
  }

  // ─── Settings Accessors ───────────────────────────────────────────────────

  public isEnabled(): boolean {
    return this.enabled
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.saveSettings()

    if (!enabled) {
      this.stop()
      this.setState('Disabled')
    } else {
      this.setState('Ready')
    }
  }

  public getSelectedVoice(): string | null {
    return this.selectedVoiceURI
  }

  public setSelectedVoice(voiceURI: string | null): void {
    this.selectedVoiceURI = voiceURI
    this.saveSettings()
    this.notifyListeners()
  }

  public getRate(): number {
    return this.rate
  }

  public setRate(rate: number): void {
    this.rate = rate
    this.saveSettings()
  }

  public getPitch(): number {
    return this.pitch
  }

  public setPitch(pitch: number): void {
    this.pitch = pitch
    this.saveSettings()
  }

  // ─── Voices & Engine ───────────────────────────────────────────────────────

  public async getVoices(): Promise<TTSVoice[]> {
    return await this.engine.getVoices()
  }

  public getActiveEngineName(): string {
    return this.engine.name
  }

  // ─── State & Event Subscription ───────────────────────────────────────────

  public getState(): TTSState {
    return this.state
  }

  public getErrorMessage(): string | null {
    return this.errorMessage
  }

  public subscribe(listener: TTSListener): () => void {
    this.listeners.add(listener)
    listener(this.state, this.selectedVoiceURI, this.errorMessage)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public addLifecycleListener(listener: TTSLifecycleListener): () => void {
    this.lifecycleListeners.add(listener)
    return () => {
      this.lifecycleListeners.delete(listener)
    }
  }

  private notifyStart(text: string): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener.onStart?.({ text })
      } catch (err) {
        console.error('[TextToSpeechService] Error in onStart listener:', err)
      }
    }
  }

  private notifyAudioProgress(progress: TTSAudioProgress): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener.onAudioProgress?.(progress)
      } catch (err) {
        console.error('[TextToSpeechService] Error in onAudioProgress listener:', err)
      }
    }
  }

  private notifyEnd(): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener.onEnd?.()
      } catch (err) {
        console.error('[TextToSpeechService] Error in onEnd listener:', err)
      }
    }
  }

  private notifyStop(): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener.onStop?.()
      } catch (err) {
        console.error('[TextToSpeechService] Error in onStop listener:', err)
      }
    }
  }

  private notifyError(error: string): void {
    for (const listener of this.lifecycleListeners) {
      try {
        listener.onError?.(error)
      } catch (err) {
        console.error('[TextToSpeechService] Error in onError listener:', err)
      }
    }
  }

  private setState(newState: TTSState, error: string | null = null): void {
    this.state = newState
    this.errorMessage = error
    this.notifyListeners()
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, this.selectedVoiceURI, this.errorMessage)
      } catch (err) {
        console.error('[TextToSpeechService] Error in listener callback:', err)
      }
    }
  }

  // ─── Speech Lifecycle Operations ──────────────────────────────────────────

  /**
   * Speaks the provided text if TTS is enabled.
   * Automatically stops any current utterance to prevent overlapping speech.
   */
  public async speak(text: string): Promise<void> {
    if (!this.enabled) {
      this.setState('Disabled')
      return
    }

    if (!text || !text.trim()) {
      return
    }

    // 1. Immediately stop any active speech to prevent overlap
    this.stop()

    this.setState('Speaking')
    this.notifyStart(text)

    const speakPromise = this.engine.speak(text, {
      voiceURI: this.selectedVoiceURI,
      rate: this.rate,
      pitch: this.pitch,
      onStart: (spokenText) => {
        this.notifyStart(spokenText)
      },
      onBoundary: (charIndex, charLength, name, elapsedTime) => {
        this.notifyAudioProgress({
          charIndex,
          charLength,
          name,
          elapsedTime,
          spokenText: text,
        })
      },
      onEnd: () => {
        this.notifyEnd()
      },
      onError: (errMsg) => {
        this.notifyError(errMsg)
      },
    })

    this.currentSpeakPromise = speakPromise

    try {
      await speakPromise
      // If this was the active speech, return to Ready
      if (this.currentSpeakPromise === speakPromise) {
        this.currentSpeakPromise = null
        this.setState(this.enabled ? 'Ready' : 'Disabled')
      }
    } catch (err: unknown) {
      if (this.currentSpeakPromise === speakPromise) {
        this.currentSpeakPromise = null
        const msg = err instanceof Error ? err.message : 'Text-to-Speech playback encountered an error.'
        this.setState('Error', msg)

        // Clear error after 4 seconds
        setTimeout(() => {
          if (this.state === 'Error') {
            this.setState(this.enabled ? 'Ready' : 'Disabled')
          }
        }, 4000)
      }
    }
  }

  // ─── Sentence Streaming Queue (Zero-Latency Incremental TTS) ───────────────

  private sentenceQueue: string[] = []
  private isProcessingQueue = false
  private isStreamActive = false
  private queueAbortController: AbortController | null = null

  /**
   * Begins a low-latency sentence streaming session.
   * Clears old queue, cancels any previous speech, and primes the engine.
   */
  public startSentenceStream(): void {
    if (!this.enabled) return
    this.stop()
    this.sentenceQueue = []
    this.isStreamActive = true
    this.isProcessingQueue = false
    this.queueAbortController = new AbortController()
  }

  /**
   * Enqueues an incremental sentence from the LLM token stream.
   * If not already speaking, speech synthesis begins immediately.
   */
  public enqueueSentence(sentence: string): void {
    if (!this.enabled) return
    const clean = sanitizeTextForSpeech(sentence)
    if (!clean || clean.length === 0) return

    this.sentenceQueue.push(clean)
    if (!this.isProcessingQueue) {
      this.processSentenceQueue()
    }
  }

  /**
   * Finalizes the current sentence streaming session.
   * Once the queued sentences finish, transitions state back to Ready.
   */
  public finishSentenceStream(): void {
    this.isStreamActive = false
    if (!this.isProcessingQueue && this.sentenceQueue.length === 0) {
      if (this.state === 'Speaking') {
        this.setState(this.enabled ? 'Ready' : 'Disabled')
        this.notifyEnd()
      }
    }
  }

  private async processSentenceQueue(): Promise<void> {
    if (this.isProcessingQueue) return
    this.isProcessingQueue = true

    if (this.state !== 'Speaking') {
      this.setState('Speaking')
    }

    while (this.sentenceQueue.length > 0) {
      const text = this.sentenceQueue.shift()
      if (!text || this.queueAbortController?.signal.aborted) break

      this.notifyStart(text)

      try {
        await this.engine.speak(text, {
          voiceURI: this.selectedVoiceURI,
          rate: this.rate,
          pitch: this.pitch,
          onStart: (spokenText) => {
            this.notifyStart(spokenText)
          },
          onBoundary: (charIndex, charLength, name, elapsedTime) => {
            this.notifyAudioProgress({
              charIndex,
              charLength,
              name,
              elapsedTime,
              spokenText: text,
            })
          },
          onError: (errMsg) => {
            this.notifyError(errMsg)
          },
        })
      } catch (err) {
        console.warn('[TextToSpeechService] Error speaking queued sentence:', err)
      }

      if (this.queueAbortController?.signal.aborted) {
        break
      }
    }

    this.isProcessingQueue = false

    // If more sentences were queued while the previous one was speaking, continue
    if (this.sentenceQueue.length > 0) {
      this.processSentenceQueue()
      return
    }

    // Stream is done and all queued sentences are finished
    if (!this.isStreamActive) {
      this.setState(this.enabled ? 'Ready' : 'Disabled')
      this.notifyEnd()
    }
  }

  /**
   * Halts active speech immediately.
   */
  public stop(): void {
    if (this.queueAbortController) {
      this.queueAbortController.abort()
      this.queueAbortController = null
    }
    this.sentenceQueue = []
    this.isStreamActive = false
    this.isProcessingQueue = false
    this.currentSpeakPromise = null
    this.engine.stop()
    this.notifyStop()
    if (this.enabled) {
      this.setState('Stopped')
      setTimeout(() => {
        if (this.state === 'Stopped') {
          this.setState('Ready')
        }
      }, 100)
    } else {
      this.setState('Disabled')
    }
  }

  public pause(): void {
    this.engine.pause()
  }

  public resume(): void {
    this.engine.resume()
  }
}

// Global singleton instance
export const textToSpeechService = new TextToSpeechService()
