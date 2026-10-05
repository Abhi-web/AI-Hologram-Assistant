// ─── Wardrobe & 3D Clothing Types ──────────────────────────────────────────

export type ClothingCategory =
  | 'ALL'
  | 'GOTHIC'
  | 'LACE'
  | 'DRESSES'
  | 'TOPS'
  | 'BOTTOMS'
  | 'OUTERWEAR'
  | 'STOCKINGS'
  | 'SHOES'
  | 'ACCESSORIES'
  | 'CYBER'

export interface ClothingComponent {
  id: string
  name: string
  category: ClothingCategory
  slot?: string
  description?: string
}

export interface Outfit {
  id: string
  name: string
  category: string
  categoryFilter: ClothingCategory
  description: string
  thumbnailUrl: string
  modelUrl: string | null
  components: ClothingComponent[]
  isBuiltIn: boolean
  hasRigged3DAsset: boolean
  tags: string[]
  createdAt?: number
}

export interface WardrobeValidationResult {
  isValid: boolean
  errorMessage: string | null
  meshCount: number
  skinnedMeshCount: number
  detectedBones: string[]
  missingEssentialBones: string[]
  details: string
}

export interface WardrobeState {
  currentOutfitId: string
  defaultOutfitId: string
  outfits: Outfit[]
  isEquipping: boolean
  errorNotice: string | null
}

export type WardrobeListener = (state: WardrobeState) => void

export const BUILTIN_OUTFITS: Outfit[] = [
  {
    id: 'aria-black-gothic-dress',
    name: 'Black Gothic Dress',
    category: 'Gothic / Dress',
    categoryFilter: 'GOTHIC',
    description:
      'Elegant black gothic off-shoulder dress with puff sleeves, fitted corset waist, belt with gold buckle, layered asymmetrical skirt, back ribbon bow, and choker.',
    thumbnailUrl: `${import.meta.env.BASE_URL}wardrobe/thumbnails/aria-black-gothic-dress.jpg`,
    modelUrl: `${import.meta.env.BASE_URL}wardrobe/models/aria-black-gothic-dress.glb`,
    isBuiltIn: true,
    hasRigged3DAsset: true,
    tags: ['gothic', 'dress', 'corset', 'asymmetrical', 'ribbon', 'gold-buckle'],
    components: [
      { id: 'bgd-dress', name: 'Black Off-Shoulder Corset Dress', category: 'DRESSES' },
      { id: 'bgd-sleeves', name: 'Puff Sleeves', category: 'TOPS' },
      { id: 'bgd-belt', name: 'Waist Belt with Gold Buckle', category: 'ACCESSORIES' },
      { id: 'bgd-skirt', name: 'Layered Asymmetrical Gothic Skirt', category: 'BOTTOMS' },
      { id: 'bgd-bow', name: 'Back Ribbon Bow', category: 'ACCESSORIES' },
      { id: 'bgd-choker', name: 'Gothic Scalloped Choker', category: 'ACCESSORIES' },
      { id: 'bgd-stockings', name: 'Asymmetric Fishnet & Sheer Stockings', category: 'STOCKINGS' },
    ],
  },
  {
    id: 'aria-dark-lace-outfit',
    name: 'Dark Lace Outfit',
    category: 'Gothic / Lace',
    categoryFilter: 'LACE',
    description:
      'Intricate dark lace-inspired ensemble with front-tied lace top, sheer smoky dress layer, scalloped choker, arm bands, satin gloves, and thigh-high garter stockings.',
    thumbnailUrl: `${import.meta.env.BASE_URL}wardrobe/thumbnails/aria-dark-lace-outfit.jpg`,
    modelUrl: `${import.meta.env.BASE_URL}wardrobe/models/aria-dark-lace-outfit.glb`,
    isBuiltIn: true,
    hasRigged3DAsset: true,
    tags: ['lace', 'sheer', 'chiffon', 'garter', 'gloves', 'lingerie-couture'],
    components: [
      { id: 'dlo-top', name: 'Dark Lace Bra Top with Bow', category: 'TOPS' },
      { id: 'dlo-sheer', name: 'Sheer Smoky Chiffon Dress Layer', category: 'DRESSES' },
      { id: 'dlo-choker', name: 'Intricate Lace Collar Choker', category: 'ACCESSORIES' },
      { id: 'dlo-armbands', name: 'Ribbon Lace Arm Bands (Pair)', category: 'ACCESSORIES' },
      { id: 'dlo-gloves', name: 'Opera Length Dark Gloves', category: 'ACCESSORIES' },
      { id: 'dlo-garters', name: 'Garter Straps & Bow Accents', category: 'ACCESSORIES' },
      { id: 'dlo-stockings', name: 'Thigh-High Fishnet Stockings', category: 'STOCKINGS' },
    ],
  },
  {
    id: 'aria-default-cyber',
    name: 'ARIA Cyber Uniform',
    category: 'Futuristic / Cyber',
    categoryFilter: 'CYBER',
    description:
      'The signature ARIA holographic companion cyber uniform with sleek charcoal panels and luminous cyan piping.',
    thumbnailUrl: `${import.meta.env.BASE_URL}wardrobe/thumbnails/aria-default-cyber.png`,
    modelUrl: null, // Uses ARIA base model clothing meshes directly
    isBuiltIn: true,
    hasRigged3DAsset: true,
    tags: ['cyber', 'futuristic', 'hologram', 'signature'],
    components: [
      { id: 'adc-top', name: 'Cybernetic Charcoal Top with Cyan Trim', category: 'TOPS' },
      { id: 'adc-skirt', name: 'Pleated Cyber Skirt with Glow Edges', category: 'BOTTOMS' },
      { id: 'adc-boots', name: 'Futuristic High-Grip Boots', category: 'SHOES' },
    ],
  },
]
