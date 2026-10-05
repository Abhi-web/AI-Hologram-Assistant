import type { AvatarState } from '../components/avatar/AvatarState'

export type AvatarStateListener = (state: AvatarState, previousState: AvatarState) => void

/**
 * AvatarStateService — Central observable state service coordinating avatar states
 * (idle, listening, thinking, speaking) across UI, Chat, Voice, TTS, and 3D Avatar layers.
 */
export class AvatarStateService {
  private currentState: AvatarState = 'idle'
  private listeners: Set<AvatarStateListener> = new Set()

  public getState(): AvatarState {
    return this.currentState
  }

  public setState(newState: AvatarState, source = 'unknown'): void {
    if (this.currentState === newState) return

    const prev = this.currentState
    this.currentState = newState
    console.log(`[AvatarStateService] State changed: "${prev}" → "${newState}" (source: ${source})`)

    for (const listener of this.listeners) {
      try {
        listener(newState, prev)
      } catch (err) {
        console.error('[AvatarStateService] Error in state listener:', err)
      }
    }
  }

  public subscribe(listener: AvatarStateListener): () => void {
    this.listeners.add(listener)
    listener(this.currentState, this.currentState)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const avatarStateService = new AvatarStateService()
