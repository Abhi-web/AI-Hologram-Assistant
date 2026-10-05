/// <reference types="vite/client" />

interface CloudAIConfig {
  configured: boolean
  maskedKey: string
  model: string
  provider: string
}

interface CloudAITestResult {
  success: boolean
  latencyMs?: number
  model?: string
  error?: string
}

interface VoiceListeningResult {
  success: boolean
  text?: string
  error?: string
}

interface HologramConfig {
  enabled: boolean
  alwaysOnTop: boolean
  showMiniChat: boolean
  clickThrough: boolean
  isOpen: boolean
  bounds?: {
    x?: number
    y?: number
    width: number
    height: number
  }
}

interface ElectronAPI {
  getVersion: () => Promise<string>
  cloudAI?: {
    getConfig: () => Promise<CloudAIConfig>
    saveConfig: (config: { apiKey?: string; model?: string }) => Promise<{
      success: boolean
      configured: boolean
      maskedKey: string
      model: string
      provider: string
    }>
    testConnection: () => Promise<CloudAITestResult>
    streamChat: (
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ) => Promise<string>
  }
  voice?: {
    startListening: () => Promise<VoiceListeningResult>
    stopListening: () => Promise<{ success: boolean }>
    cancelListening: () => Promise<{ success: boolean }>
    getStatus: () => Promise<{ available: boolean }>
    onHypothesis: (callback: (text: string) => void) => () => void
  }
  hologram?: {
    launch: () => Promise<{ success: boolean; isOpen: boolean }>
    close: () => Promise<{ success: boolean; isOpen: boolean }>
    getSettings: () => Promise<HologramConfig>
    saveSettings: (settings: Partial<HologramConfig>) => Promise<{ success: boolean } & HologramConfig>
    setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<{ success: boolean; alwaysOnTop: boolean }>
    setClickThrough: (clickThrough: boolean) => Promise<{ success: boolean; clickThrough: boolean }>
    onStateChange: (
      callback: (state: { isOpen: boolean; alwaysOnTop: boolean; showMiniChat: boolean; clickThrough: boolean }) => void
    ) => () => void
  }
}

interface Window {
  electronAPI?: ElectronAPI
}
