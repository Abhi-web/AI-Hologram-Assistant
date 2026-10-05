import { useState, useEffect, useCallback } from 'react'
import type { ProviderType, AIProviderConfig, ConnectionStatus, ProviderTestResult } from '../providers/AIProvider'
import { aiProviderManager } from '../providers/AIProviderManager'
import { textToSpeechService, type TTSVoice } from '../services/TextToSpeechService'
import styles from './SettingsPanel.module.css'

function ProviderIcon({ type }: { type: ProviderType }) {
  if (type === 'local') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    )
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  )
}

function StatusPill({ status, id }: { status: ConnectionStatus; id?: string }) {
  let pillClass = styles.statusNotConfigured
  let dotClass = styles.statusDotNotConfigured

  switch (status) {
    case 'Connected':
      pillClass = styles.statusConnected
      dotClass = styles.statusDotConnected
      break
    case 'Disconnected':
      pillClass = styles.statusDisconnected
      dotClass = styles.statusDotDisconnected
      break
    case 'Checking':
      pillClass = styles.statusTesting
      dotClass = styles.statusDotTesting
      break
    case 'Error':
      pillClass = styles.statusFailed
      dotClass = styles.statusDotFailed
      break
    case 'Not Configured':
    default:
      pillClass = styles.statusNotConfigured
      dotClass = styles.statusDotNotConfigured
      break
  }

  return (
    <div className={`${styles.statusPill} ${pillClass}`} id={id}>
      <span className={`${styles.statusDot} ${dotClass}`} />
      <span>{status}</span>
    </div>
  )
}

