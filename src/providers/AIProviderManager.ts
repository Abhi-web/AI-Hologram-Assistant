import type { AIProvider, AIProviderConfig, ProviderType } from './AIProvider'
import { LocalAIProvider } from './LocalAIProvider'
import { CloudAIProvider } from './CloudAIProvider'

const STORAGE_KEY = 'ai-hologram-provider'
const DEFAULT_PROVIDER: ProviderType = 'local'

type ProviderListener = (type: ProviderType) => void

/**
 * AIProviderManager — Central registry and lifecycle manager for AI providers.
 *
 * Responsibilities:
 *  - Maintains registered provider instances (Local AI, Cloud AI, future runtimes)
 *  - Tracks active provider and persists selection across restarts in localStorage
 *  - Emits change events so UI components can update reactively
 *  - Provides metadata lists to the Settings UI without exposing internal logic
 */
export class AIProviderManager {
  private providers = new Map<ProviderType, AIProvider>()
  private activeType: ProviderType = DEFAULT_PROVIDER
  private listeners: Set<ProviderListener> = new Set()

  constructor() {
    // Register default providers
    this.registerProvider(new LocalAIProvider())
    this.registerProvider(new CloudAIProvider())

    // Restore saved provider preference
    this.activeType = this.loadSavedProvider()
  }

  /**
   * Load the active provider preference from localStorage with validation.
   */
  private loadSavedProvider(): ProviderType {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY) as ProviderType | null
        if (saved && this.providers.has(saved)) {
          return saved
        }
      }
    } catch {
      // Fallback gracefully if localStorage is restricted
    }
    return DEFAULT_PROVIDER
  }

  /**
   * Register a new AI provider (extensible for Ollama, Gemini, OpenAI, etc.)
   */
  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.config.type, provider)
  }

  /**
   * Returns the currently active AI provider instance.
   */
  public getActiveProvider(): AIProvider {
    const provider = this.providers.get(this.activeType)
    if (!provider) {
      // Safety fallback to first registered provider
      const fallback = this.providers.values().next().value
      if (!fallback) {
        throw new Error('No AI providers registered in AIProviderManager.')
      }
      return fallback
    }
    return provider
  }

  /**
   * Returns a specific provider instance by type (for testing or status queries).
   */
  public getProvider(type: ProviderType): AIProvider | undefined {
    return this.providers.get(type)
  }

  /**
   * Returns the active provider type ('local' | 'cloud').
   */
  public getActiveProviderType(): ProviderType {
    return this.activeType
  }

  /**
   * Set the active provider, persist choice to localStorage, and notify listeners.
   */
  public setActiveProvider(type: ProviderType): void {
    if (!this.providers.has(type)) {
      console.warn(`[AIProviderManager] Attempted to set unknown provider: "${type}"`)
      return
    }

    if (this.activeType === type) return

    this.activeType = type

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, type)
      }
    } catch (err) {
      console.error('[AIProviderManager] Failed to persist provider to localStorage:', err)
    }

    this.notifyListeners()
  }

  /**
   * Returns config metadata for all registered providers (for Settings UI).
   */
  public getAvailableProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values()).map((p) => p.config)
  }

  /**
   * Subscribe to provider changes. Returns an unsubscribe cleanup function.
   */
  public subscribe(listener: ProviderListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.activeType)
      } catch (err) {
        console.error('[AIProviderManager] Error in listener callback:', err)
      }
    }
  }
}

/**
 * Singleton instance of the provider manager for application-wide use.
 */
export const aiProviderManager = new AIProviderManager()
