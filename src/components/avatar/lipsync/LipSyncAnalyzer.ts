import type { SpeechActivity, VisemeName } from './LipSyncTypes'
import type { TTSAudioProgress } from '../../../services/TextToSpeechService'

/**
 * Phoneme mapping table from character patterns to Visemes.
 */
function mapCharToViseme(ch: string, nextCh = ''): VisemeName {
  const c = ch.toLowerCase()
  const next = nextCh.toLowerCase()

  if (!c || c === ' ' || c === '.' || c === ',' || c === '!' || c === '?' || c === '-' || c === ';') {
    return 'viseme_sil'
  }

  // Digraph check
  if (c === 't' && next === 'h') return 'viseme_TH'
  if ((c === 's' || c === 'c') && next === 'h') return 'viseme_CH'

  switch (c) {
    case 'a':
      return 'viseme_aa'
    case 'e':
      return 'viseme_E'
    case 'i':
    case 'y':
      return 'viseme_I'
    case 'o':
      return 'viseme_O'
    case 'u':
    case 'w':
      return 'viseme_U'
    case 'm':
    case 'b':
    case 'p':
      return 'viseme_PP'
    case 'f':
    case 'v':
      return 'viseme_FF'
    case 't':
    case 'd':
      return 'viseme_DD'
    case 'k':
    case 'g':
      return 'viseme_kk'
    case 's':
    case 'z':
      return 'viseme_SS'
    case 'n':
    case 'l':
      return 'viseme_nn'
    case 'r':
      return 'viseme_RR'
    default:
      return 'viseme_aa'
  }
}

/**
 * Real-time Speech and Audio Envelope Analyzer for Lip Sync.
 * Highly optimized for 60fps execution on integrated GPUs with zero garbage collection allocations.
 */
export class LipSyncAnalyzer {
  private isSpeaking = false
  private text = ''
  private currentCharIndex = 0
  private lastBoundaryTime = 0
  private speechStartTime = 0
  private clockTime = 0

  // Smoothed envelope values
  private currentAmplitude = 0
  private targetAmplitude = 0
  private currentViseme: VisemeName = 'viseme_sil'

  // Pre-allocated weights map to prevent allocations in animation loop
  private visemeWeights: Record<string, number> = {
    viseme_sil: 1.0,
    viseme_aa: 0,
    viseme_E: 0,
    viseme_I: 0,
    viseme_O: 0,
    viseme_U: 0,
    viseme_PP: 0,
    viseme_FF: 0,
    viseme_TH: 0,
    viseme_DD: 0,
    viseme_kk: 0,
    viseme_CH: 0,
    viseme_SS: 0,
    viseme_nn: 0,
    viseme_RR: 0,
  }

  // Pre-allocated return snapshot
  private activitySnapshot: SpeechActivity = {
    isSpeaking: false,
    amplitude: 0,
    rawAmplitude: 0,
    viseme: 'viseme_sil',
    visemeWeights: this.visemeWeights,
    charIndex: 0,
    elapsedTime: 0,
  }

  // Optional Web Audio AnalyserNode support
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private frequencyData: Uint8Array | null = null

  public startSpeech(spokenText: string): void {
    this.isSpeaking = true
    this.text = spokenText
    this.currentCharIndex = 0
    this.speechStartTime = performance.now() / 1000
    this.lastBoundaryTime = this.speechStartTime
    this.targetAmplitude = 0.5
  }

  public updateProgress(progress: TTSAudioProgress): void {
    if (!this.isSpeaking) return

    this.currentCharIndex = progress.charIndex
    this.lastBoundaryTime = performance.now() / 1000

    // Determine target viseme based on the character being articulated
    const ch = this.text[progress.charIndex] || ''
    const nextCh = this.text[progress.charIndex + 1] || ''
    this.currentViseme = mapCharToViseme(ch, nextCh)

    // Modulate target amplitude based on phoneme type
    if (this.currentViseme === 'viseme_sil') {
      this.targetAmplitude = 0.05
    } else if (this.currentViseme === 'viseme_aa' || this.currentViseme === 'viseme_O') {
      this.targetAmplitude = 0.85
    } else if (this.currentViseme === 'viseme_PP') {
      this.targetAmplitude = 0.15 // lips closed
    } else {
      this.targetAmplitude = 0.6
    }
  }

