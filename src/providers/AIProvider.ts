/**
 * AIProvider.ts — Core abstraction for the AI provider layer.
 *
 * Architecture:
 *   UI  →  ChatService  →  AIProviderManager  →  [LocalAIProvider | CloudAIProvider]
 *
 * UI components NEVER import this file.
 * They talk only to ChatService (responses) or AIProviderManager (settings).
 */

// ─── Provider Type ────────────────────────────────────────────────────────────

/**
 * Discriminator for the two provider categories.
 * Extend this union when adding a new provider category (e.g. 'self-hosted').
 */
export type ProviderType = 'local' | 'cloud'

// ─── Message Format ───────────────────────────────────────────────────────────

/**
 * Provider-agnostic message format passed to generateResponse().
 * Matches the OpenAI chat-completion message schema for maximum compatibility.
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// ─── Provider Metadata ────────────────────────────────────────────────────────

/**
 * Static, immutable metadata about a provider.
 * Used by the Settings UI — never contains credentials or runtime state.
 */
export interface AIProviderConfig {
  /** Unique identifier matching ProviderType */
  type: ProviderType
  /** Human-readable name shown in the UI */
  displayName: string
  /** One-line description of this provider's characteristics */
  description: string
  /** Short note telling the user what's needed to activate this provider */
  setupHint: string
}

// ─── Streaming Options ────────────────────────────────────────────────────────

/**
 * Callback invoked whenever a new text chunk is produced by the provider.
 */
export type StreamChunkCallback = (chunk: string) => void

/**
 * Streaming options supplied to generateStreamResponse().
 */
export interface StreamOptions {
  /** Invoked incrementally as text chunks arrive */
  onChunk: StreamChunkCallback
  /** Optional AbortSignal to cancel in-flight generation */
  signal?: AbortSignal
}

// ─── Connection Status ────────────────────────────────────────────────────────

/**
 * Standardized provider connection states required by Stage 5I.
 */
export type ConnectionStatus =
  | 'Connected'
  | 'Disconnected'
  | 'Not Configured'
  | 'Checking'
  | 'Error'

/**
 * Diagnostic result returned by provider testConnection().
 */
export interface ProviderTestResult {
  success: boolean
  status: ConnectionStatus
  latencyMs?: number
  message?: string
  error?: string
}

// ─── Core Contract ────────────────────────────────────────────────────────────

/**
 * AIProvider — the interface every provider implementation must satisfy.
 *
 * To add a new provider (e.g. Ollama, OpenAI, Anthropic, Gemini):
 *   1. Create `src/providers/<Name>Provider.ts` implementing this interface.
 *   2. Register it in `AIProviderManager` — no other files need to change.
 *   3. Optionally add a new ProviderType value above if it's a new category.
 */
export interface AIProvider {
  /** Immutable descriptor — safe to pass directly to the UI */
  readonly config: AIProviderConfig

  /**
   * Generate a complete AI response given the full conversation context.
   *
   * @param messages - Complete message history (system + prior turns + new user turn)
   * @returns           The assistant's response as a plain string
   * @throws            On unrecoverable network / model errors
   */
  generateResponse(messages: AIMessage[]): Promise<string>

  /**
   * Generate an AI response incrementally, emitting chunks to options.onChunk().
   *
   * @param messages - Complete message history
   * @param options  - Streaming options containing onChunk callback and optional AbortSignal
   * @returns          The complete accumulated response string
   * @throws           On unrecoverable network / model errors
   */
  generateStreamResponse(messages: AIMessage[], options: StreamOptions): Promise<string>

  /**
   * Probe whether this provider is currently reachable and configured.
   * Used exclusively by the Settings UI to render availability status.
   * Must NOT throw — return false on any error.
   */
  isAvailable(): Promise<boolean>

  /**
   * Optional diagnostic method to test connection and report latency / errors.
   */
  testConnection?(): Promise<ProviderTestResult>

  /**
   * Optional method to query current connection status without a full round-trip test.
   */
  getStatus?(): Promise<ConnectionStatus>
}
