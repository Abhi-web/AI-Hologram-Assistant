import { contextBridge, ipcRenderer } from 'electron'

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface CloudAIConfig {
  configured: boolean
  maskedKey: string
  model: string
  provider: string
}

export interface CloudAITestResult {
  success: boolean
  latencyMs?: number
  model?: string
  error?: string
}

export interface VoiceListeningResult {
  success: boolean
  text?: string
  error?: string
}

export interface HologramConfig {
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

export interface ElectronAPI {
  getVersion: () => Promise<string>
  cloudAI: {
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
  voice: {
    startListening: () => Promise<VoiceListeningResult>
    stopListening: () => Promise<{ success: boolean }>
    cancelListening: () => Promise<{ success: boolean }>
    getStatus: () => Promise<{ available: boolean }>
    onHypothesis: (callback: (text: string) => void) => () => void
  }
  hologram: {
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

// ─── Context Bridge ────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  cloudAI: {
    getConfig: () => ipcRenderer.invoke('cloud:get-config'),
    saveConfig: (config) => ipcRenderer.invoke('cloud:save-config', config),
    testConnection: () => ipcRenderer.invoke('cloud:test-connection'),
    streamChat: (messages, onChunk, signal) => {
      return new Promise<string>((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(2, 10)
        let accumulated = ''

        const chunkChannel = `cloud:chat-chunk:${requestId}`
        const listener = (_event: Electron.IpcRendererEvent, chunk: string) => {
          accumulated += chunk
          onChunk(chunk)
        }

        ipcRenderer.on(chunkChannel, listener)

        const abortHandler = () => {
          ipcRenderer.invoke('cloud:chat-abort', { requestId })
        }

        if (signal) {
          signal.addEventListener('abort', abortHandler)
        }

        ipcRenderer
          .invoke('cloud:chat-stream', { messages, requestId })
          .then((res: { success: boolean; aborted?: boolean; error?: string }) => {
            if (signal) {
              signal.removeEventListener('abort', abortHandler)
            }
            ipcRenderer.removeListener(chunkChannel, listener)

            if (!res.success) {
              reject(new Error(res.error || 'Failed to generate cloud AI response.'))
            } else {
              resolve(accumulated)
            }
          })
          .catch((err) => {
            if (signal) {
              signal.removeEventListener('abort', abortHandler)
            }
            ipcRenderer.removeListener(chunkChannel, listener)
            reject(err)
          })
      })
    },
  },
  voice: {
    startListening: () => ipcRenderer.invoke('voice:start-listening'),
    stopListening: () => ipcRenderer.invoke('voice:stop-listening'),
    cancelListening: () => ipcRenderer.invoke('voice:cancel-listening'),
    getStatus: () => ipcRenderer.invoke('voice:get-status'),
    onHypothesis: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
      ipcRenderer.on('voice:hypothesis', listener)
      return () => {
        ipcRenderer.removeListener('voice:hypothesis', listener)
      }
    },
  },
  hologram: {
    launch: () => ipcRenderer.invoke('hologram:launch'),
    close: () => ipcRenderer.invoke('hologram:close'),
    getSettings: () => ipcRenderer.invoke('hologram:get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('hologram:save-settings', settings),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('hologram:set-always-on-top', alwaysOnTop),
    setClickThrough: (clickThrough) => ipcRenderer.invoke('hologram:set-click-through', clickThrough),
    onStateChange: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: { isOpen: boolean; alwaysOnTop: boolean; showMiniChat: boolean; clickThrough: boolean }
      ) => callback(state)
      ipcRenderer.on('hologram:state-change', listener)
      return () => {
        ipcRenderer.removeListener('hologram:state-change', listener)
      }
    },
  },
} satisfies ElectronAPI)

