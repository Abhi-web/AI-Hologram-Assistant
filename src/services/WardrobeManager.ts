// ─── Wardrobe Manager Service ───────────────────────────────────────────────
// Centralized state manager and registry for ARIA 3D Avatar Wardrobe System.
// Handles outfit selection, persistence, custom outfit uploads, and notifications.

import {
  type Outfit,
  type WardrobeState,
  type WardrobeListener,
  BUILTIN_OUTFITS,
} from '../components/avatar/wardrobe/WardrobeTypes'

const STORAGE_KEY_CURRENT = 'aria_wardrobe_current_outfit'
const STORAGE_KEY_DEFAULT = 'aria_wardrobe_default_outfit'
const STORAGE_KEY_CUSTOM = 'aria_wardrobe_custom_outfits'

export class WardrobeManager {
  private currentOutfitId: string
  private defaultOutfitId = 'aria-black-gothic-dress'
  private customOutfits: Outfit[] = []
  private isEquipping = false
  private errorNotice: string | null = null
  private listeners: Set<WardrobeListener> = new Set()

  constructor() {
    this.customOutfits = this.loadCustomOutfits()
    this.defaultOutfitId = this.loadDefaultOutfitId()
    this.currentOutfitId = this.loadCurrentOutfitId()
  }

  // ─── Storage Persistence ────────────────────────────────────────────────────

  private loadDefaultOutfitId(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_DEFAULT)
        if (saved) return saved
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to read default outfit from storage:', e)
    }
    return 'aria-black-gothic-dress'
  }

  private loadCurrentOutfitId(): string {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_CURRENT)
        if (saved && this.getOutfitById(saved)) {
          return saved
        }
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to read current outfit from storage:', e)
    }
    return this.defaultOutfitId
  }

  private saveCurrentOutfitId(id: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_CURRENT, id)
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to persist current outfit to storage:', e)
    }
  }

  private loadCustomOutfits(): Outfit[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(STORAGE_KEY_CUSTOM)
        if (saved) {
          return JSON.parse(saved) as Outfit[]
        }
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to load custom outfits from storage:', e)
    }
    return []
  }

  private saveCustomOutfits(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(this.customOutfits))
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to persist custom outfits to storage:', e)
    }
  }

  // ─── State Accessors ────────────────────────────────────────────────────────

  public getState(): WardrobeState {
    return {
      currentOutfitId: this.currentOutfitId,
      defaultOutfitId: this.defaultOutfitId,
      outfits: this.getAvailableOutfits(),
      isEquipping: this.isEquipping,
      errorNotice: this.errorNotice,
    }
  }

  public getAvailableOutfits(): Outfit[] {
    return [...BUILTIN_OUTFITS, ...this.customOutfits]
  }

  public getOutfitById(id: string): Outfit | undefined {
    return this.getAvailableOutfits().find((o) => o.id === id)
  }

  public getCurrentOutfit(): Outfit {
    const found = this.getOutfitById(this.currentOutfitId)
    if (found) return found
    return BUILTIN_OUTFITS[0]
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  public async equipOutfit(outfitId: string): Promise<boolean> {
    const outfit = this.getOutfitById(outfitId)
    if (!outfit) {
      this.setErrorNotice(`Outfit with id "${outfitId}" not found in wardrobe registry.`)
      return false
    }

    if (this.currentOutfitId === outfitId) {
      return true
    }

    this.isEquipping = true
    this.errorNotice = null
    this.notify()

    try {
      this.currentOutfitId = outfitId
      this.saveCurrentOutfitId(outfitId)
      this.isEquipping = false
      this.notify()
      console.log(`[WardrobeManager] Successfully equipped outfit "${outfit.name}" (${outfit.id})`)
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown outfit equipping error'
      this.isEquipping = false
      this.setErrorNotice(msg)
      this.notify()
      return false
    }
  }

  public setDefaultOutfit(outfitId: string): void {
    if (!this.getOutfitById(outfitId)) return
    this.defaultOutfitId = outfitId
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_DEFAULT, outfitId)
      }
    } catch (e) {
      console.warn('[WardrobeManager] Failed to persist default outfit:', e)
    }
    this.notify()
  }

  public setErrorNotice(error: string | null): void {
    this.errorNotice = error
    this.notify()
  }

  public addCustomOutfit(outfit: Omit<Outfit, 'isBuiltIn'>): boolean {
    if (this.getOutfitById(outfit.id)) {
      this.setErrorNotice(`An outfit with ID "${outfit.id}" already exists.`)
      return false
    }

    const newOutfit: Outfit = {
      ...outfit,
      isBuiltIn: false,
      createdAt: Date.now(),
    }

    this.customOutfits.push(newOutfit)
    this.saveCustomOutfits()
    this.errorNotice = null
    this.notify()
    return true
  }

  public removeCustomOutfit(outfitId: string): boolean {
    const idx = this.customOutfits.findIndex((o) => o.id === outfitId)
    if (idx === -1) return false

    this.customOutfits.splice(idx, 1)
    this.saveCustomOutfits()

    if (this.currentOutfitId === outfitId) {
      this.equipOutfit(this.defaultOutfitId)
    } else {
      this.notify()
    }
    return true
  }

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  public subscribe(listener: WardrobeListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    const state = this.getState()
    this.listeners.forEach((l) => {
      try {
        l(state)
      } catch (e) {
        console.error('[WardrobeManager] Listener error:', e)
      }
    })
  }
}

export const wardrobeManager = new WardrobeManager()
