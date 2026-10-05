import { useState, useRef } from 'react'
import { wardrobeManager } from '../../../services/WardrobeManager'
import { clothingAssetManager } from './ClothingAssetManager'
import type { ClothingCategory } from './WardrobeTypes'
import styles from './WardrobeModal.module.css'

interface WardrobeUploadModalProps {
  onClose: () => void
}

export function WardrobeUploadModal({ onClose }: WardrobeUploadModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ClothingCategory>('DRESSES')
  const [description, setDescription] = useState('')
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [garmentFile, setGarmentFile] = useState<File | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const glbInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Verify image type
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setThumbnailPreview(reader.result as string)
      setErrorMsg(null)
    }
    reader.readAsDataURL(file)
  }

  const handleGlbChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.glb') && !ext.endsWith('.gltf') && !ext.endsWith('.vrm')) {
      setErrorMsg('3D garment must be a .glb, .gltf, or .vrm file.')
      return
    }

    setGarmentFile(file)
    setErrorMsg(null)
    setIsValidating(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const validation = await clothingAssetManager.validateGarment(arrayBuffer)

      if (!validation.isValid) {
        setErrorMsg(
          validation.errorMessage ||
            'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.'
        )
      } else {
        setSuccessMsg(validation.details)
      }
    } catch (err: unknown) {
      setErrorMsg(
        'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.'
      )
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setErrorMsg('Please enter an outfit name.')
      return
    }

    if (!thumbnailPreview) {
      setErrorMsg('Please provide a reference image.')
      return
    }

    // Technical honesty check: if garment file is provided, create object URL; if not, create conceptual slot
    let modelUrl: string | null = null
    if (garmentFile) {
      modelUrl = URL.createObjectURL(garmentFile)
    }

    const outfitId = `custom-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`

    const added = wardrobeManager.addCustomOutfit({
      id: outfitId,
      name: name.trim(),
      category: `${category} / Custom`,
      categoryFilter: category,
      description: description.trim() || 'Custom user-uploaded wardrobe outfit for ARIA.',
      thumbnailUrl: thumbnailPreview,
      modelUrl: modelUrl,
      components: [
        { id: `${outfitId}-main`, name: `${name.trim()} Garment`, category: category },
      ],
      hasRigged3DAsset: !!modelUrl,
      tags: ['custom', category.toLowerCase()],
    })

    if (added) {
      onClose()
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalWindow}
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>✨</span>
            <div>
              <h2 className={styles.title}>Add Custom Outfit</h2>
              <div className={styles.subtitle}>Register new 3D clothing to ARIA's wardrobe</div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className={styles.errorBanner} style={{ margin: '1rem 1.75rem 0' }}>
            <span>⚠️ {errorMsg}</span>
            <button type="button" className={styles.errorDismiss} onClick={() => setErrorMsg(null)}>
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div
            className={styles.errorBanner}
            style={{
              margin: '1rem 1.75rem 0',
              background: 'rgba(16, 185, 129, 0.15)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7',
            }}
          >
            <span>✓ {successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem 1.75rem' }}>
          {/* Outfit Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              Outfit Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Victorian Velvet Gown"
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ClothingCategory)}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            >
              <option value="DRESSES">DRESSES</option>
              <option value="GOTHIC">GOTHIC</option>
              <option value="LACE">LACE</option>
              <option value="TOPS">TOPS</option>
              <option value="BOTTOMS">BOTTOMS</option>
              <option value="OUTERWEAR">OUTERWEAR</option>
              <option value="ACCESSORIES">ACCESSORIES</option>
              <option value="CYBER">CYBER</option>
            </select>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this outfit..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Reference Image Thumbnail */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              Reference Design Image (Thumbnail)
            </label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              style={{
                padding: '0.55rem 1rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px dashed rgba(0, 212, 255, 0.4)',
                borderRadius: '8px',
                color: '#00d4ff',
                cursor: 'pointer',
                fontSize: '0.8rem',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {thumbnailPreview ? '✓ Image Loaded (Click to Change)' : '📁 Select Reference Image'}
            </button>
            {thumbnailPreview && (
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <img
                  src={thumbnailPreview}
                  alt="Preview"
                  style={{
                    maxHeight: '120px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                  }}
                />
              </div>
            )}
          </div>

          {/* 3D Garment Asset */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                fontWeight: 600,
              }}
            >
              3D Rigged Garment File (.glb / .gltf)
            </label>
            <input
              ref={glbInputRef}
              type="file"
              accept=".glb,.gltf,.vrm"
              onChange={handleGlbChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => glbInputRef.current?.click()}
              disabled={isValidating}
              style={{
                padding: '0.55rem 1rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px dashed rgba(157, 78, 221, 0.4)',
                borderRadius: '8px',
                color: '#d8b4fe',
                cursor: 'pointer',
                fontSize: '0.8rem',
                width: '100%',
                textAlign: 'center',
              }}
            >
              {isValidating
                ? '⏳ Validating 3D Rigged Asset...'
                : garmentFile
                ? `✓ ${garmentFile.name} (Ready)`
                : '📦 Select 3D Garment File (GLB/GLTF)'}
            </button>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Note: If no 3D asset is provided, a conceptual asset slot is created for future rigging.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.1rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontSize: '0.82rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.equipBtn}
              style={{ flex: 'none', padding: '0.55rem 1.4rem' }}
              disabled={isValidating}
            >
              Add To Wardrobe
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
