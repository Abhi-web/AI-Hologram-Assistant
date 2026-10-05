import type { Message } from '../types'
import type { AIMessage, ProviderType } from '../providers/AIProvider'
import { aiProviderManager } from '../providers/AIProviderManager'
import { companionBehaviorEngine } from './CompanionBehaviorEngine'

const SYSTEM_PROMPT =
  'You are ARIA, a friendly, warm, playful, curious, and expressive 3D virtual AI companion. ' +
  'You are attentive, natural, and helpful. In voice conversations, keep your answers concise, clear, and ' +
  'conversational (1 to 3 sentences) so dialogue feels lively and instant. Never be overly dramatic, ' +
  'and never use markdown or lists that sound awkward when spoken out loud.'

/**
 * ChatService — Service layer connecting the Chat UI to the active AI Provider.
 *
 * Architecture:
 *   UI (ChatPanel)  ──►  ChatService  ──►  AIProviderManager  ──►  Active AIProvider
 *                            │
 *                            ▼
 *                 CompanionBehaviorEngine (Emotion & Intent Detection)
 *
 * Responsibilities:
 *  - Formats and sanitizes UI messages into provider-agnostic AIMessage[]
 *  - Injects system prompt context
 *  - Drives emotion/intent detection and companion behaviors on user prompts
 *  - Routes execution to the currently active provider via AIProviderManager
 *  - Handles errors gracefully without crashing the UI
 */
export class ChatService {
  /**
   * Send a conversation history to the currently active AI provider and get a response.
   *
   * @param messages - Full history of chat messages from the UI
   * @returns Generated assistant response text
   */
  public async sendMessage(messages: Message[]): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMessage) {
      companionBehaviorEngine.onUserMessage(lastUserMessage.content)
    }

    const aiMessages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    try {
      const activeProvider = aiProviderManager.getActiveProvider()
      const response = await activeProvider.generateResponse(aiMessages)
      if (response) {
        companionBehaviorEngine.onAIResponseComplete(response)
      }
      return response
    } catch (error) {
      console.error('[ChatService] Error generating response from active provider:', error)
      if (error instanceof Error && error.message) {
        return error.message
      }
      return (
        'An error occurred while communicating with the AI provider. ' +
        'Please check your AI Engine settings and try again.'
      )
    }
  }

  /**
   * Send conversation history and stream chunks incrementally to options.onChunk().
   *
   * @param messages - Full history of chat messages from the UI
   * @param options  - Streaming options with onChunk callback and optional AbortSignal
   * @returns Complete accumulated response text
   */
  public async streamMessage(
    messages: Message[],
    options: { onChunk: (chunk: string) => void; signal?: AbortSignal }
  ): Promise<string> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMessage) {
      companionBehaviorEngine.onUserMessage(lastUserMessage.content)
    }

    const aiMessages: AIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    try {
      const activeProvider = aiProviderManager.getActiveProvider()
      const originalOnChunk = options.onChunk
      const wrappedOptions = {
        ...options,
        onChunk: (chunk: string) => {
          companionBehaviorEngine.onAIStreamChunk(chunk)
          originalOnChunk(chunk)
        },
      }

      const response = await activeProvider.generateStreamResponse(aiMessages, wrappedOptions)
      if (response) {
        companionBehaviorEngine.onAIResponseComplete(response)
      }
      return response
    } catch (error) {
      if (
        options.signal?.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        console.log('[ChatService] Stream generation was cancelled.')
        return ''
      }
      console.error('[ChatService] Error streaming response from active provider:', error)
      if (error instanceof Error && error.message) {
        return error.message
      }
      return (
        'An error occurred while communicating with the AI provider. ' +
        'Please check your AI Engine settings and try again.'
      )
    }
  }

  /**
   * Get the display name of the currently active provider.
   */
  public getActiveProviderName(): string {
    return aiProviderManager.getActiveProvider().config.displayName
  }

  /**
   * Get the active provider type ('local' | 'cloud').
   */
  public getActiveProviderType(): ProviderType {
    return aiProviderManager.getActiveProviderType()
  }

  /**
   * Subscribe to provider changes.
   */
  public subscribeToProvider(listener: (type: ProviderType) => void): () => void {
    return aiProviderManager.subscribe(listener)
  }
}

/**
 * Singleton instance of the chat service.
 */
export const chatService = new ChatService()
