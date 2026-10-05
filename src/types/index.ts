/** Top-level navigation screens */
export type Screen = 'welcome' | 'workspace'

/** Sidebar navigation sections */
export type NavSection = 'assistant' | 'chat' | 'voice' | 'memory' | 'search' | 'settings'

/** A single message in the chat conversation */
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/** Re-export AI Provider types for convenient import */
export type { ProviderType, AIProviderConfig, AIMessage } from '../providers/AIProvider'

