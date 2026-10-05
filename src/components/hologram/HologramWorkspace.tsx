import { useState, useEffect, useRef, useCallback } from 'react'
import Avatar from '../avatar/Avatar'
import { chatService } from '../../services/ChatService'
import { voiceInputService, type VoiceState } from '../../services/VoiceInputService'
import { textToSpeechService, type TTSState } from '../../services/TextToSpeechService'
import { avatarStateService } from '../../services/AvatarStateService'
import type { AvatarState } from '../avatar/AvatarState'
import styles from './HologramWorkspace.module.css'

export function HologramWorkspace() {
  const [avatarState, setAvatarState] = useState<AvatarState>(() => avatarStateService.getState())
  const [voiceState, setVoiceState] = useState<VoiceState>(() => voiceInputService.getState())
  const [ttsState, setTtsState] = useState<TTSState>(() => textToSpeechService.getState())
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => textToSpeechService.isEnabled())
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)
  const [showMiniChat, setShowMiniChat] = useState(true)

  // Mini-chat state
  const [inputValue, setInputValue] = useState('')
  const [latestResponse, setLatestResponse] = useState("Hello! I'm ARIA, your desktop hologram.")
  const [isStreaming, setIsStreaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load and subscribe to Hologram Electron settings
  useEffect(() => {
    const hologramApi = window.electronAPI?.hologram
    if (hologramApi) {
      hologramApi.getSettings().then((cfg) => {
        if (cfg) {
          setAlwaysOnTop(cfg.alwaysOnTop ?? true)
          setShowMiniChat(cfg.showMiniChat ?? true)
        }
      }).catch(() => {})

      const unsubscribeState = hologramApi.onStateChange((state) => {
        setAlwaysOnTop(state.alwaysOnTop)
        if (state.showMiniChat !== undefined) {
          setShowMiniChat(state.showMiniChat)
        }
      })

      return () => {
        unsubscribeState()
      }
    }
  }, [])

  // Subscriptions to Avatar, Voice, and TTS
  useEffect(() => {
    const unsubAvatar = avatarStateService.subscribe((st) => setAvatarState(st))
    const unsubVoice = voiceInputService.subscribe((st) => {
      setVoiceState(st)
      if (st === 'Listening') {
        avatarStateService.setState('listening', 'Hologram:voiceListening')
      } else if (st === 'Processing') {
        avatarStateService.setState('thinking', 'Hologram:voiceProcessing')
      } else if (st === 'Idle' && textToSpeechService.getState() !== 'Speaking') {
        avatarStateService.setState('idle', 'Hologram:voiceIdle')
      }
    })
    const unsubTTS = textToSpeechService.subscribe((st) => {
      setTtsState(st)
      setTtsEnabled(textToSpeechService.isEnabled())
    })

    return () => {
      unsubAvatar()
      unsubVoice()
      unsubTTS()
    }
  }, [])

  // Handlers for Window Controls
  const handleCloseHologram = useCallback(async () => {
    textToSpeechService.stop()
    if (window.electronAPI?.hologram) {
      await window.electronAPI.hologram.close()
    } else {
      window.close()
    }
  }, [])

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = !alwaysOnTop
    setAlwaysOnTop(next)
    if (window.electronAPI?.hologram) {
      await window.electronAPI.hologram.setAlwaysOnTop(next)
    }
  }, [alwaysOnTop])

  const handleToggleTTS = useCallback(() => {
    if (ttsState === 'Speaking') {
      textToSpeechService.stop()
    } else {
      const next = !ttsEnabled
      textToSpeechService.setEnabled(next)
      setTtsEnabled(next)
    }
  }, [ttsEnabled, ttsState])

  const handleToggleMic = useCallback(async () => {
    if (voiceState === 'Listening') {
      await voiceInputService.stopListening()
      return
    }

    try {
      avatarStateService.setState('listening', 'Hologram:startMic')
      const recognizedText = await voiceInputService.startListening()
      if (recognizedText) {
        setInputValue(recognizedText)
        handleSendMessage(recognizedText)
      }
    } catch (err) {
      console.warn('[Hologram] Voice listening error:', err)
      avatarStateService.setState('idle', 'Hologram:micError')
    }
  }, [voiceState])

  // Mini-chat submission handler
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend ?? inputValue).trim()
    if (!query || isStreaming) return

    setInputValue('')
    setIsStreaming(true)
    setLatestResponse('')
    avatarStateService.setState('thinking', 'Hologram:sendMessage')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await chatService.streamMessage(
        [{ id: 'u-' + Date.now(), role: 'user', content: query, timestamp: new Date() }],
        {
          signal: controller.signal,
          onChunk: (chunk) => {
            setLatestResponse((prev) => prev + chunk)
          },
        }
      )

      if (res) {
        setLatestResponse(res)
        if (textToSpeechService.isEnabled()) {
          textToSpeechService.speak(res)
        }
      }
    } catch (err) {
      console.error('[Hologram] Chat stream error:', err)
      setLatestResponse('Sorry, an error occurred while processing.')
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      if (!textToSpeechService.isEnabled() || textToSpeechService.getState() !== 'Speaking') {
        avatarStateService.setState('idle', 'Hologram:streamFinally')
      }
    }
  }

  return (
    <div className={styles.hologramContainer} id="desktop-hologram-workspace">
      {/* ── Top Draggable Handle Header ── */}
      <header className={styles.dragHeader} id="hologram-drag-header">
        <div className={styles.headerBrand}>
          <span className={styles.brandDot} />
          <span className={styles.brandTitle}>ARIA Hologram</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={[styles.headerBtn, alwaysOnTop ? styles.headerBtnActive : ''].join(' ')}
            onClick={handleToggleAlwaysOnTop}
            title={alwaysOnTop ? 'Always on top: ON (Click to disable)' : 'Always on top: OFF (Click to pin)'}
            id="hologram-pin-btn"
          >
            📌
          </button>
          <button
            type="button"
            className={[styles.headerBtn, styles.headerBtnClose].join(' ')}
            onClick={handleCloseHologram}
            title="Close Hologram Mode (Return to Normal Mode)"
            id="hologram-close-btn"
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── Central 3D Human Avatar Viewport ── */}
      <main className={styles.avatarViewport} id="hologram-avatar-viewport">
        <Avatar showDevToolbar={false} />
      </main>

      {/* ── Collapsible Mini Chat ── */}
      {showMiniChat && (
        <section className={styles.miniChatContainer} id="hologram-mini-chat" aria-label="Mini Chat">
          <div className={styles.miniChatHeader}>
            <span className={styles.miniChatTitle}>
              {isStreaming ? '🧠 Thinking...' : avatarState === 'speaking' ? '🔊 Speaking...' : '💬 ARIA Assistant'}
            </span>
            <button
              type="button"
              className={styles.miniChatClose}
              onClick={() => setShowMiniChat(false)}
              title="Hide Mini Chat"
            >
              ✕
            </button>
          </div>
          <div className={styles.miniChatBody}>
            <div className={styles.miniMessageBubble}>
              {latestResponse || (isStreaming ? '...' : 'Ask ARIA anything...')}
              {isStreaming && <span className={styles.streamingCursor} />}
            </div>
          </div>
          <form
            className={styles.miniInputRow}
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className={styles.miniInput}
              placeholder="Message ARIA..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isStreaming}
              id="hologram-mini-input"
            />
            <button
              type="submit"
              className={styles.miniSendBtn}
              disabled={!inputValue.trim() || isStreaming}
              id="hologram-mini-send"
            >
              Send
            </button>
          </form>
        </section>
      )}

      {/* ── Minimal Floating Action Toolbar ── */}
      <footer className={styles.actionToolbar} id="hologram-action-toolbar">
        <button
          type="button"
          className={[
            styles.toolBtn,
            voiceState === 'Listening' ? styles.toolBtnListening : '',
          ].join(' ')}
          onClick={handleToggleMic}
          title={voiceState === 'Listening' ? 'Stop Listening' : 'Voice Input (Mic)'}
          id="hologram-mic-btn"
        >
          🎤
        </button>

        <button
          type="button"
          className={[
            styles.toolBtn,
            ttsState === 'Speaking' ? styles.toolBtnSpeaking : ttsEnabled ? styles.toolBtnActive : '',
          ].join(' ')}
          onClick={handleToggleTTS}
          title={ttsState === 'Speaking' ? 'Stop Speech' : ttsEnabled ? 'Voice Output ON' : 'Voice Output OFF'}
          id="hologram-tts-btn"
        >
          {ttsState === 'Speaking' ? '⏹' : ttsEnabled ? '🔊' : '🔇'}
        </button>

        <button
          type="button"
          className={[styles.toolBtn, showMiniChat ? styles.toolBtnActive : ''].join(' ')}
          onClick={() => setShowMiniChat(!showMiniChat)}
          title="Toggle Mini Chat"
          id="hologram-chat-toggle"
        >
          💬
        </button>

        <button
          type="button"
          className={[styles.toolBtn, alwaysOnTop ? styles.toolBtnActive : ''].join(' ')}
          onClick={handleToggleAlwaysOnTop}
          title={alwaysOnTop ? 'Always On Top: ON' : 'Always On Top: OFF'}
        >
          📌
        </button>

        <button
          type="button"
          className={styles.toolBtn}
          onClick={handleCloseHologram}
          title="Close Hologram"
        >
          ✕
        </button>
      </footer>
    </div>
  )
}

export default HologramWorkspace
