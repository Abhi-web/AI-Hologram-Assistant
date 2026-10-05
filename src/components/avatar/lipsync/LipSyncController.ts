import { LipSyncAnalyzer } from './LipSyncAnalyzer'
import type { SpeechActivity } from './LipSyncTypes'
import { textToSpeechService, type TTSAudioProgress } from '../../../services/TextToSpeechService'
import { avatarStateService } from '../../../services/AvatarStateService'

/**
 * LipSyncController — Subscribes to TextToSpeechService lifecycle events
 * and coordinates LipSyncAnalyzer and AvatarStateService.
 */
export class LipSyncController {
  private analyzer: LipSyncAnalyzer
  private unsubscribeTTSLifecycle: (() => void) | null = null

  constructor(analyzer = new LipSyncAnalyzer()) {
    this.analyzer = analyzer
    this.bindTTS()
  }

  private bindTTS(): void {
    this.unsubscribeTTSLifecycle = textToSpeechService.addLifecycleListener({
      onStart: (data: { text: string }) => {
        console.log('[LipSyncController] Speech started:', data.text.slice(0, 30))
        this.analyzer.startSpeech(data.text)
        avatarStateService.setState('speaking', 'LipSyncController:onStart')
      },
      onAudioProgress: (progress: TTSAudioProgress) => {
        this.analyzer.updateProgress(progress)
      },
      onEnd: () => {
        console.log('[LipSyncController] Speech ended naturally.')
        this.analyzer.endSpeech()
        avatarStateService.setState('idle', 'LipSyncController:onEnd')
      },
      onStop: () => {
        console.log('[LipSyncController] Speech stopped/cancelled.')
        this.analyzer.stopSpeech()
        avatarStateService.setState('idle', 'LipSyncController:onStop')
      },
      onError: (err: string) => {
        console.warn('[LipSyncController] Speech error:', err)
        this.analyzer.stopSpeech()
        avatarStateService.setState('idle', 'LipSyncController:onError')
      },
    })
  }

  /**
   * Called every frame in Three.js render loop.
   */
  public update(delta: number): SpeechActivity {
    return this.analyzer.update(delta)
  }

  public getAnalyzer(): LipSyncAnalyzer {
    return this.analyzer
  }

  public dispose(): void {
    if (this.unsubscribeTTSLifecycle) {
      this.unsubscribeTTSLifecycle()
      this.unsubscribeTTSLifecycle = null
    }
    this.analyzer.dispose()
  }
}

// Global shared controller instance
export const lipSyncController = new LipSyncController()