function SettingsPanel() {
  const [activeType, setActiveType] = useState<ProviderType>(() =>
    aiProviderManager.getActiveProviderType()
  )
  const [providers] = useState<AIProviderConfig[]>(() =>
    aiProviderManager.getAvailableProviders()
  )

  // Local AI state
  const [localStatus, setLocalStatus] = useState<ConnectionStatus>('Checking')
  const [localTestResult, setLocalTestResult] = useState<ProviderTestResult | null>(null)
  const [isTestingLocal, setIsTestingLocal] = useState(false)

  // Cloud AI configuration state
  const [cloudConfig, setCloudConfig] = useState<CloudAIConfig | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini')
  const [cloudStatus, setCloudStatus] = useState<ConnectionStatus>('Checking')
  const [cloudTestResult, setCloudTestResult] = useState<ProviderTestResult | null>(null)
  const [isTestingCloud, setIsTestingCloud] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)

  // Load cloud config from Electron backend on mount
  const loadCloudConfig = useCallback(async () => {
    try {
      const cloudApi = window.electronAPI?.cloudAI
      if (cloudApi) {
        const cfg = await cloudApi.getConfig()
        setCloudConfig(cfg)
        if (cfg.model) {
          setSelectedModel(cfg.model)
        }
        setCloudStatus(cfg.configured ? 'Connected' : 'Not Configured')
      } else {
        setCloudStatus('Not Configured')
      }
    } catch (err) {
      console.error('[SettingsPanel] Failed to fetch cloud config:', err)
      setCloudStatus('Error')
    }
  }, [])

  // Probe Local AI status on mount
  const probeLocalStatus = useCallback(async () => {
    try {
      const localProv = aiProviderManager.getProvider('local')
      if (localProv?.getStatus) {
        const s = await localProv.getStatus()
        setLocalStatus(s)
      }
    } catch {
      setLocalStatus('Disconnected')
    }
  }, [])

  useEffect(() => {
    // Subscribe to external changes from aiProviderManager
    const unsubscribe = aiProviderManager.subscribe((newType) => {
      setActiveType(newType)
    })
    loadCloudConfig()
    probeLocalStatus()
    return unsubscribe
  }, [loadCloudConfig, probeLocalStatus])

  function handleSelectProvider(type: ProviderType) {
    aiProviderManager.setActiveProvider(type)
    setActiveType(type)
  }

  // ── Local AI Test Connection (Tests ONLY Local AI) ──
  async function handleTestLocal() {
    setIsTestingLocal(true)
    setLocalStatus('Checking')
    setLocalTestResult(null)

    try {
      const localProv = aiProviderManager.getProvider('local')
      if (localProv?.testConnection) {
        const res = await localProv.testConnection()
        setLocalTestResult(res)
        setLocalStatus(res.status)
      } else {
        setLocalStatus('Disconnected')
      }
    } catch (err) {
      setLocalStatus('Error')
      setLocalTestResult({
        success: false,
        status: 'Error',
        error: err instanceof Error ? err.message : 'Failed to connect to local Ollama.',
      })
    } finally {
      setIsTestingLocal(false)
    }
  }

  // ── Cloud AI Model Change ──
  async function handleModelChange(newModel: string) {
    setSelectedModel(newModel)
    setCloudTestResult(null)
    try {
      const cloudApi = window.electronAPI?.cloudAI
      if (cloudApi) {
        const updated = await cloudApi.saveConfig({ model: newModel })
        setCloudConfig((prev) => (prev ? { ...prev, model: updated.model } : null))
        if (cloudConfig?.configured) {
          setCloudStatus('Connected')
        }
      }
    } catch (err) {
      console.error('[SettingsPanel] Failed to update model:', err)
    }
  }

  // ── Cloud AI Save Key ──
  async function handleSaveKey(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = keyInput.trim()
    if (!trimmed) return

    setIsSaving(true)
    setSaveFeedback(null)
    setCloudTestResult(null)

    try {
      const cloudApi = window.electronAPI?.cloudAI
      if (cloudApi) {
        const updated = await cloudApi.saveConfig({ apiKey: trimmed, model: selectedModel })
        setCloudConfig(updated)
        setKeyInput('')
        setCloudStatus('Connected')
        setSaveFeedback('API key saved securely')
        setTimeout(() => setSaveFeedback(null), 3500)
      } else {
        setSaveFeedback('Desktop environment not detected.')
      }
    } catch (err) {
      console.error('[SettingsPanel] Failed to save key:', err)
      setSaveFeedback('Failed to save API key.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Cloud AI Clear Key ──
  async function handleClearKey() {
    if (!confirm('Are you sure you want to remove the stored OpenAI API key?')) return
    setIsSaving(true)
    setCloudTestResult(null)
    try {
      const cloudApi = window.electronAPI?.cloudAI
      if (cloudApi) {
        const updated = await cloudApi.saveConfig({ apiKey: '' })
        setCloudConfig(updated)
        setKeyInput('')
        setCloudStatus('Not Configured')
        setSaveFeedback('API key removed')
        setTimeout(() => setSaveFeedback(null), 3000)
      }
    } catch (err) {
      console.error('[SettingsPanel] Failed to clear key:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Cloud AI Test Connection (Tests ONLY Cloud AI) ──
  async function handleTestCloud() {
    setIsTestingCloud(true)
    setCloudStatus('Checking')
    setCloudTestResult(null)

    try {
      const cloudProv = aiProviderManager.getProvider('cloud')
      if (cloudProv?.testConnection) {
        const res = await cloudProv.testConnection()
        setCloudTestResult(res)
        setCloudStatus(res.status)
      } else {
        setCloudStatus('Error')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown connection error'
      setCloudStatus('Error')
      setCloudTestResult({
        success: false,
        status: 'Error',
        error: errorMsg,
      })
    } finally {
      setIsTestingCloud(false)
    }
  }

  // ─── Voice Output (TTS) Configuration State ─────────────────────────────────
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => textToSpeechService.isEnabled())
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => textToSpeechService.getSelectedVoice())
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([])
  const [isTestingVoice, setIsTestingVoice] = useState(false)

  useEffect(() => {
    // Load voices from speech engine
    textToSpeechService.getVoices().then((voices) => {
      setAvailableVoices(voices)
      if (!selectedVoiceURI && voices.length > 0) {
        const defaultVoice = voices.find((v) => v.default) || voices[0]
        setSelectedVoiceURI(defaultVoice.voiceURI || defaultVoice.name)
      }
    })

    const unsubscribeTTS = textToSpeechService.subscribe((state, voice) => {
      setTtsEnabled(textToSpeechService.isEnabled())
      if (voice) setSelectedVoiceURI(voice)
      setIsTestingVoice(state === 'Speaking')
    })

    return () => unsubscribeTTS()
  }, [selectedVoiceURI])

  function handleToggleTTSEnabled(enabled: boolean) {
    textToSpeechService.setEnabled(enabled)
    setTtsEnabled(enabled)
  }

  function handleSelectVoice(voiceURI: string) {
    textToSpeechService.setSelectedVoice(voiceURI)
    setSelectedVoiceURI(voiceURI)
  }

  function handleTestVoice() {
    if (isTestingVoice) {
      textToSpeechService.stop()
      setIsTestingVoice(false)
    } else {
      setIsTestingVoice(true)
      textToSpeechService.speak(
        'Hello! I am ARIA, your personal AI Hologram Assistant. Voice output is active and working properly.'
      )
    }
  }

  // ── Desktop Hologram Mode State (Stage 10) ──
  const [hologramConfig, setHologramConfig] = useState<HologramConfig | null>(null)
  const [isHologramOpen, setIsHologramOpen] = useState(false)
  const [isLaunchingHologram, setIsLaunchingHologram] = useState(false)
  const [hologramFeedback, setHologramFeedback] = useState<string | null>(null)

  useEffect(() => {
    const hologramApi = window.electronAPI?.hologram
    if (hologramApi) {
      hologramApi
        .getSettings()
        .then((cfg) => {
          setHologramConfig(cfg)
          setIsHologramOpen(Boolean(cfg.isOpen))
        })
        .catch((err) => console.error('[SettingsPanel] Failed to load hologram settings:', err))

      const unsub = hologramApi.onStateChange((state) => {
        setIsHologramOpen(state.isOpen)
        setHologramConfig((prev) => (prev ? { ...prev, ...state } : null))
      })
      return () => {
        if (typeof unsub === 'function') unsub()
      }
    }
  }, [])

  const handleLaunchHologram = async () => {
    setIsLaunchingHologram(true)
    setHologramFeedback(null)
    try {
      const res = await window.electronAPI?.hologram?.launch()
      if (res?.success) {
        setIsHologramOpen(true)
        setHologramFeedback('Desktop Hologram window opened successfully.')
      } else {
        setHologramFeedback('Failed to open hologram window.')
      }
    } catch (err) {
      setHologramFeedback('Error launching hologram mode.')
    } finally {
      setIsLaunchingHologram(false)
      setTimeout(() => setHologramFeedback(null), 3500)
    }
  }

  const handleCloseHologram = async () => {
    try {
      await window.electronAPI?.hologram?.close()
      setIsHologramOpen(false)
      setHologramFeedback('Hologram window closed.')
      setTimeout(() => setHologramFeedback(null), 3000)
    } catch (err) {
      console.error('[SettingsPanel] Failed to close hologram:', err)
    }
  }

  const handleToggleHologramAlwaysOnTop = async (checked: boolean) => {
    try {
      await window.electronAPI?.hologram?.setAlwaysOnTop(checked)
      setHologramConfig((prev) => (prev ? { ...prev, alwaysOnTop: checked } : null))
    } catch (err) {
      console.error('[SettingsPanel] Failed to update always on top:', err)
    }
  }

  const handleToggleHologramMiniChat = async (checked: boolean) => {
    try {
      await window.electronAPI?.hologram?.saveSettings({ showMiniChat: checked })
      setHologramConfig((prev) => (prev ? { ...prev, showMiniChat: checked } : null))
    } catch (err) {
      console.error('[SettingsPanel] Failed to update showMiniChat:', err)
    }
  }

  const handleToggleHologramClickThrough = async (checked: boolean) => {
    try {
      await window.electronAPI?.hologram?.setClickThrough(checked)
      setHologramConfig((prev) => (prev ? { ...prev, clickThrough: checked } : null))
    } catch (err) {
      console.error('[SettingsPanel] Failed to update clickThrough:', err)
    }
  }

  return (
    <div className={styles.settingsPanel} id="settings-panel">
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.settingsIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
          <h2 className={styles.title}>System Settings</h2>
        </div>
        <p className={styles.subtitle}>
          Configure assistant runtime parameters, intelligence engine, and active providers.
        </p>
      </div>

      {/* ── AI Engine Section ── */}
      <section className={styles.section} id="settings-ai-engine" aria-labelledby="ai-engine-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionHeading} id="ai-engine-heading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              AI Engine Selection
            </h3>
            <p className={styles.sectionDesc}>
              Select the active intelligence provider. The assistant's conversation runtime will route all new requests through the chosen engine.
            </p>
          </div>
          <span className={styles.sectionTag}>Stage 5I Architecture</span>
        </div>

        {/* ── Provider Options Grid ── */}
        <div className={styles.providerGrid} role="radiogroup" aria-label="AI Engine Provider Selection">
          {providers.map((p) => {
            const isSelected = activeType === p.type
            const isLocal = p.type === 'local'
            return (
              <div
                key={p.type}
                id={`provider-option-${p.type}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                className={[
                  styles.providerCard,
                  isSelected ? styles.providerCardActive : '',
                ].join(' ')}
                onClick={() => handleSelectProvider(p.type)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    handleSelectProvider(p.type)
                  }
                }}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.providerMeta}>
                    <div className={styles.providerIconWrap} aria-hidden="true">
                      <ProviderIcon type={p.type} />
                    </div>
                    <div>
                      <span className={styles.providerName}>{p.displayName}</span>
                      <div className={styles.providerEngineSub}>
                        {isLocal ? 'Ollama • llama3.2:3b' : `OpenAI • ${selectedModel}`}
                      </div>
                    </div>
                  </div>
                  <div className={styles.radioIndicator} aria-hidden="true">
                    <span className={styles.radioDot} />
                  </div>
                </div>

                <p className={styles.providerDesc}>{p.description}</p>

                <div className={styles.cardFooter}>
                  <div className={styles.cardStatusRow}>
                    <span className={styles.cardStatusLabel}>Engine Status:</span>
                    <StatusPill
                      status={isLocal ? localStatus : cloudStatus}
                      id={`card-status-${p.type}`}
                    />
                  </div>

                  <div className={styles.statusPill}>
                    <span
                      className={[
                        styles.statusDot,
                        isSelected ? styles.statusDotActive : '',
                      ].join(' ')}
                    />
                    <span>{isSelected ? 'Active Engine' : 'Standby'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Local AI Diagnostics Section ── */}
      <section className={styles.section} id="settings-local-ai" aria-labelledby="local-ai-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionHeading} id="local-ai-heading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Local AI Engine (Ollama)
            </h3>
            <p className={styles.sectionDesc}>
              Runs open-source models completely locally on your machine without cloud dependencies.
            </p>
          </div>
          <div className={styles.statusHeaderWrap}>
            <StatusPill status={localStatus} id="local-status-pill" />
          </div>
        </div>

        {/* Local AI Details Card */}
        <div className={styles.cloudSummaryCard}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Runtime</span>
            <span className={styles.summaryValue}>Ollama HTTP</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Local Model</span>
            <span className={styles.summaryValue}>llama3.2:3b</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Endpoint</span>
            <span className={styles.summaryValue}>http://127.0.0.1:11434</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Privacy</span>
            <span className={styles.summaryBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              100% On-Device
            </span>
          </div>
        </div>

        {/* Local AI Test Connection Action */}
        <div className={styles.testActionSection}>
          <button
            id="local-test-connection-btn"
            type="button"
            className={styles.testBtn}
            onClick={handleTestLocal}
            disabled={isTestingLocal}
          >
            {isTestingLocal ? (
              <>
                <span className={styles.btnSpinner} aria-hidden="true" />
                Testing connection to Ollama…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Test Local AI Connection
              </>
            )}
          </button>
        </div>

        {/* Local AI Test Result Banner */}
        {localTestResult && (
          <div
            id="local-test-result"
            className={[
              styles.testResultBanner,
              localTestResult.success ? styles.testResultSuccess : styles.testResultError,
            ].join(' ')}
          >
            <div className={styles.resultIconWrap}>
              {localTestResult.success ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            <div>
              <div className={styles.resultTitle}>
                {localTestResult.success ? 'Local AI Connected' : 'Local AI Connection Failed'}
              </div>
              <div className={styles.resultDetail}>
                {localTestResult.success
                  ? `${localTestResult.message} • Latency: ${localTestResult.latencyMs}ms`
                  : localTestResult.error}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Cloud AI Configuration Section ── */}
      <section className={styles.section} id="settings-cloud-ai" aria-labelledby="cloud-ai-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionHeading} id="cloud-ai-heading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
              Cloud AI Configuration (OpenAI)
            </h3>
            <p className={styles.sectionDesc}>
              Configure OpenAI API authentication, select your model, and test connectivity. Credentials are encrypted and kept exclusively in the Electron main process.
            </p>
          </div>
          <div className={styles.statusHeaderWrap}>
            <StatusPill status={cloudStatus} id="cloud-status-pill" />
          </div>
        </div>

        {/* ── Current Status & Masked Key Summary ── */}
        <div className={styles.cloudSummaryCard}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Model</span>
            <span className={styles.summaryValue}>{selectedModel}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Stored Key</span>
            <span className={styles.summaryValue}>
              {cloudConfig?.configured && cloudConfig.maskedKey
                ? cloudConfig.maskedKey
                : 'None configured'}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Security</span>
            <span className={styles.summaryBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Electron SafeStorage
            </span>
          </div>
        </div>

        {/* ── Model Selector ── */}
        <div className={styles.configGroup}>
          <label htmlFor="cloud-model-select" className={styles.fieldLabel}>
            OpenAI Model
          </label>
          <div className={styles.selectWrapper}>
            <select
              id="cloud-model-select"
              className={styles.modelSelect}
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (Recommended — Fast, lightweight, efficient)</option>
              <option value="gpt-4o">gpt-4o (Flagship — Maximum intelligence & multimodal)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy — Fast text model)</option>
            </select>
          </div>
          <p className={styles.fieldHint}>
            Selected model will be used when Cloud AI is the active engine.
          </p>
        </div>

        {/* ── API Key Input Form ── */}
        <div className={styles.configGroup}>
          <label htmlFor="cloud-api-key-input" className={styles.fieldLabel}>
            OpenAI API Key
          </label>
          <form onSubmit={handleSaveKey} className={styles.keyInputRow}>
            <div className={styles.inputContainer}>
              <input
                id="cloud-api-key-input"
                type={showKey ? 'text' : 'password'}
                className={styles.keyInput}
                placeholder={
                  cloudConfig?.configured && cloudConfig.maskedKey
                    ? `Configured (${cloudConfig.maskedKey}) — enter new key to replace`
                    : 'sk-proj-...'
                }
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              id="cloud-save-key-btn"
              type="submit"
              className={styles.saveBtn}
              disabled={!keyInput.trim() || isSaving}
            >
              {isSaving ? 'Saving…' : 'Save Key'}
            </button>

            {cloudConfig?.configured && (
              <button
                id="cloud-clear-key-btn"
                type="button"
                className={styles.clearBtn}
                onClick={handleClearKey}
                disabled={isSaving}
                title="Remove stored API key"
              >
                Clear Key
              </button>
            )}
          </form>

          {saveFeedback && (
            <p className={styles.saveFeedback} id="save-feedback-message">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {saveFeedback}
            </p>
          )}

          <p className={styles.fieldHint}>
            Your key is never sent to any intermediary server. All requests are routed through the secure Electron desktop backend to api.openai.com.
          </p>
        </div>

        {/* ── Test Connection Section (Tests ONLY Cloud AI) ── */}
        <div className={styles.testActionSection}>
          <button
            id="cloud-test-connection-btn"
            type="button"
            className={styles.testBtn}
            onClick={handleTestCloud}
            disabled={isTestingCloud || !cloudConfig?.configured}
          >
            {isTestingCloud ? (
              <>
                <span className={styles.btnSpinner} aria-hidden="true" />
                Testing connection to OpenAI…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Test Cloud AI Connection
              </>
            )}
          </button>

          {!cloudConfig?.configured && (
            <span className={styles.testDisabledNotice}>
              Configure and save an OpenAI API key above to enable testing.
            </span>
          )}
        </div>

        {/* ── Test Result Banner ── */}
        {cloudTestResult && (
          <div
            id="cloud-test-result"
            className={[
              styles.testResultBanner,
              cloudTestResult.success ? styles.testResultSuccess : styles.testResultError,
            ].join(' ')}
          >
            {cloudTestResult.success ? (
              <>
                <div className={styles.resultIconWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div className={styles.resultTitle}>Connection Established Successfully</div>
                  <div className={styles.resultDetail}>
                    {cloudTestResult.message} • Latency: <strong>{cloudTestResult.latencyMs}ms</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.resultIconWrap}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <div className={styles.resultTitle}>Connection Failed</div>
                  <div className={styles.resultDetail}>{cloudTestResult.error || 'Failed to authenticate with OpenAI.'}</div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Voice Output (Text-to-Speech) Section ── */}
      <section className={styles.section} id="settings-voice-output" aria-labelledby="voice-output-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionHeading} id="voice-output-heading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Voice Output (Text-to-Speech)
            </h3>
            <p className={styles.sectionDesc}>
              Configure speech synthesis to convert assistant text responses into natural spoken audio via your Windows speakers.
            </p>
          </div>
          <span className={styles.sectionTag}>Stage 7 Feature</span>
        </div>

        <div className={styles.configCard}>
          {/* Enabled Toggle */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Enable Voice Output</span>
              <span className={styles.settingHint}>Automatically speak completed AI responses through default audio device</span>
            </div>
            <label className={styles.toggleSwitch} htmlFor="tts-enabled-toggle">
              <input
                id="tts-enabled-toggle"
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => handleToggleTTSEnabled(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {/* Voice Selection Dropdown */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <label htmlFor="tts-voice-select" className={styles.settingLabel}>Speech Voice</label>
              <span className={styles.settingHint}>Select from local Windows SAPI / OneCore speech voices</span>
            </div>
            <select
              id="tts-voice-select"
              className={styles.selectInput}
              value={selectedVoiceURI || ''}
              onChange={(e) => handleSelectVoice(e.target.value)}
              disabled={!ttsEnabled}
            >
              {availableVoices.length === 0 ? (
                <option value="">Default System Voice</option>
              ) : (
                availableVoices.map((v) => (
                  <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                    {v.name} ({v.lang}){v.default ? ' — Default' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Test Voice Action */}
          <div className={styles.testVoiceRow}>
            <button
              id="tts-test-btn"
              type="button"
              className={styles.testBtn}
              onClick={handleTestVoice}
              disabled={!ttsEnabled}
            >
              {isTestingVoice ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                  </svg>
                  Stop Test Voice
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  Test Voice
                </>
              )}
            </button>
            <span className={styles.testVoiceDesc}>
              {isTestingVoice ? '🔊 Speaking sample phrase…' : 'Plays a sample voice introduction through your speakers'}
            </span>
          </div>
        </div>
      </section>

      {/* ── Desktop Hologram Mode Section (Stage 10) ── */}
      <section className={styles.section} id="settings-desktop-hologram" aria-labelledby="desktop-hologram-heading">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionHeading} id="desktop-hologram-heading">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Desktop Hologram Mode
            </h3>
            <p className={styles.sectionDesc}>
              Launch ARIA as a floating holographic assistant directly on your Windows desktop. Features a frameless, transparent window, always-on-top positioning, and integrated voice & mini-chat.
            </p>
          </div>
          <div className={styles.statusHeaderWrap}>
            <div className={`${styles.statusPill} ${isHologramOpen ? styles.statusConnected : styles.statusNotConfigured}`}>
              <span className={`${styles.statusDot} ${isHologramOpen ? styles.statusDotConnected : styles.statusDotNotConfigured}`} />
              <span>{isHologramOpen ? 'Hologram Active' : 'Hologram Standby'}</span>
            </div>
          </div>
        </div>

        {/* Hologram Launch / Status Card */}
        <div className={styles.hologramLaunchCard}>
          <div className={styles.hologramCardContent}>
            <div className={styles.hologramVisualPreview}>
              <div className={styles.hologramPreviewRings}>
                <span className={styles.previewRing} />
                <span className={styles.previewRing} />
                <span className={styles.previewRing} />
              </div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className={styles.hologramDetails}>
              <h4 className={styles.hologramCardTitle}>Floating Holographic Avatar</h4>
              <p className={styles.hologramCardDesc}>
                Separates the 3D avatar viewport into a dedicated, frameless transparent overlay that stays visible above your desktop workspaces, IDEs, and browser windows.
              </p>
              <div className={styles.hologramSpecs}>
                <span className={styles.specBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg>
                  True Windows DWM Transparency
                </span>
                <span className={styles.specBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  Always on Top
                </span>
                <span className={styles.specBadge}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  Draggable & Resizable
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.hologramActionBtns}>
            <button
              id="hologram-launch-btn"
              type="button"
              className={styles.hologramLaunchBtn}
              onClick={handleLaunchHologram}
              disabled={isLaunchingHologram}
            >
              {isLaunchingHologram ? (
                <>
                  <span className={styles.btnSpinner} aria-hidden="true" />
                  <span>Launching Hologram…</span>
                </>
              ) : isHologramOpen ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  <span>Focus Hologram Window</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Launch Desktop Hologram</span>
                </>
              )}
            </button>

            {isHologramOpen && (
              <button
                id="hologram-close-btn"
                type="button"
                className={styles.hologramCloseBtn}
                onClick={handleCloseHologram}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Close Hologram Window</span>
              </button>
            )}
          </div>

          {hologramFeedback && (
            <div className={styles.hologramFeedbackMessage}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{hologramFeedback}</span>
            </div>
          )}
        </div>

        {/* Configuration Toggles */}
        <div className={styles.configCard}>
          {/* Always on Top */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Always on Top</span>
              <span className={styles.settingHint}>Keep hologram window floating above other applications and windows</span>
            </div>
            <label className={styles.toggleSwitch} htmlFor="hologram-always-on-top-toggle">
              <input
                id="hologram-always-on-top-toggle"
                type="checkbox"
                checked={hologramConfig?.alwaysOnTop ?? true}
                onChange={(e) => handleToggleHologramAlwaysOnTop(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {/* Show Mini-Chat by Default */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Display Mini-Chat by Default</span>
              <span className={styles.settingHint}>Show collapsible conversation stream below the avatar when opened</span>
            </div>
            <label className={styles.toggleSwitch} htmlFor="hologram-mini-chat-toggle">
              <input
                id="hologram-mini-chat-toggle"
                type="checkbox"
                checked={hologramConfig?.showMiniChat ?? true}
                onChange={(e) => handleToggleHologramMiniChat(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {/* Click-Through Mode */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Click-Through Mode</span>
              <span className={styles.settingHint}>Pass mouse clicks directly through the hologram to underlying desktop windows (Off by default)</span>
            </div>
            <label className={styles.toggleSwitch} htmlFor="hologram-click-through-toggle">
              <input
                id="hologram-click-through-toggle"
                type="checkbox"
                checked={hologramConfig?.clickThrough ?? false}
                onChange={(e) => handleToggleHologramClickThrough(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {/* Window Memory Status */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Remembered Window Bounds</span>
              <span className={styles.settingHint}>
                Window position and dimensions are automatically remembered and restored across sessions
              </span>
            </div>
            <div className={styles.boundsBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              <span>
                {hologramConfig?.bounds
                  ? `${hologramConfig.bounds.width} × ${hologramConfig.bounds.height} px ${
                      hologramConfig.bounds.x !== undefined && hologramConfig.bounds.y !== undefined
                        ? `at (${hologramConfig.bounds.x}, ${hologramConfig.bounds.y})`
                        : ''
                    }`
                  : '420 × 580 px (Default)'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Notice Banner ── */}
      <div className={styles.noticeBanner} id="provider-persistence-notice">
        <svg className={styles.noticeIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <div>
          <strong>Persistence: </strong>
          Active provider selection (<strong>{activeType === 'local' ? 'Local AI' : 'Cloud AI'}</strong>) is saved locally in storage and persists automatically across application restarts.
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel


