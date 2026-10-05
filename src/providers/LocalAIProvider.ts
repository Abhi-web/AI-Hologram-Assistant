import type {
  AIProvider,
  AIMessage,
  AIProviderConfig,
  StreamOptions,
  ConnectionStatus,
  ProviderTestResult,
} from './AIProvider'

// Candidate endpoints for Ollama on Windows (127.0.0.1 avoids IPv6 resolution delays)
const OLLAMA_HOSTS = ['http://127.0.0.1:11434', 'http://localhost:11434']
const OLLAMA_MODEL = 'llama3.2:3b'

interface OllamaChatResponse {
  model: string
  created_at: string
  message?: {
    role: string
    content: string
  }
  done: boolean
  error?: string
}

interface OllamaTagsResponse {
  models?: Array<{
    name: string
    model?: string
  }>
}

/**
 * LocalAIProvider — Communicates with the locally installed Ollama runtime
 * via Ollama's HTTP API (/api/chat).
 *
 * Architecture:
 *   React UI  →  ChatService  →  AIProviderManager  →  LocalAIProvider  →  Ollama (llama3.2:3b)
 */
export class LocalAIProvider implements AIProvider {
  readonly config: AIProviderConfig = {
    type: 'local',
    displayName: 'Local AI',
    description: 'Runs models entirely on your machine — private and offline-capable.',
    setupHint: `Powered by local Ollama (${OLLAMA_MODEL})`,
  }

  private activeHost: string = OLLAMA_HOSTS[0]

  /**
   * Helper to perform fetch against candidate Ollama endpoints, preferring the last-working host.
   */
  private async fetchOllama(
    endpoint: string,
    options: RequestInit
  ): Promise<{ response: Response; baseUrl: string }> {
    // Prioritize last known working host to avoid reconnection trial delays
    const candidateHosts = [
      this.activeHost,
      ...OLLAMA_HOSTS.filter((h) => h !== this.activeHost),
    ]
    let lastError: unknown = null

    for (const baseUrl of candidateHosts) {
      try {
        const url = `${baseUrl}${endpoint}`
        const response = await fetch(url, options)
        this.activeHost = baseUrl
        return { response, baseUrl }
      } catch (err) {
        lastError = err
      }
    }

    throw lastError
  }

  /**
   * Generate an AI response incrementally, emitting chunks to options.onChunk().
   *
   * @param messages - Complete message history
   * @param options  - Streaming options containing onChunk callback and optional AbortSignal
   * @returns          The complete accumulated response string
   */
  async generateStreamResponse(
    messages: AIMessage[],
    options: StreamOptions
  ): Promise<string> {
    const startTime = Date.now()

    let response: Response
    let usedUrl = ''

    try {
      const payload = {
        model: OLLAMA_MODEL,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        keep_alive: '15m', // Keep model resident in memory to eliminate reload delay
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 256, // Fast conversational length
        },
      }

      const res = await this.fetchOllama('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      })

      response = res.response
      usedUrl = res.baseUrl
    } catch (networkError) {
      if (
        options.signal?.aborted ||
        (networkError instanceof Error && networkError.name === 'AbortError')
      ) {
        console.log('[LocalAIProvider] Generation was cancelled before response started.')
        return ''
      }
      console.error(
        '[LocalAIProvider] Network error connecting to Ollama on all candidate hosts:',
        networkError
      )
      throw new Error(
        'Local AI is unavailable. Start Ollama or switch to Cloud AI.'
      )
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} (${response.statusText})`
      try {
        const errorData = (await response.json()) as { error?: string }
        if (errorData?.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Fall back to HTTP status
      }

      console.error(`[LocalAIProvider] Ollama returned non-OK response: ${errorMessage}`)

      if (response.status === 404 || errorMessage.toLowerCase().includes('not found')) {
        throw new Error(
          `Model "${OLLAMA_MODEL}" was not found in Ollama. Please run "ollama pull ${OLLAMA_MODEL}" in your terminal to install it.`
        )
      }

      throw new Error(`Ollama API error: ${errorMessage}`)
    }

    if (!response.body) {
      throw new Error('Ollama response body is null.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let accumulated = ''
    let chunkCount = 0

    try {
      while (true) {
        if (options.signal?.aborted) {
          console.log('[LocalAIProvider] Streaming cancelled by user abort signal.')
          try {
            await reader.cancel()
          } catch {
            // ignore cancel error
          }
          return accumulated
        }

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const parsed = JSON.parse(trimmed) as OllamaChatResponse
            if (parsed.error) {
              throw new Error(`Ollama error: ${parsed.error}`)
            }

            const piece = parsed.message?.content
            if (piece) {
              accumulated += piece
              chunkCount++
              options.onChunk(piece)
            }
          } catch (parseErr) {
            console.warn('[LocalAIProvider] Failed to parse stream chunk line:', parseErr)
          }
        }
      }

      // Flush remaining line in buffer if present
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as OllamaChatResponse
          const piece = parsed.message?.content
          if (piece) {
            accumulated += piece
            chunkCount++
            options.onChunk(piece)
          }
        } catch {
          // ignore leftover parse
        }
      }
    } catch (streamError) {
      if (
        options.signal?.aborted ||
        (streamError instanceof Error && streamError.name === 'AbortError')
      ) {
        console.log('[LocalAIProvider] Stream read aborted by user.')
        return accumulated
      }
      console.error('[LocalAIProvider] Error while reading stream:', streamError)
      throw new Error('Connection interrupted while streaming response from Ollama.')
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[LocalAIProvider] Stream complete from ${usedUrl}: ${chunkCount} chunks, ${accumulated.length} chars in ${elapsed}ms`
    )

