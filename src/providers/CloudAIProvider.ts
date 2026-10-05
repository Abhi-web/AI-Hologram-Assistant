import type {
  AIProvider,
  AIMessage,
  AIProviderConfig,
  StreamOptions,
  ConnectionStatus,
  ProviderTestResult,
} from './AIProvider'

/**
 * CloudAIProvider — Production-ready Cloud AI provider powered by OpenAI.
 *
 * Architecture:
 *   React UI  →  ChatService  →  AIProviderManager  →  CloudAIProvider  →  Electron Main IPC  →  OpenAI API
 *
 * Security Note:
 *   API keys are NEVER handled or stored in the renderer process.
 *   All credential management, network transport, and model execution occur
 *   inside the secure Electron main process.
 */
export class CloudAIProvider implements AIProvider {
  readonly config: AIProviderConfig = {
    type: 'cloud',
    displayName: 'Cloud AI',
    description: 'Powered by OpenAI — state-of-the-art models via secure cloud API.',
    setupHint: 'Requires an OpenAI API key (configured securely in Settings)',
  }

  /**
   * Generate an AI response incrementally, streaming chunks to options.onChunk().
   *
   * @param messages - Conversation message history
   * @param options  - Streaming options containing onChunk callback and optional AbortSignal
   * @returns Complete accumulated response text
   */
  async generateStreamResponse(
    messages: AIMessage[],
    options: StreamOptions
  ): Promise<string> {
    const cloudApi = window.electronAPI?.cloudAI

    if (!cloudApi) {
      throw new Error(
        'Cloud AI requires the desktop application environment. Please run the app in Electron.'
      )
    }

    // Verify key presence before attempting to stream
    const config = await cloudApi.getConfig()
    if (!config.configured) {
      throw new Error(
        'Cloud AI is not configured. Configure a cloud provider or switch to Local AI.'
      )
    }

    console.log(
      `[CloudAIProvider] Initiating streaming chat through secure Electron backend (${messages.length} messages, model: ${config.model})`
    )

    try {
      const result = await cloudApi.streamChat(messages, options.onChunk, options.signal)
      return result
    } catch (err: unknown) {
      if (
        options.signal?.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        console.log('[CloudAIProvider] Cloud generation cancelled by user.')
        return ''
      }

      console.error('[CloudAIProvider] Error during cloud generation:', err)
      throw err
    }
  }

  /**
   * Generate a complete AI response (convenience wrapper delegating to streaming).
   */
  async generateResponse(messages: AIMessage[]): Promise<string> {
    return this.generateStreamResponse(messages, {
      onChunk: () => {},
    })
  }

  /**
   * Probe whether the Cloud AI provider is configured and available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const cloudApi = window.electronAPI?.cloudAI
      if (!cloudApi) return false
      const config = await cloudApi.getConfig()
      return Boolean(config?.configured)
    } catch {
      return false
    }
  }

  /**
   * Diagnostic method to test connection to Cloud AI (OpenAI API).
   * Tests ONLY the Cloud AI provider.
   */
  async testConnection(): Promise<ProviderTestResult> {
    const cloudApi = window.electronAPI?.cloudAI
    if (!cloudApi) {
      return {
        success: false,
        status: 'Error',
        error: 'Cloud AI requires the desktop application environment. Please run the app in Electron.',
      }
    }

    const config = await cloudApi.getConfig()
    if (!config.configured) {
      return {
        success: false,
        status: 'Not Configured',
        error: 'Cloud AI is not configured. Configure a cloud provider or switch to Local AI.',
      }
    }

    try {
      const res = await cloudApi.testConnection()
      if (res.success) {
        return {
          success: true,
          status: 'Connected',
          latencyMs: res.latencyMs,
          message: `Connected to OpenAI (${res.model || config.model}). Latency: ${res.latencyMs}ms.`,
        }
      } else {
        return {
          success: false,
          status: 'Error',
          error: res.error || 'Failed to authenticate with OpenAI API.',
        }
      }
    } catch (err) {
      return {
        success: false,
        status: 'Error',
        error: err instanceof Error ? err.message : 'Failed to connect to Cloud AI.',
      }
    }
  }

  /**
   * Return high-level connection status.
   */
  async getStatus(): Promise<ConnectionStatus> {
    const cloudApi = window.electronAPI?.cloudAI
    if (!cloudApi) return 'Not Configured'
    try {
      const config = await cloudApi.getConfig()
      return config.configured ? 'Connected' : 'Not Configured'
    } catch {
      return 'Disconnected'
    }
  }
}

