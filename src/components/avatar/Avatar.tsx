import { useState, useRef, useEffect, Suspense } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { AvatarScene } from './AvatarScene'
import { AvatarErrorBoundary } from './AvatarErrorBoundary'
import { AvatarLoadingFallback } from './AvatarLoadingFallback'
import type { AvatarState } from './AvatarState'
import { avatarStateService } from '../../services/AvatarStateService'
import { companionBehaviorEngine, type CompanionState } from '../../services/CompanionBehaviorEngine'
import type { ModelFacialCapabilities } from './lipsync/LipSyncTypes'
import { DEFAULT_AVATAR_URL } from './AvatarModel'
import { WardrobeModal } from './wardrobe/WardrobeModal'
import styles from './Avatar.module.css'

export interface AvatarProps {
  modelUrl?: string
  state?: AvatarState
  showDevToolbar?: boolean
  className?: string
  isChatOpen?: boolean
}

/**
 * Real-time 3D Human Avatar component for the AI Hologram Assistant.
 * Coordinates rendering, multi-state postures (idle, listening, thinking, speaking),
 * lip-sync facial animation, companion emotion/intent detection, and developer diagnostic controls.
 */
export function Avatar({
  modelUrl = DEFAULT_AVATAR_URL,
  state: externalState,
  showDevToolbar = false,
  className,
  isChatOpen = false,
}: AvatarProps) {
  // Subscribe to central AvatarStateService & CompanionBehaviorEngine
  const [internalState, setInternalState] = useState<AvatarState>(() => avatarStateService.getState())
  const [companionState, setCompanionState] = useState<CompanionState>(() =>
    companionBehaviorEngine.getState()
  )
  const [capabilities, setCapabilities] = useState<ModelFacialCapabilities | null>(null)

  useEffect(() => {
    const unsubAvatar = avatarStateService.subscribe((newState) => {
      setInternalState(newState)
    })
    const unsubCompanion = companionBehaviorEngine.subscribe((newCompState) => {
      setCompanionState(newCompState)
    })
    return () => {
      unsubAvatar()
      unsubCompanion()
    }
  }, [])

  const activeState = externalState ?? internalState

  // Dev tools state
  const [isDevOpen, setIsDevOpen] = useState(showDevToolbar)
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [unlockedOrbit, setUnlockedOrbit] = useState(false)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
  }

  return (
    <div
      className={[styles.avatarContainer, className || ''].join(' ')}
      id="avatar-container"
      aria-label="3D Humanoid Avatar"
    >
      {/* ── Hologram Scanline & Overlay Effects ── */}
      <div className={styles.hologramOverlay} aria-hidden="true" />
      <div className={styles.hologramScanline} aria-hidden="true" />

      {/* ── 3D Canvas with Error Boundary and Suspense Fallback ── */}
      <div className={styles.canvasWrapper}>
        <AvatarErrorBoundary>
          <Suspense fallback={<AvatarLoadingFallback />}>
            <AvatarScene
              modelUrl={modelUrl}
              state={activeState}
              wireframe={wireframe}
              devControls={unlockedOrbit}
              isChatOpen={isChatOpen}
              controlsRef={controlsRef}
              onCapabilitiesReport={setCapabilities}
            />
          </Suspense>
        </AvatarErrorBoundary>
      </div>

      {/* ── Dynamic HUD Status Badge with State & Emotion Indicators ── */}
      {activeState === 'speaking' && (
        <div className={[styles.hudBadge, styles.hudBadgeSpeaking].join(' ')} aria-live="polite">
          <span className={styles.audioWaveIcon} aria-hidden="true">
            <span className={styles.waveBar} />
            <span className={styles.waveBar} />
            <span className={styles.waveBar} />
          </span>
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudSpeakingText}>Speaking</span>
          {companionState.activeGesture !== 'none' && (
            <span className={styles.hudCompanionTag}>
              {companionState.activeGesture === 'wave' && '👋 Wave'}
              {companionState.activeGesture === 'thinking_pose' && '🤔 Ponder'}
              {companionState.activeGesture === 'welcome' && '✨ Welcome'}
              {companionState.activeGesture === 'speech_accent' && '🗣️ Accent'}
            </span>
          )}
        </div>
      )}

      {activeState === 'listening' && (
        <div className={[styles.hudBadge, styles.hudBadgeListening].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotListening].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Listening</span>
          {companionState.activeGesture === 'wave' && (
            <span className={styles.hudCompanionTag}>👋 Wave</span>
          )}
        </div>
      )}

      {activeState === 'interrupted' && (
        <div className={[styles.hudBadge, styles.hudBadgeListening].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotListening].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Interrupted</span>
          <span className={styles.hudCompanionTag}>✋ Listening</span>
        </div>
      )}

      {activeState === 'thinking' && (
        <div className={[styles.hudBadge, styles.hudBadgeThinking].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotThinking].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Thinking</span>
          <span className={styles.hudCompanionTag}>🧠 Pondering</span>
        </div>
      )}

      {activeState === 'happy' && (
        <div className={[styles.hudBadge, styles.hudBadgeSpeaking].join(' ')} aria-live="polite">
          <span className={styles.statusDot} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Joyful</span>
          <span className={styles.hudCompanionTag}>😊 Happy</span>
        </div>
      )}

      {activeState === 'playful' && (
        <div className={[styles.hudBadge, styles.hudBadgeSpeaking].join(' ')} aria-live="polite">
          <span className={styles.statusDot} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Playful</span>
          <span className={styles.hudCompanionTag}>😜 Witty</span>
        </div>
      )}

      {activeState === 'excited' && (
        <div className={[styles.hudBadge, styles.hudBadgeSpeaking].join(' ')} aria-live="polite">
          <span className={styles.statusDot} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Excited</span>
          <span className={styles.hudCompanionTag}>🎉 Radiant</span>
        </div>
      )}

      {activeState === 'surprised' && (
        <div className={[styles.hudBadge, styles.hudBadgeThinking].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotThinking].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Surprised</span>
          <span className={styles.hudCompanionTag}>😮 Alert</span>
        </div>
      )}

      {activeState === 'confused' && (
        <div className={[styles.hudBadge, styles.hudBadgeListening].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotListening].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Puzzled</span>
          <span className={styles.hudCompanionTag}>🤔 Confused</span>
        </div>
      )}

      {activeState === 'concerned' && (
        <div className={[styles.hudBadge, styles.hudBadgeThinking].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotThinking].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Concerned</span>
          <span className={styles.hudCompanionTag}>💙 Attentive</span>
        </div>
      )}

      {activeState === 'curious' && (
        <div className={[styles.hudBadge, styles.hudBadgeListening].join(' ')} aria-live="polite">
          <span className={[styles.statusDot, styles.dotListening].join(' ')} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Curious</span>
          <span className={styles.hudCompanionTag}>✨ Inquiring</span>
        </div>
      )}

      {activeState === 'idle' && (
        <div className={styles.hudBadge} aria-live="polite">
          <span className={styles.statusDot} />
          <span className={styles.hudTitle}>ARIA</span>
          <span className={styles.hudState}>• Idle</span>
          {companionState.activeGesture === 'wave' && (
            <span className={styles.hudCompanionTag}>👋 Wave</span>
          )}
          {companionState.emotion === 'happy' && companionState.smileWeight > 0.3 && (
            <span className={styles.hudCompanionTag}>😊 Happy</span>
          )}
          {companionState.emotion === 'surprised' && companionState.surpriseWeight > 0.3 && (
            <span className={styles.hudCompanionTag}>😮 Surprised</span>
          )}
        </div>
      )}

      {/* ── Developer Controls (Interactive Gestures & Diagnostics) ── */}
      <div className={styles.devBar}>
        {isDevOpen ? (
          <>
            {capabilities && (
              <span
                className={styles.devCapabilityBadge}
                title={capabilities.diagnostics}
              >
                {capabilities.mode === 'morph-target'
                  ? `Morphs: ${capabilities.morphTargetNames.length}`
                  : capabilities.mode === 'jaw-bone'
                  ? 'Jaw: Bone'
                  : 'Face: Fallback (0 morphs)'}
              </span>
            )}
            <button
              type="button"
              className={styles.devButton}
              onClick={() => {
                companionBehaviorEngine.setEmotion('greeting')
                companionBehaviorEngine.triggerGesture('wave', 2.8)
              }}
              title="Test Wave Gesture"
              id="avatar-dev-wave-btn"
            >
              👋 Wave
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={() => {
                companionBehaviorEngine.setEmotion('thoughtful')
                companionBehaviorEngine.triggerGesture('thinking_pose', 3.0)
              }}
              title="Test Thinking Gesture"
              id="avatar-dev-think-btn"
            >
              🤔 Think
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={() => {
                companionBehaviorEngine.setEmotion('happy', 1.0)
              }}
              title="Test Smile"
              id="avatar-dev-smile-btn"
            >
              🙂 Smile
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={() => {
                companionBehaviorEngine.setEmotion('surprised', 1.0)
              }}
              title="Test Surprise"
              id="avatar-dev-surprise-btn"
            >
              😮 Surprise
            </button>
            <button
              type="button"
              className={[styles.devButton, unlockedOrbit ? styles.devButtonActive : ''].join(' ')}
              onClick={() => setUnlockedOrbit(!unlockedOrbit)}
              title="Unlock 360 Orbit and Zoom"
              id="avatar-dev-orbit-toggle"
            >
              {unlockedOrbit ? 'Orbit: Full' : 'Orbit: Port'}
            </button>
            <button
              type="button"
              className={[styles.devButton, wireframe ? styles.devButtonActive : ''].join(' ')}
              onClick={() => setWireframe(!wireframe)}
              title="Toggle Mesh Wireframe"
              id="avatar-dev-wireframe-toggle"
            >
              Wireframe
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={handleResetCamera}
              title="Reset Camera Position"
              id="avatar-dev-reset-camera"
            >
              Reset Cam
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={() => setWardrobeOpen(true)}
              title="Open ARIA 3D Wardrobe"
              id="avatar-dev-wardrobe-btn"
            >
              👗 Wardrobe
            </button>
            <button
              type="button"
              className={styles.devButton}
              onClick={() => setIsDevOpen(false)}
              title="Close Dev Bar"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.devButton}
            onClick={() => setIsDevOpen(true)}
            title="Open Developer Controls"
            id="avatar-dev-open-button"
          >
            Dev 3D
          </button>
        )}
      </div>

      {/* ── 3D Wardrobe Modal ── */}
      <WardrobeModal isOpen={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    </div>
  )
}

export default Avatar
