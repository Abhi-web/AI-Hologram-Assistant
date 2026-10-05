import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '../types'
import type { ProviderType } from '../providers/AIProvider'
import { chatService } from '../services/ChatService'
import { voiceInputService, type VoiceState } from '../services/VoiceInputService'
import { textToSpeechService, SentenceChunker, type TTSState } from '../services/TextToSpeechService'
import { avatarStateService } from '../services/AvatarStateService'
import styles from './ChatPanel.module.css'

import { voiceConversationService, type VoiceConversationEvent } from '../services/VoiceConversationService'

// ─── Constants ────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your AI assistant. How can I help you?",
  timestamp: new Date(),
}

// ─── Helper: format timestamp ─────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div className={[styles.messageRow, isUser ? styles.messageRowUser : ''].join(' ')}>
      {!isUser && (
        <div className={styles.avatarIcon} aria-hidden="true">
          <span>AI</span>
        </div>
      )}
      <div className={styles.messageContent}>
        <div className={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant].join(' ')}>
          {message.content ? (
            <>
              {message.content}
              {isStreaming && <span className={styles.streamingCursor} aria-hidden="true" />}
            </>
          ) : isStreaming ? (
            <div className={styles.typingBubbleInline} aria-label="AI is thinking">
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          ) : (
            message.content
          )}
        </div>
        <span className={[styles.timestamp, isUser ? styles.timestampUser : ''].join(' ')}>
          {formatTime(message.timestamp)}
        </span>
      </div>
      {isUser && (
        <div className={[styles.avatarIcon, styles.avatarIconUser].join(' ')} aria-hidden="true">
          <span>You</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [activeProviderType, setActiveProviderType] = useState<ProviderType>(() =>
    chatService.getActiveProviderType()
  )
  const [cloudModel, setCloudModel] = useState('gpt-4o-mini')

  // ─── Voice Conversation Service State ───────────────────────────────────────
  const [voiceConvEvent, setVoiceConvEvent] = useState<VoiceConversationEvent>(() =>
    voiceConversationService.getSnapshot()
  )

  // ─── Voice Input State (Manual STT) ─────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>(() => voiceInputService.getState())
  const [voiceError, setVoiceError] = useState<string | null>(() => voiceInputService.getErrorMessage())
  const [voiceHypothesis, setVoiceHypothesis] = useState<string>('')

  // ─── Voice Output (TTS) State ───────────────────────────────────────────────
  const [ttsState, setTtsState] = useState<TTSState>(() => textToSpeechService.getState())
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => textToSpeechService.isEnabled())

  const messageListRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Listen for provider changes, voice conversation events, and TTS events
  useEffect(() => {
    const unsubscribeProvider = chatService.subscribeToProvider((newType) => {
      setActiveProviderType(newType)
    })

    const unsubscribeVoiceConv = voiceConversationService.subscribe((event) => {
      setVoiceConvEvent(event)
    })

    // Register hands-free voice message callbacks:
    // User voice speech and ARIA responses appear in message feed WITHOUT altering manual text input!
    const unsubscribeVoiceMsg = voiceConversationService.registerMessageCallback({
      onUserMessage: (userText) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `voice-u-${Date.now()}`,
            role: 'user',
            content: userText,
            timestamp: new Date(),
          },
        ])
      },
      onAssistantMessage: (assistantText) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `voice-a-${Date.now()}`,
            role: 'assistant',
            content: assistantText,
            timestamp: new Date(),
          },
        ])
      },
    })

    const unsubscribeVoice = voiceInputService.subscribe((state, error, hypothesis) => {
      setVoiceState(state)
      setVoiceError(error)
      setVoiceHypothesis(hypothesis)
      if (voiceConversationService.getMode() === 'off') {
        if (state === 'Listening') {
          avatarStateService.setState('listening', 'ChatPanel:voiceListening')
        } else if (state === 'Processing') {
          avatarStateService.setState('thinking', 'ChatPanel:voiceProcessing')
        } else if (state === 'Idle' && textToSpeechService.getState() !== 'Speaking') {
          avatarStateService.setState('idle', 'ChatPanel:voiceIdle')
        }
      }
    })

    const unsubscribeTTS = textToSpeechService.subscribe((state) => {
      setTtsState(state)
      setTtsEnabled(textToSpeechService.isEnabled())
    })

    if (window.electronAPI?.cloudAI) {
      window.electronAPI.cloudAI
        .getConfig()
        .then((cfg) => {
          if (cfg?.model) setCloudModel(cfg.model)
        })
        .catch(() => {})
    }

    return () => {
      unsubscribeProvider()
      unsubscribeVoiceConv()
      unsubscribeVoiceMsg()
      unsubscribeVoice()
      unsubscribeTTS()
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive or when streaming updates
  useEffect(() => {
    const el = messageListRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, isStreaming])

  const handleStop = useCallback(() => {
    textToSpeechService.stop()
    avatarStateService.setState('idle', 'ChatPanel:handleStop')
    if (abortControllerRef.current) {
      console.log('[ChatPanel] Stopping generation requested by user')
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // ─── Voice Output (TTS) Handlers ────────────────────────────────────────────
  const handleToggleTTS = useCallback(() => {
    if (ttsState === 'Speaking') {
      textToSpeechService.stop()
      avatarStateService.setState('idle', 'ChatPanel:handleToggleTTS:stop')
    } else {
      const next = !ttsEnabled
      textToSpeechService.setEnabled(next)
      setTtsEnabled(next)
    }
  }, [ttsEnabled, ttsState])

  const handleTTSStop = useCallback(() => {
    textToSpeechService.stop()
    avatarStateService.setState('idle', 'ChatPanel:handleTTSStop')
  }, [])

  // ─── Voice Input Handlers ───────────────────────────────────────────────────
  const handleVoiceCancel = useCallback(async () => {
    await voiceInputService.cancelListening()
    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }, [])

  const handleVoiceStop = useCallback(async () => {
    await voiceInputService.stopListening()
  }, [])

  // Global Escape key listener to cancel voice listening or stop active speech from anywhere
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (voiceState === 'Listening') {
          e.preventDefault()
          handleVoiceCancel()
        } else if (ttsState === 'Speaking') {
          e.preventDefault()
          textToSpeechService.stop()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [voiceState, ttsState, handleVoiceCancel])

  const handleMicClick = useCallback(async () => {
    if (isStreaming) return
    voiceConversationService.toggleMode()
  }, [isStreaming])

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isStreaming) return

    // Stop any ongoing speech playback before new conversation turns
    textToSpeechService.stop()

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const assistantMessageId = `ai-${Date.now()}`
    const placeholderAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages([...updatedMessages, placeholderAssistantMessage])
    setInputValue('')
    setIsStreaming(true)
    setStreamingMessageId(assistantMessageId)
    avatarStateService.setState('thinking', 'ChatPanel:sendMessage')

    const controller = new AbortController()
    abortControllerRef.current = controller

    const shouldSpeak = textToSpeechService.isEnabled()
    let chunker: SentenceChunker | null = null
    if (shouldSpeak) {
      textToSpeechService.startSentenceStream()
      chunker = new SentenceChunker((sentence) => {
        textToSpeechService.enqueueSentence(sentence)
      })
    }

    try {
      const finalResponse = await chatService.streamMessage(updatedMessages, {
        signal: controller.signal,
        onChunk: (chunk: string) => {
          if (chunker) {
            chunker.feed(chunk)
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          )
        },
      })

      if (chunker) {
        chunker.flush()
        textToSpeechService.finishSentenceStream()
      }

      if (finalResponse) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: finalResponse } : msg
          )
        )
      } else {
        // If aborted before any chunk, remove empty placeholder
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId || msg.content.trim().length > 0)
        )
      }
    } catch (err) {
      if (chunker) {
        textToSpeechService.stop()
      }
      console.error('[ChatPanel] Error communicating with ChatService:', err)
      avatarStateService.setState('idle', 'ChatPanel:error')
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Sorry, I encountered an issue generating a response. Please check your provider settings.'

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content ? `${msg.content}\n\n[${errorMessage}]` : errorMessage }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
      setStreamingMessageId(null)
      abortControllerRef.current = null
      // Only reset to idle here if TTS is not enabled
      if (!textToSpeechService.isEnabled()) {
        avatarStateService.setState('idle', 'ChatPanel:streamFinally')
      }
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [inputValue, isStreaming, messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (voiceState === 'Listening') {
        e.preventDefault()
        handleVoiceCancel()
        return
      }
      if (ttsState === 'Speaking') {
        e.preventDefault()
        textToSpeechService.stop()
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Compute placeholder dynamically
  let inputPlaceholder = 'Type a message or click 🎤 to speak…'
  if (isStreaming) {
    inputPlaceholder = 'ARIA is responding…'
  } else if (voiceConvEvent.mode === 'continuous') {
    if (voiceConvEvent.stage === 'listening') {
      inputPlaceholder = '🎙️ Hands-free mode active: speak naturally hands-free (or type)...'
    } else if (voiceConvEvent.stage === 'processing') {
      inputPlaceholder = '⚡ ARIA is thinking...'
    } else if (voiceConvEvent.stage === 'speaking') {
      inputPlaceholder = '🔊 ARIA is speaking... (speak anytime to interrupt)'
    } else if (voiceConvEvent.stage === 'interrupted') {
      inputPlaceholder = '⚡ Interrupted! ARIA is listening...'
    }
  } else if (voiceConvEvent.mode === 'wake_word') {
    inputPlaceholder = '👂 Wake word active: say "Hey ARIA" to talk (or type)...'
  } else if (voiceState === 'Listening') {
    inputPlaceholder = voiceHypothesis ? `Hearing: "${voiceHypothesis}"` : '🎤 Listening... Speak naturally'
  } else if (voiceState === 'Processing') {
    inputPlaceholder = 'Transcribing speech…'
  } else if (voiceState === 'Requesting Permission') {
    inputPlaceholder = 'Requesting microphone access…'
  }

  return (
    <div className={styles.chatPanel}>
      {/* ── Chat Header with Provider & TTS Indicators ── */}
      <div className={styles.chatHeader} id="chat-header">
        <div className={styles.headerTitle}>
          <span>Live Conversation</span>
        </div>
        <div className={styles.headerControls}>
          {/* Hands-Free Voice Mode Badge / Toggle */}
          <button
            id="chat-voice-mode-btn"
            type="button"
            className={[
              styles.voiceConvHeaderBadge,
              voiceConvEvent.mode === 'continuous' ? styles.voiceConvBadgeContinuous : '',
              voiceConvEvent.mode === 'wake_word' ? styles.voiceConvBadgeWakeWord : '',
              voiceConvEvent.mode === 'off' ? styles.voiceConvBadgeOff : '',
            ].join(' ')}
            onClick={() => voiceConversationService.toggleMode()}
            title={
              voiceConvEvent.mode === 'continuous'
                ? 'Continuous Voice: ACTIVE (Click to switch to Wake Word)'
                : voiceConvEvent.mode === 'wake_word'
                ? 'Wake Word: "Hey ARIA" (Click to turn off)'
                : 'Voice Mode: OFF (Click to start Continuous Voice)'
            }
            aria-label="Toggle hands-free voice mode"
          >
            <span
              className={[
                styles.voiceConvDot,
                voiceConvEvent.mode === 'continuous' ? styles.voiceConvDotContinuous : '',
                voiceConvEvent.mode === 'wake_word' ? styles.voiceConvDotWakeWord : '',
              ].join(' ')}
              aria-hidden="true"
            />
            <span className={styles.voiceConvLabel}>
              {voiceConvEvent.mode === 'continuous'
                ? '🎙️ Live Voice'
                : voiceConvEvent.mode === 'wake_word'
                ? '👂 Hey ARIA'
                : '🎙️ Voice Off'}
            </span>
          </button>

          <button
            id="chat-tts-header-badge"
            type="button"
            className={[
              styles.ttsHeaderBadge,
              ttsEnabled ? styles.ttsHeaderBadgeActive : styles.ttsHeaderBadgeMuted,
              ttsState === 'Speaking' ? styles.ttsHeaderBadgeSpeaking : '',
            ].join(' ')}
            onClick={handleToggleTTS}
            title={ttsEnabled ? 'Voice Output ON — Click to mute' : 'Voice Output OFF — Click to enable'}
          >
            <span className={styles.ttsHeaderDot} aria-hidden="true" />
            <span className={styles.ttsHeaderLabel}>
              {ttsState === 'Speaking' ? '🔊 Speaking' : ttsEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
            </span>
          </button>

          <div
            id="chat-provider-indicator"
            className={[
              styles.providerBadge,
              activeProviderType === 'local' ? styles.providerBadgeLocal : styles.providerBadgeCloud,
            ].join(' ')}
            title={`Active Engine: ${activeProviderType === 'local' ? 'Local AI (Ollama: llama3.2:3b)' : 'Cloud AI (OpenAI)'}`}
          >
            <span className={styles.providerDot} aria-hidden="true" />
            <span className={styles.providerLabel}>
              {activeProviderType === 'local' ? '🟢 Local AI' : '☁ Cloud AI'}
            </span>
            <span className={styles.providerModel}>
              {activeProviderType === 'local' ? 'llama3.2:3b' : cloudModel}
            </span>
          </div>
        </div>
      </div>

      {/* ── Message List ── */}
      <div
        className={styles.messageList}
        ref={messageListRef}
        id="chat-message-list"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && msg.id === streamingMessageId}
          />
        ))}
      </div>

      {/* ── Hands-Free Voice Conversation Status Banner ── */}
      {voiceConvEvent.mode !== 'off' && (
        <div
          className={[
            styles.voiceConvBanner,
            voiceConvEvent.stage === 'listening' ? styles.voiceConvBannerListening : '',
            voiceConvEvent.stage === 'speaking' ? styles.voiceConvBannerSpeaking : '',
            voiceConvEvent.stage === 'processing' ? styles.voiceConvBannerProcessing : '',
            voiceConvEvent.stage === 'interrupted' ? styles.voiceConvBannerInterrupted : '',
          ].join(' ')}
          id="hands-free-voice-banner"
          role="status"
          aria-live="polite"
        >
          <div className={styles.voiceConvIndicator}>
            <span className={styles.voiceConvPulseDot} aria-hidden="true" />
            <div className={styles.voiceConvStatusText}>
              {voiceConvEvent.stage === 'listening' && (
                <span>
                  <strong>🎤 {voiceConvEvent.mode === 'wake_word' ? 'Waiting for "Hey ARIA"...' : 'Live Voice Listening:'}</strong>{' '}
                  {voiceConvEvent.transcript ? (
                    <span className={styles.liveVoiceHypothesis}>"{voiceConvEvent.transcript}"</span>
                  ) : (
                    'Speak naturally hands-free'
                  )}
                </span>
              )}
              {voiceConvEvent.stage === 'processing' && (
                <span><strong>⚡ ARIA is thinking...</strong></span>
              )}
              {voiceConvEvent.stage === 'speaking' && (
                <span><strong>🔊 ARIA is speaking...</strong> (Speak anytime to interrupt)</span>
              )}
              {voiceConvEvent.stage === 'interrupted' && (
                <span><strong>⚡ Interrupted!</strong> Listening to your reply...</span>
              )}
            </div>
          </div>
          <div className={styles.voiceConvControls}>
            {voiceConvEvent.stage === 'speaking' && (
              <button
                type="button"
                className={styles.voiceInterruptBtn}
                onClick={() => voiceConversationService.interrupt('ChatPanel:interruptBtn')}
                title="Interrupt ARIA speech"
                id="voice-barge-in-btn"
              >
                Interrupt
              </button>
            )}
            <button
              type="button"
              className={styles.voiceModeToggleBtn}
              onClick={() => voiceConversationService.toggleMode()}
              title="Change Voice Mode"
              id="voice-cycle-mode-btn"
            >
              {voiceConvEvent.mode === 'continuous' ? 'Wake Word' : 'Turn Off'}
            </button>
          </div>
        </div>
      )}

      {/* ── TTS Speaking Banner (Visible while ARIA is Speaking) ── */}
      {ttsState === 'Speaking' && voiceConvEvent.mode === 'off' && (
        <div className={styles.ttsSpeakingBanner} id="tts-speaking-banner" role="status" aria-live="polite">
          <div className={styles.ttsIndicator}>
            <div className={styles.ttsWaveContainer} aria-hidden="true">
              <span className={styles.ttsWave} />
              <span className={styles.ttsWave} />
              <span className={styles.ttsWave} />
              <span className={styles.ttsWave} />
            </div>
            <div className={styles.ttsStatusText}>
              <strong>🔊 ARIA is speaking...</strong>
            </div>
          </div>
          <button
            id="tts-stop-btn"
            type="button"
            className={styles.ttsStopButton}
            onClick={handleTTSStop}
            title="Stop speaking (Esc)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* ── Voice Feedback Banner (Visible while Listening) ── */}
      {voiceState === 'Listening' && (
        <div className={styles.voiceBanner} id="voice-listening-banner" role="status" aria-live="polite">
          <div className={styles.voiceIndicator}>
            <div className={styles.voiceWaveContainer} aria-hidden="true">
              <span className={styles.voiceWave} />
              <span className={styles.voiceWave} />
              <span className={styles.voiceWave} />
              <span className={styles.voiceWave} />
            </div>
            <div className={styles.voiceStatusText}>
              {voiceHypothesis ? (
                <span>
                  <strong className={styles.voiceHearingLabel}>Hearing:</strong> {voiceHypothesis}
                </span>
              ) : (
                <span>
                  <strong>🎤 Listening...</strong> Speak naturally
                </span>
              )}
            </div>
          </div>
          <div className={styles.voiceActions}>
            <button
              id="voice-stop-btn"
              type="button"
              className={styles.voiceStopButton}
              onClick={handleVoiceStop}
              title="Stop listening and transcribe"
            >
              Done
            </button>
            <button
              id="voice-cancel-btn"
              type="button"
              className={styles.voiceCancelButton}
              onClick={handleVoiceCancel}
              title="Cancel voice input (Esc)"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Voice Error Banner ── */}
      {voiceState === 'Error' && voiceError && (
        <div className={styles.voiceErrorBanner} id="voice-error-banner" role="alert">
          <span className={styles.voiceErrorIcon} aria-hidden="true">⚠️</span>
          <span className={styles.voiceErrorMessage}>{voiceError}</span>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className={styles.inputBar} id="chat-input-bar">
        {/* Microphone button — functional Hands-free / Voice Input */}
        <button
          className={[
            styles.micButton,
            voiceConvEvent.mode !== 'off' ? styles.micButtonListening : '',
            voiceState === 'Listening' ? styles.micButtonListening : '',
            voiceState === 'Processing' ? styles.micButtonProcessing : '',
            voiceState === 'Requesting Permission' ? styles.micButtonRequesting : '',
            voiceState === 'Idle' && voiceConvEvent.mode === 'off' ? styles.micButtonReady : '',
          ].join(' ')}
          disabled={isStreaming}
          onClick={handleMicClick}
          title={
            voiceConvEvent.mode === 'continuous'
              ? 'Live Voice active — Click to change mode'
              : voiceConvEvent.mode === 'wake_word'
              ? 'Wake Word "Hey ARIA" active — Click to turn off'
              : 'Click to start Hands-Free Voice Mode'
          }
          aria-label={
            voiceConvEvent.mode !== 'off'
              ? 'Voice mode active — click to cycle'
              : 'Start hands-free voice mode'
          }
          id="mic-btn"
          type="button"
        >
          {/* Status dot on the mic button */}
          <span
            id="mic-status-indicator"
            className={[
              styles.micStatusDot,
              voiceConvEvent.mode === 'continuous' ? styles.micStatusDotListening : '',
              voiceConvEvent.mode === 'wake_word' ? styles.micStatusDotProcessing : '',
              voiceConvEvent.mode === 'off' && voiceState === 'Listening' ? styles.micStatusDotListening : '',
              voiceConvEvent.mode === 'off' && voiceState === 'Processing' ? styles.micStatusDotProcessing : '',
              voiceConvEvent.mode === 'off' && voiceState === 'Requesting Permission' ? styles.micStatusDotRequesting : '',
              voiceConvEvent.mode === 'off' && voiceState === 'Error' ? styles.micStatusDotError : '',
              voiceConvEvent.mode === 'off' && voiceState === 'Idle' ? styles.micStatusDotIdle : '',
            ].join(' ')}
            aria-hidden="true"
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Voice Output (TTS) quick toggle */}
        <button
          id="voice-output-toggle-btn"
          type="button"
          className={[
            styles.ttsToggleButton,
            ttsEnabled ? styles.ttsToggleActive : styles.ttsToggleInactive,
            ttsState === 'Speaking' ? styles.ttsToggleSpeaking : '',
          ].join(' ')}
          onClick={handleToggleTTS}
          title={
            ttsState === 'Speaking'
              ? 'ARIA is speaking — click to stop'
              : ttsEnabled
              ? 'Voice Output: ON (click to mute)'
              : 'Voice Output: Muted (click to enable)'
          }
          aria-label={ttsEnabled ? 'Mute AI voice output' : 'Enable AI voice output'}
        >
          {ttsEnabled ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          id="chat-text-input"
          type="text"
          className={styles.textInput}
          placeholder={inputPlaceholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          maxLength={2000}
          autoComplete="off"
          aria-label="Message input"
        />

        {/* Action button: Stop while streaming, Send otherwise */}
        {isStreaming ? (
          <button
            id="stop-btn"
            type="button"
            className={styles.stopButton}
            onClick={handleStop}
            aria-label="Stop generation"
            title="Stop generation"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            id="send-btn"
            type="button"
            className={styles.sendButton}
            onClick={sendMessage}
            disabled={!inputValue.trim()}
            aria-label="Send message"
            title="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22,2 15,22 11,13 2,9" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default ChatPanel
