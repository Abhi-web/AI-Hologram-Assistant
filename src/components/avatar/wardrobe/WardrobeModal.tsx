import { useState, useEffect } from 'react'
import { wardrobeManager } from '../../../services/WardrobeManager'
import type { Outfit, ClothingCategory, WardrobeState } from './WardrobeTypes'
import { WardrobeUploadModal } from './WardrobeUploadModal'
import styles from './WardrobeModal.module.css'

interface WardrobeModalProps {
  isOpen: boolean
  onClose: () => void
}

const CATEGORY_FILTERS: Array<{ id: ClothingCategory; label: string }> = [
  { id: 'ALL', label: 'All Outfits' },
  { id: 'GOTHIC', label: 'Gothic' },
  { id: 'LACE', label: 'Lace' },
  { id: 'CYBER', label: 'Cyber' },
  { id: 'DRESSES', label: 'Dresses' },
  { id: 'TOPS', label: 'Tops' },
  { id: 'BOTTOMS', label: 'Bottoms' },
]

export function WardrobeModal({ isOpen, onClose }: WardrobeModalProps) {
  const [wardrobeState, setWardrobeState] = useState<WardrobeState>(() => wardrobeManager.getState())
  const [selectedFilter, setSelectedFilter] = useState<ClothingCategory>('ALL')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [equippingId, setEquippingId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = wardrobeManager.subscribe((state) => {
      setWardrobeState(state)
    })
    return () => {
      unsub()
    }
  }, [])

  if (!isOpen) return null

  const handleEquip = async (outfit: Outfit) => {
    setEquippingId(outfit.id)
    try {
      await wardrobeManager.equipOutfit(outfit.id)
    } finally {
      setEquippingId(null)
    }
  }

  const handleSetDefault = (outfit: Outfit) => {
    wardrobeManager.setDefaultOutfit(outfit.id)
  }

  const handleDeleteCustom = (outfitId: string) => {
    if (confirm('Are you sure you want to remove this custom outfit?')) {
      wardrobeManager.removeCustomOutfit(outfitId)
    }
  }

  const filteredOutfits = wardrobeState.outfits.filter((outfit) => {
    if (selectedFilter === 'ALL') return true
    if (outfit.categoryFilter === selectedFilter) return true
    if (outfit.category.toUpperCase().includes(selectedFilter)) return true
    return outfit.components.some((c) => c.category === selectedFilter)
  })

  return (
    <div
      className={styles.modalBackdrop}
      onClick={onClose}
      id="aria-wardrobe-modal-backdrop"
      aria-modal="true"
      role="dialog"
    >
      <div
        className={styles.modalWindow}
        onClick={(e) => e.stopPropagation()}
        id="aria-wardrobe-modal"
      >
        {/* ── Modal Header ── */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon} aria-hidden="true">
              👗
            </span>
            <div>
              <h2 className={styles.title}>ARIA Wardrobe System</h2>
              <div className={styles.subtitle}>
                Real 3D Garment Rigging • Synchronous Humanoid Deformation
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.uploadTriggerBtn}
              onClick={() => setIsUploadOpen(true)}
              id="wardrobe-upload-open-btn"
              title="Add a new 3D outfit to wardrobe"
            >
              <span>+ Add Outfit</span>
            </button>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close Wardrobe Modal"
              id="wardrobe-modal-close-btn"
            >
              ✕
            </button>
          </div>
        </header>

        {/* ── Error Notification Banner ── */}
        {wardrobeState.errorNotice && (
          <div className={styles.errorBanner} id="wardrobe-error-banner">
            <span>⚠️ {wardrobeState.errorNotice}</span>
            <button
              type="button"
              className={styles.errorDismiss}
              onClick={() => wardrobeManager.setErrorNotice(null)}
              aria-label="Dismiss error notification"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Category Filter Bar ── */}
        <div className={styles.filterBar} role="tablist" aria-label="Wardrobe category filters">
          {CATEGORY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={selectedFilter === f.id}
              className={[
                styles.filterBtn,
                selectedFilter === f.id ? styles.filterBtnActive : '',
              ].join(' ')}
              onClick={() => setSelectedFilter(f.id)}
              id={`wardrobe-filter-${f.id.toLowerCase()}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Outfits Cards Grid ── */}
        <div className={styles.contentArea} id="wardrobe-outfits-grid">
          {filteredOutfits.map((outfit) => {
            const isEquipped = wardrobeState.currentOutfitId === outfit.id
            const isDefault = wardrobeState.defaultOutfitId === outfit.id
            const isBusy = equippingId === outfit.id || wardrobeState.isEquipping

            return (
              <div
                key={outfit.id}
                className={[
                  styles.outfitCard,
                  isEquipped ? styles.outfitCardEquipped : '',
                ].join(' ')}
                id={`outfit-card-${outfit.id}`}
              >
                {/* Visual Preview / Thumbnail */}
                <div className={styles.thumbnailWrapper}>
                  <img
                    src={outfit.thumbnailUrl}
                    alt={outfit.name}
                    className={styles.thumbnailImg}
                    loading="lazy"
                  />
                  <span className={styles.categoryTag}>{outfit.category}</span>

                  {isEquipped && (
                    <div className={styles.equippedBadge} id={`equipped-badge-${outfit.id}`}>
                      <span>✓ EQUIPPED</span>
                    </div>
                  )}

                  <span className={styles.assetBadge3D}>
                    {outfit.hasRigged3DAsset ? '⚡ Real 3D Rigged' : '📦 3D Asset Slot'}
                  </span>
                </div>

                {/* Card Information */}
                <div className={styles.cardBody}>
                  <h3 className={styles.outfitName}>{outfit.name}</h3>
                  <p className={styles.outfitDescription}>{outfit.description}</p>

                  {/* Included Garment Components */}
                  <div className={styles.componentsList} aria-label="Included Components">
                    {outfit.components.map((comp) => (
                      <span key={comp.id} className={styles.componentPill} title={comp.name}>
                        • {comp.name}
                      </span>
                    ))}
                  </div>

                  {/* Actions Bar */}
                  <div className={styles.cardActions}>
                    {isEquipped ? (
                      <div className={styles.equippedStateBtn}>Equipped</div>
                    ) : (
                      <button
                        type="button"
                        className={styles.equipBtn}
                        onClick={() => handleEquip(outfit)}
                        disabled={isBusy}
                        id={`outfit-equip-btn-${outfit.id}`}
                      >
                        {equippingId === outfit.id ? 'Equipping...' : 'Equip Outfit'}
                      </button>
                    )}

                    <button
                      type="button"
                      className={[
                        styles.defaultBtn,
                        isDefault ? styles.defaultBtnActive : '',
                      ].join(' ')}
                      onClick={() => handleSetDefault(outfit)}
                      title={isDefault ? 'Current default outfit on startup' : 'Set as default outfit on startup'}
                      id={`outfit-default-btn-${outfit.id}`}
                    >
                      {isDefault ? '★ Default' : 'Set Default'}
                    </button>

                    {!outfit.isBuiltIn && (
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteCustom(outfit.id)}
                        title="Delete custom outfit"
                        aria-label="Delete custom outfit"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Modal Footer ── */}
        <footer className={styles.footer}>
          <div className={styles.footerNote}>
            Active outfit: <strong>{wardrobeManager.getCurrentOutfit().name}</strong> (Persistent
            across sessions)
          </div>
          <div className={styles.footerNote}>
            3D clothing attaches directly to ARIA's skeleton without resetting facial expressions or AI state.
          </div>
        </footer>

        {/* ── Custom Outfit Upload Dialog ── */}
        {isUploadOpen && <WardrobeUploadModal onClose={() => setIsUploadOpen(false)} />}
      </div>
    </div>
  )
}

export default WardrobeModal
