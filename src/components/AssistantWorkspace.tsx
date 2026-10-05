import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Avatar from './avatar/Avatar'
import ChatPanel from './ChatPanel'
import SettingsPanel from './SettingsPanel'
import type { NavSection } from '../types'
import { avatarStateService } from '../services/AvatarStateService'
import { companionBehaviorEngine } from '../services/CompanionBehaviorEngine'
import { voiceConversationService, type VoiceConversationEvent } from '../services/VoiceConversationService'
import type { AvatarState } from './avatar/AvatarState'
import { WardrobeModal } from './avatar/wardrobe/WardrobeModal'
import styles from './AssistantWorkspace.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssistantWorkspaceProps {
  onBack: () => void
}

// ─── Section Titles ───────────────────────────────────────────────────────────

const SECTION_TITLES: Record<NavSection, string> = {
  assistant: 'AI Companion',
  chat: 'Chat & Companion',
  voice: 'Voice Interface',
  memory: 'Memory',
  search: 'Web Search',
  settings: 'Settings',
}

const AVATAR_STATES: Array<{ id: AvatarState; label: string; icon: string }> = [
  { id: 'idle', label: 'Idle', icon: '🧍' },
  { id: 'listening', label: 'Listen', icon: '👂' },
  { id: 'thinking', label: 'Think', icon: '🧠' },
  { id: 'speaking', label: 'Speak', icon: '👄' },
  { id: 'happy', label: 'Happy', icon: '🙂' },
  { id: 'playful', label: 'Playful', icon: '😜' },
  { id: 'excited', label: 'Excited', icon: '🎉' },
  { id: 'surprised', label: 'Surprise', icon: '😮' },
  { id: 'confused', label: 'Confused', icon: '🤔' },
  { id: 'concerned', label: 'Concern', icon: '💙' },
  { id: 'curious', label: 'Curious', icon: '✨' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function AssistantWorkspace({ onBack }: AssistantWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<NavSection>('assistant')
  const [currentState, setCurrentState] = useState<AvatarState>(() => avatarStateService.getState())
  const [chatOverlayVisible, setChatOverlayVisible] = useState(true)
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [voiceConvEvent, setVoiceConvEvent] = useState<VoiceConversationEvent>(() =>
    voiceConversationService.getSnapshot()
  )

  useEffect(() => {
    const unsubAvatar = avatarStateService.subscribe((newState) => {
      setCurrentState(newState)
    })
    const unsubVoice = voiceConversationService.subscribe((event) => {
      setVoiceConvEvent(event)
    })
    return () => {
      unsubAvatar()
      unsubVoice()
    }
  }, [])

  const handleStateClick = (state: AvatarState) => {
    avatarStateService.setState(state, 'WorkspaceHeader')

    if (state === 'happy') {
      companionBehaviorEngine.setEmotion('happy', 1.0)
      companionBehaviorEngine.triggerGesture('welcome', 3.0)
    } else if (state === 'playful') {
      companionBehaviorEngine.setEmotion('playful', 1.0)
      companionBehaviorEngine.triggerGesture('curious_tilt', 3.0)
    } else if (state === 'excited') {
      companionBehaviorEngine.setEmotion('excited', 1.0)
      companionBehaviorEngine.triggerGesture('welcome', 3.2)
    } else if (state === 'surprised') {
      companionBehaviorEngine.setEmotion('surprised', 1.0)
    } else if (state === 'concerned') {
      companionBehaviorEngine.setEmotion('concerned', 1.0)
    } else if (state === 'curious') {
      companionBehaviorEngine.setEmotion('curious', 1.0)
      companionBehaviorEngine.triggerGesture('curious_tilt', 3.0)
    } else if (state === 'confused') {
      companionBehaviorEngine.setEmotion('curious', 0.8)
      companionBehaviorEngine.triggerGesture('curious_tilt', 3.0)
    } else if (state === 'thinking') {
      companionBehaviorEngine.setEmotion('thoughtful', 0.9)
      companionBehaviorEngine.triggerGesture('thinking_pose', 3.2)
    } else if (state === 'listening') {
      companionBehaviorEngine.setEmotion('curious', 0.7)
    } else if (state === 'speaking') {
      companionBehaviorEngine.triggerGesture('speech_accent', 3.5)
    } else {
      companionBehaviorEngine.setEmotion('neutral', 0.5)
    }
  }

  return (
    <div className={styles.workspace} id="assistant-workspace">
      {/* ── Left Sidebar ── */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBack={onBack}
      />

      {/* ── Main Panel ── */}
      <div className={styles.mainPanel}>
        {/* Top bar */}
        <header className={styles.topBar} id="workspace-topbar">
          <div className={styles.topBarLeft}>
            <h1 className={styles.sectionTitle}>{SECTION_TITLES[activeSection]}</h1>
            <div className={styles.statusPill}>
              <span className={styles.statusDot} aria-hidden="true" />
              <span>ARIA 3D Companion</span>
            </div>
          </div>

          {/* Interactive Avatar State Selector */}
          <div className={styles.topBarRight}>
            <div className={styles.stateSelectorGroup} role="group" aria-label="Avatar State Controls">
              {AVATAR_STATES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  className={[
                    styles.statePillBtn,
                    currentState === st.id ? styles.statePillBtnActive : '',
                  ].join(' ')}
                  onClick={() => handleStateClick(st.id)}
                  title={`Set ARIA state to ${st.label}`}
                  id={`avatar-state-btn-${st.id}`}
                >
                  {st.icon} {st.label}
                </button>
              ))}
            </div>

            {/* Voice Mode Selector */}
            <button
              type="button"
              className={[
                styles.voiceModeBtn,
                voiceConvEvent.mode === 'continuous' ? styles.voiceModeBtnContinuous : '',
                voiceConvEvent.mode === 'wake_word' ? styles.voiceModeBtnWakeWord : '',
                voiceConvEvent.mode === 'off' ? styles.voiceModeBtnOff : '',
              ].join(' ')}
              onClick={() => voiceConversationService.toggleMode()}
              title={
                voiceConvEvent.mode === 'continuous'
                  ? 'Continuous Voice Mode: ACTIVE — Click to switch to Wake Word'
                  : voiceConvEvent.mode === 'wake_word'
                  ? 'Wake Word Mode: "Hey ARIA" — Click to turn off'
                  : 'Hands-Free Voice: Off — Click to enable Continuous Voice'
              }
              id="workspace-voice-mode-btn"
              aria-label="Toggle voice conversation mode"
            >
              <span
                className={[
                  styles.voiceModeDot,
                  voiceConvEvent.mode === 'continuous' ? styles.voiceModeDotContinuous : '',
                  voiceConvEvent.mode === 'wake_word' ? styles.voiceModeDotWakeWord : '',
                ].join(' ')}
                aria-hidden="true"
              />
              <span>
                {voiceConvEvent.mode === 'continuous'
                  ? '🎙️ Live Voice'
                  : voiceConvEvent.mode === 'wake_word'
                  ? '👂 "Hey ARIA"'
                  : '🎙️ Voice Off'}
              </span>
            </button>

            {/* 3D Wardrobe Button */}
            <button
              type="button"
              className={styles.toggleChatBtn}
              onClick={() => setWardrobeOpen(true)}
              title="Open ARIA 3D Wardrobe & Outfits"
              id="workspace-wardrobe-btn"
              style={{
                borderColor: 'rgba(0, 212, 255, 0.45)',
                background: 'rgba(0, 212, 255, 0.1)',
                color: '#00d4ff',
              }}
            >
              👗 Wardrobe
            </button>

            {/* Toggle Chat Overlay Button */}
            <button
              type="button"
              className={styles.toggleChatBtn}
              onClick={() => setChatOverlayVisible(!chatOverlayVisible)}
              title={chatOverlayVisible ? 'Hide Chat / View Full Avatar' : 'Open Live Companion Chat'}
              id="workspace-toggle-chat-btn"
            >
              {chatOverlayVisible ? '👁️ Full Avatar' : '💬 Open Chat'}
            </button>
          </div>
        </header>

        {/* Content area: Two-Section Companion Layout */}
        <div className={styles.contentArea}>
          {activeSection === 'settings' ? (
            <SettingsPanel />
          ) : (
            <div
              className={[
                styles.companionLayout,
                chatOverlayVisible ? styles.companionLayoutChatOpen : styles.companionLayoutChatClosed,
              ].join(' ')}
              id="aria-companion-layout"
            >
              {/* ── Left / Main Companion Area: 3D ARIA Avatar Stage ── */}
              <div
                className={styles.avatarSection}
                id="aria-avatar-section"
                aria-label="3D ARIA Female Avatar"
              >
                <Avatar
                  showDevToolbar={false}
                  isChatOpen={chatOverlayVisible}
                />
                <div className={styles.avatarGridLines} aria-hidden="true" />

                {/* ── Hologram Floating Voice Stage HUD ── */}
                {voiceConvEvent.mode !== 'off' && (
                  <div
                    className={[
                      styles.voiceStageHud,
                      voiceConvEvent.stage === 'listening' ? styles.voiceStageHudListening : '',
                      voiceConvEvent.stage === 'speaking' ? styles.voiceStageHudSpeaking : '',
                      voiceConvEvent.stage === 'processing' ? styles.voiceStageHudProcessing : '',
                      voiceConvEvent.stage === 'interrupted' ? styles.voiceStageHudInterrupted : '',
                    ].join(' ')}
                    id="aria-voice-stage-hud"
                  >
                    <div className={styles.voiceStageHeader}>
                      <span
                        className={[
                          styles.voiceStagePulseDot,
                          voiceConvEvent.stage === 'listening' ? styles.pulseDotCyan : '',
                          voiceConvEvent.stage === 'speaking' ? styles.pulseDotGreen : '',
                          voiceConvEvent.stage === 'processing' ? styles.pulseDotPurple : '',
                          voiceConvEvent.stage === 'interrupted' ? styles.pulseDotAmber : '',
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      <span className={styles.voiceStageTitle}>
                        {voiceConvEvent.mode === 'continuous' ? 'HANDS-FREE CONVERSATION' : 'WAKE WORD: "HEY ARIA"'}
                      </span>
                      <span className={styles.voiceStageStatusLabel}>
                        {voiceConvEvent.stage === 'listening' && 'Listening...'}
                        {voiceConvEvent.stage === 'processing' && 'Thinking...'}
                        {voiceConvEvent.stage === 'speaking' && 'Speaking...'}
                        {voiceConvEvent.stage === 'interrupted' && 'Interrupted!'}
                      </span>
                    </div>

                    {voiceConvEvent.transcript && (
                      <div className={styles.voiceStageSubtitle} id="voice-stage-subtitle">
                        "{voiceConvEvent.transcript}"
                      </div>
                    )}

                    <div className={styles.voiceStageActions}>
                      {voiceConvEvent.stage === 'speaking' && (
                        <button
                          type="button"
                          className={styles.stageActionBtnDanger}
                          onClick={() => voiceConversationService.interrupt('StageHUD')}
                          title="Interrupt speech"
                          id="stage-hud-interrupt-btn"
                        >
                          Interrupt
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.stageActionBtn}
                        onClick={() => voiceConversationService.toggleMode()}
                        title="Change voice mode"
                        id="stage-hud-toggle-btn"
                      >
                        {voiceConvEvent.mode === 'continuous' ? 'Wake Word' : 'Mute'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right Companion Area: Live Conversation Panel ── */}
              <div
                className={[
                  styles.chatSection,
                  !chatOverlayVisible ? styles.chatSectionClosed : '',
                ].join(' ')}
                id="aria-chat-section"
                aria-label="Live Conversation Panel"
              >
                <ChatPanel />
              </div>

              {/* Quick toggle pill if chat is closed */}
              {!chatOverlayVisible && (
                <button
                  type="button"
                  className={styles.floatingShowChatBtn}
                  onClick={() => setChatOverlayVisible(true)}
                  id="workspace-floating-chat-open"
                  title="Open Live Conversation"
                >
                  💬 Open Live Chat
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 3D Wardrobe System Modal ── */}
      <WardrobeModal isOpen={wardrobeOpen} onClose={() => setWardrobeOpen(false)} />
    </div>
  )
}

export default AssistantWorkspace