  public endSpeech(): void {
    this.isSpeaking = false
    this.targetAmplitude = 0
    this.currentViseme = 'viseme_sil'
  }

  public stopSpeech(): void {
    this.isSpeaking = false
    this.targetAmplitude = 0
    this.currentAmplitude = 0
    this.currentViseme = 'viseme_sil'

    // Reset all weights
    for (const k of Object.keys(this.visemeWeights)) {
      this.visemeWeights[k] = k === 'viseme_sil' ? 1.0 : 0
    }
  }

  /**
   * Optional connection to a Web Audio API AnalyserNode when media streams are present.
   */
  public connectAudioSource(audioElement: HTMLMediaElement): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return

      if (!this.audioContext) {
        this.audioContext = new AudioCtx()
      }
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      const source = this.audioContext.createMediaElementSource(audioElement)
      source.connect(this.analyserNode)
      this.analyserNode.connect(this.audioContext.destination)
      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount)
    } catch (err) {
      console.warn('[LipSyncAnalyzer] Web Audio connection not applicable:', err)
    }
  }

  /**
   * Called on every animation frame from React Three Fiber / useFrame.
   * Updates amplitude envelope and viseme weights smoothly.
   */
  public update(delta: number): SpeechActivity {
    this.clockTime += delta

    // 1. If Web Audio Analyser is connected, read real FFT energy
    if (this.analyserNode && this.frequencyData) {
      this.analyserNode.getByteFrequencyData(this.frequencyData as any)
      let sum = 0
      for (let i = 0; i < this.frequencyData.length; i++) {
        sum += this.frequencyData[i]
      }
      const rawLevel = sum / (this.frequencyData.length * 255)
      this.targetAmplitude = Math.min(rawLevel * 2.2, 1.0)
    } else if (this.isSpeaking) {
      // 2. Syllable cadence oscillator synchronized with speech timing
      // Natural speech rhythm oscillates ~4.5 Hz with micro-inflections
      const timeSinceBoundary = (performance.now() / 1000) - this.lastBoundaryTime
      const syllableOsc = Math.sin(timeSinceBoundary * Math.PI * 9) * 0.25
      const baseline = this.targetAmplitude > 0.2 ? this.targetAmplitude : 0.4
      const modulated = Math.max(0.08, Math.min(1.0, baseline + syllableOsc))

      // Exponential attack & release filter
      const attackSpeed = 18.0
      this.currentAmplitude += (modulated - this.currentAmplitude) * Math.min(1.0, delta * attackSpeed)
    } else {
      // Smooth decay to rest
      const releaseSpeed = 14.0
      this.currentAmplitude += (0 - this.currentAmplitude) * Math.min(1.0, delta * releaseSpeed)
      if (this.currentAmplitude < 0.005) {
        this.currentAmplitude = 0
      }
    }

    // 3. Update viseme weights
    const targetViseme = this.isSpeaking ? this.currentViseme : 'viseme_sil'
    const blendSpeed = 22.0

    for (const key of Object.keys(this.visemeWeights)) {
      const targetWeight = key === targetViseme ? 1.0 : 0.0
      this.visemeWeights[key] += (targetWeight - this.visemeWeights[key]) * Math.min(1.0, delta * blendSpeed)
    }

    // 4. Update preallocated snapshot
    this.activitySnapshot.isSpeaking = this.isSpeaking
    this.activitySnapshot.amplitude = this.currentAmplitude
    this.activitySnapshot.rawAmplitude = this.targetAmplitude
    this.activitySnapshot.viseme = targetViseme
    this.activitySnapshot.charIndex = this.currentCharIndex
    this.activitySnapshot.elapsedTime = this.clockTime

    return this.activitySnapshot
  }

  public dispose(): void {
    this.stopSpeech()
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.analyserNode = null
    }
  }
}