    if (!options.signal?.aborted && !accumulated.trim()) {
      throw new Error('Received an empty response from the local AI model. Please try again.')
    }

    return accumulated
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
   * Probe whether Ollama is reachable and has the target model installed.
   * Does not throw — returns false on any failure.
   */
  async isAvailable(): Promise<boolean> {
    for (const baseUrl of OLLAMA_HOSTS) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)

        const res = await fetch(`${baseUrl}/api/tags`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) continue
        const data = (await res.json()) as OllamaTagsResponse
        const found = Boolean(
          data.models?.some(
            (m) =>
              m.name === OLLAMA_MODEL ||
              m.model === OLLAMA_MODEL ||
              m.name.startsWith(`${OLLAMA_MODEL}:`)
          )
        )
        if (found) return true
      } catch {
        // Try next host
      }
    }
    return false
  }

  /**
   * Diagnostic method to test connection to local Ollama and verify the llama3.2:3b model.
   * Tests ONLY the local Ollama provider.
   */
  async testConnection(): Promise<ProviderTestResult> {
    const startTime = Date.now()
    for (const baseUrl of OLLAMA_HOSTS) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(`${baseUrl}/api/tags`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!res.ok) continue

        const data = (await res.json()) as OllamaTagsResponse
        const modelFound = Boolean(
          data.models?.some(
            (m) =>
              m.name === OLLAMA_MODEL ||
              m.model === OLLAMA_MODEL ||
              m.name.startsWith(`${OLLAMA_MODEL}:`)
          )
        )

        const latencyMs = Date.now() - startTime

        if (modelFound) {
          return {
            success: true,
            status: 'Connected',
            latencyMs,
            message: `Ollama is reachable (${baseUrl}) and model "${OLLAMA_MODEL}" is ready.`,
          }
        } else {
          return {
            success: false,
            status: 'Error',
            latencyMs,
            error: `Ollama is running, but model "${OLLAMA_MODEL}" was not found. Please run "ollama pull ${OLLAMA_MODEL}".`,
          }
        }
      } catch {
        // Try next host
      }
    }

    return {
      success: false,
      status: 'Disconnected',
      error: 'Local AI is unavailable. Start Ollama or switch to Cloud AI.',
    }
  }

  /**
   * Return high-level connection status ('Connected' or 'Disconnected').
   */
  async getStatus(): Promise<ConnectionStatus> {
    const available = await this.isAvailable()
    return available ? 'Connected' : 'Disconnected'
  }
}


