// ─── Clothing Asset Manager ────────────────────────────────────────────────
// Orchestrator for loading, validating, attaching, and disposing 3D garments
// for the ARIA humanoid avatar. Manages 3D textures, bone-attached accessories,
// and external rigged GLB garments without reloading the avatar or interrupting animations.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { VRM } from '@pixiv/three-vrm'
import type { Outfit, WardrobeValidationResult } from './WardrobeTypes'

const ESSENTIAL_BONES = ['J_Bip_C_Hips', 'J_Bip_C_Spine', 'J_Bip_C_Chest']

const BONE_ALIAS_MAP: Record<string, string[]> = {
  J_Bip_C_Hips: ['hips', 'hip', 'pelvis', 'root_hips', 'bip_hips'],
  J_Bip_C_Spine: ['spine', 'spine1', 'bip_spine'],
  J_Bip_C_Chest: ['chest', 'spine2', 'bip_chest'],
  J_Bip_C_UpperChest: ['upperchest', 'chest2', 'bip_upperchest'],
  J_Bip_C_Neck: ['neck', 'bip_neck'],
  J_Bip_C_Head: ['head', 'bip_head'],
  J_Bip_L_Shoulder: ['leftshoulder', 'shoulder_l', 'l_shoulder'],
  J_Bip_L_UpperArm: ['leftupperarm', 'upperarm_l', 'l_upperarm', 'arm_l'],
  J_Bip_L_LowerArm: ['leftlowerarm', 'lowerarm_l', 'l_lowerarm', 'forearm_l'],
  J_Bip_L_Hand: ['lefthand', 'hand_l', 'l_hand'],
  J_Bip_R_Shoulder: ['rightshoulder', 'shoulder_r', 'r_shoulder'],
  J_Bip_R_UpperArm: ['rightupperarm', 'upperarm_r', 'r_upperarm', 'arm_r'],
  J_Bip_R_LowerArm: ['rightlowerarm', 'lowerarm_r', 'r_lowerarm', 'forearm_r'],
  J_Bip_R_Hand: ['righthand', 'hand_r', 'r_hand'],
  J_Bip_L_UpperLeg: ['leftupperleg', 'upperleg_l', 'l_upperleg', 'thigh_l'],
  J_Bip_L_LowerLeg: ['leftlowerleg', 'lowerleg_l', 'l_lowerleg', 'shin_l', 'calf_l'],
  J_Bip_L_Foot: ['leftfoot', 'foot_l', 'l_foot'],
  J_Bip_R_UpperLeg: ['rightupperleg', 'upperleg_r', 'r_upperleg', 'thigh_r'],
  J_Bip_R_LowerLeg: ['rightlowerleg', 'lowerleg_r', 'r_lowerleg', 'shin_r', 'calf_r'],
  J_Bip_R_Foot: ['rightfoot', 'foot_r', 'r_foot'],
}

export class ClothingAssetManager {
  private avatarScene: THREE.Object3D | null = null
  private vrm: VRM | null = null
  private ariaBones: Map<string, THREE.Bone> = new Map()
  private ariaSkeleton: THREE.Skeleton | null = null

  // Identified avatar character meshes
  private bodyMesh: THREE.Mesh | null = null
  private topsMesh: THREE.Mesh | null = null
  private bottomsMesh: THREE.Mesh | null = null
  private shoesMesh: THREE.Mesh | null = null

  // Active external 3D accessories attached to bones
  private attachedAccessories: THREE.Object3D[] = []

  // Active external rigged garment group (if custom GLB loaded)
  private activeGarmentGroup: THREE.Group | null = null
  private activeOutfitId: string | null = null

  // Texture loader & cache
  private textureLoader = new THREE.TextureLoader()
  private textureCache: Map<string, THREE.Texture> = new Map()

  private gltfLoader = new GLTFLoader()

  /**
   * Initializes the manager with the loaded ARIA avatar scene and skeleton.
   */
  public init(avatarScene: THREE.Object3D, vrm?: VRM | null): void {
    this.avatarScene = avatarScene
    this.vrm = vrm || null
    this.ariaBones.clear()
    this.attachedAccessories = []
    this.bodyMesh = null
    this.topsMesh = null
    this.bottomsMesh = null
    this.shoesMesh = null

    const bonesList: THREE.Bone[] = []

    // 1. Index all bones in the avatar
    avatarScene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bone = child as THREE.Bone
        this.ariaBones.set(bone.name, bone)
        bonesList.push(bone)
      }

      // 2. Identify base character meshes by material name
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        const matName = mat?.name?.toLowerCase() || ''

        if (matName.includes('body') && matName.includes('skin')) {
          this.bodyMesh = mesh
        } else if (matName.includes('tops')) {
          this.topsMesh = mesh
        } else if (matName.includes('bottoms')) {
          this.bottomsMesh = mesh
        } else if (matName.includes('shoes')) {
          this.shoesMesh = mesh
        }
      }
    })

    if (bonesList.length > 0) {
      this.ariaSkeleton = new THREE.Skeleton(bonesList)
    }

    console.log(
      `[ClothingAssetManager] Initialized with ${this.ariaBones.size} bones. Meshes found:`,
      {
        body: !!this.bodyMesh,
        tops: !!this.topsMesh,
        bottoms: !!this.bottomsMesh,
        shoes: !!this.shoesMesh,
      }
    )
  }

  /**
   * Load and cache texture with proper glTF orientation (flipY = false).
   */
  private loadTexture(url: string): Promise<THREE.Texture> {
    if (this.textureCache.has(url)) {
      return Promise.resolve(this.textureCache.get(url)!)
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (tex) => {
          tex.flipY = false
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          this.textureCache.set(url, tex)
          resolve(tex)
        },
        undefined,
        reject
      )
    })
  }

  /**
   * Validates a 3D garment file/buffer against ARIA's humanoid skeleton.
   */
  public async validateGarment(
    source: string | ArrayBuffer
  ): Promise<WardrobeValidationResult> {
    return new Promise((resolve) => {
      const onGltfParsed = (gltf: { scene: THREE.Group }) => {
        let meshCount = 0
        let skinnedMeshCount = 0
        const detectedBones: Set<string> = new Set()

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshCount++
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            skinnedMeshCount++
            const sm = child as THREE.SkinnedMesh
            if (sm.skeleton?.bones) {
              sm.skeleton.bones.forEach((b) => detectedBones.add(b.name))
            }
          }
          if ((child as THREE.Bone).isBone) {
            detectedBones.add(child.name)
          }
        })

        if (meshCount === 0) {
          return resolve({
            isValid: false,
            errorMessage:
              'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.',
            meshCount: 0,
            skinnedMeshCount: 0,
            detectedBones: [],
            missingEssentialBones: ESSENTIAL_BONES,
            details: 'No 3D meshes detected in the garment file.',
          })
        }

        // Check essential humanoid bone compatibility
        const missing: string[] = []
        ESSENTIAL_BONES.forEach((b) => {
          if (!this.findMatchingAvatarBone(b)) {
            missing.push(b)
          }
        })

        if (skinnedMeshCount > 0 && missing.length >= ESSENTIAL_BONES.length) {
          return resolve({
            isValid: false,
            errorMessage:
              'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.',
            meshCount,
            skinnedMeshCount,
            detectedBones: Array.from(detectedBones),
            missingEssentialBones: missing,
            details: `Garment skeleton is missing humanoid bones: ${missing.join(', ')}`,
          })
        }

        resolve({
          isValid: true,
          errorMessage: null,
          meshCount,
          skinnedMeshCount,
          detectedBones: Array.from(detectedBones),
          missingEssentialBones: missing,
          details: `Compatible! Detected ${meshCount} meshes (${skinnedMeshCount} skinned).`,
        })
      }

      if (typeof source === 'string') {
        this.gltfLoader.load(
          source,
          onGltfParsed,
          undefined,
          (err) => {
            resolve({
              isValid: false,
              errorMessage:
                'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.',
              meshCount: 0,
              skinnedMeshCount: 0,
              detectedBones: [],
              missingEssentialBones: ESSENTIAL_BONES,
              details: `Failed to load asset: ${err instanceof Error ? err.message : String(err)}`,
            })
          }
        )
      } else {
        this.gltfLoader.parse(
          source,
          '',
          onGltfParsed,
          (err) => {
            resolve({
              isValid: false,
              errorMessage:
                'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.',
              meshCount: 0,
              skinnedMeshCount: 0,
              detectedBones: [],
              missingEssentialBones: ESSENTIAL_BONES,
              details: `Failed to parse GLB buffer: ${err instanceof Error ? err.message : String(err)}`,
            })
          }
        )
      }
    })
  }

  /**
   * Equips a wardrobe outfit onto ARIA's avatar in-place without page or avatar reloading.
   */
  public async equipOutfit(outfit: Outfit): Promise<boolean> {
    if (!this.avatarScene) {
      console.warn('[ClothingAssetManager] Cannot equip outfit: avatarScene is not initialized.')
      return false
    }

    if (this.activeOutfitId === outfit.id) {
      return true
    }

    console.log(`[ClothingAssetManager] Equipping outfit "${outfit.name}" (${outfit.id})...`)

    // Clean up previous 3D accessories and external garments
    this.removeAccessories()
    this.removeActiveGarment()

    try {
      if (outfit.id === 'aria-black-gothic-dress') {
        await this.equipBlackGothicDress()
      } else if (outfit.id === 'aria-dark-lace-outfit') {
        await this.equipDarkLaceOutfit()
      } else if (outfit.id === 'aria-default-cyber') {
        await this.equipDefaultCyber()
      } else if (outfit.modelUrl) {
        // Custom user-uploaded GLB garment
        await this.equipCustomGlb(outfit)
      }

      this.activeOutfitId = outfit.id
      console.log(`[ClothingAssetManager] Successfully equipped "${outfit.name}".`)
      return true
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.'
      console.error('[ClothingAssetManager] Error equipping outfit:', msg)
      throw new Error(msg)
    }
  }

  // ─── 1. OUTFIT 2: BLACK GOTHIC DRESS ─────────────────────────────────────────
  private async equipBlackGothicDress(): Promise<void> {
    // 1. Load and apply textures
    const [bodyTex, topTex, botTex, shoesTex] = await Promise.all([
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/gothic_body.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/gothic_top.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/gothic_bottom.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/gothic_shoes.png`),
    ])

    this.applyTexture(this.bodyMesh, bodyTex)
    this.applyTexture(this.topsMesh, topTex)
    this.applyTexture(this.bottomsMesh, botTex)
    this.applyTexture(this.shoesMesh, shoesTex)

    // Ensure all base meshes are visible
    this.setBaseClothingVisibility(true)

    // 2. Attach real 3D bone accessories matching reference sheet:
    // Puff sleeves, gold belt buckle, back ribbon bow, choker collar
    const gothicBlackMat = new THREE.MeshStandardMaterial({
      color: 0x141418,
      roughness: 0.5,
      metalness: 0.1,
    })
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85,
    })

    // Left Puff Sleeve (attached to Left Upper Arm bone)
    const lUpperArm = this.ariaBones.get('J_Bip_L_UpperArm')
    if (lUpperArm) {
      const lPuffGeom = new THREE.SphereGeometry(0.048, 16, 16)
      lPuffGeom.scale(0.85, 1.25, 0.95)
      const lPuff = new THREE.Mesh(lPuffGeom, gothicBlackMat)
      lPuff.position.set(0.05, -0.01, 0)
      lPuff.castShadow = true
      lUpperArm.add(lPuff)
      this.attachedAccessories.push(lPuff)
    }

    // Right Puff Sleeve (attached to Right Upper Arm bone)
    const rUpperArm = this.ariaBones.get('J_Bip_R_UpperArm')
    if (rUpperArm) {
      const rPuffGeom = new THREE.SphereGeometry(0.048, 16, 16)
      rPuffGeom.scale(0.85, 1.25, 0.95)
      const rPuff = new THREE.Mesh(rPuffGeom, gothicBlackMat)
      rPuff.position.set(-0.05, -0.01, 0)
      rPuff.castShadow = true
      rUpperArm.add(rPuff)
      this.attachedAccessories.push(rPuff)
    }

    // Spine bone for Waist Belt Buckle & Back Bow
    const spine = this.ariaBones.get('J_Bip_C_Spine')
    if (spine) {
      // 3D Gold Belt Buckle (front)
      const buckleGeom = new THREE.BoxGeometry(0.038, 0.028, 0.012)
      const buckle = new THREE.Mesh(buckleGeom, goldMat)
      buckle.position.set(0, 0.035, 0.138)
      buckle.castShadow = true
      spine.add(buckle)
      this.attachedAccessories.push(buckle)

      // 3D Back Ribbon Bow (back of waist)
      const bowGroup = new THREE.Group()
      const bowCenter = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), gothicBlackMat)
      const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 12), gothicBlackMat)
      bowLeft.rotation.z = Math.PI / 2
      bowLeft.position.set(-0.05, 0, 0)
      const bowRight = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 12), gothicBlackMat)
      bowRight.rotation.z = -Math.PI / 2
      bowRight.position.set(0.05, 0, 0)
      bowGroup.add(bowCenter, bowLeft, bowRight)
      bowGroup.position.set(0, 0.035, -0.13)
      bowGroup.castShadow = true
      spine.add(bowGroup)
      this.attachedAccessories.push(bowGroup)
    }

    // Neck Choker Collar
    const neck = this.ariaBones.get('J_Bip_C_Neck')
    if (neck) {
      const chokerGeom = new THREE.CylinderGeometry(0.058, 0.062, 0.032, 24, 1, true)
      const choker = new THREE.Mesh(chokerGeom, gothicBlackMat)
      choker.position.set(0, 0.02, 0)
      neck.add(choker)
      this.attachedAccessories.push(choker)
    }
  }

  // ─── 2. OUTFIT 1: DARK LACE OUTFIT ───────────────────────────────────────────
  private async equipDarkLaceOutfit(): Promise<void> {
    const [bodyTex, topTex, botTex, shoesTex] = await Promise.all([
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/lace_body.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/lace_top.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/lace_bottom.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/lace_shoes.png`),
    ])

    this.applyTexture(this.bodyMesh, bodyTex)
    this.applyTexture(this.topsMesh, topTex)
    this.applyTexture(this.bottomsMesh, botTex)
    this.applyTexture(this.shoesMesh, shoesTex)

    // Set translucent sheer chiffon appearance on skirt
    if (this.bottomsMesh && this.bottomsMesh.material) {
      const mat = Array.isArray(this.bottomsMesh.material)
        ? this.bottomsMesh.material[0]
        : this.bottomsMesh.material
      mat.transparent = true
      mat.opacity = 0.85
      mat.depthWrite = true
      mat.needsUpdate = true
    }

    this.setBaseClothingVisibility(true)

    const darkLaceMat = new THREE.MeshStandardMaterial({
      color: 0x1c1614,
      roughness: 0.45,
    })

    // 3D Front Ribbon Bow on Bra Top (Chest bone)
    const chest = this.ariaBones.get('J_Bip_C_Chest')
    if (chest) {
      const bowGeom = new THREE.BoxGeometry(0.035, 0.02, 0.015)
      const bow = new THREE.Mesh(bowGeom, darkLaceMat)
      bow.position.set(0, 0.05, 0.155)
      chest.add(bow)
      this.attachedAccessories.push(bow)
    }

    // 3D Arm Bands (Left & Right Upper Arm bones)
    const lUpperArm = this.ariaBones.get('J_Bip_L_UpperArm')
    if (lUpperArm) {
      const armBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.028, 16, 1, true),
        darkLaceMat
      )
      armBand.position.set(0.06, 0, 0)
      lUpperArm.add(armBand)
      this.attachedAccessories.push(armBand)
    }

    const rUpperArm = this.ariaBones.get('J_Bip_R_UpperArm')
    if (rUpperArm) {
      const armBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.028, 16, 1, true),
        darkLaceMat
      )
      armBand.position.set(-0.06, 0, 0)
      rUpperArm.add(armBand)
      this.attachedAccessories.push(armBand)
    }

    // 3D Lace Choker (Neck bone)
    const neck = this.ariaBones.get('J_Bip_C_Neck')
    if (neck) {
      const choker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.062, 0.036, 24, 1, true),
        darkLaceMat
      )
      choker.position.set(0, 0.02, 0)
      neck.add(choker)
      this.attachedAccessories.push(choker)
    }
  }

  // ─── 3. ARIA CYBER UNIFORM (DEFAULT BASE) ───────────────────────────────────
  private async equipDefaultCyber(): Promise<void> {
    const [bodyTex, topTex, botTex, shoesTex] = await Promise.all([
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/cyber_body.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/cyber_top.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/cyber_bottom.png`),
      this.loadTexture(`${import.meta.env.BASE_URL}wardrobe/textures/cyber_shoes.png`),
    ])

    this.applyTexture(this.bodyMesh, bodyTex)
    this.applyTexture(this.topsMesh, topTex)
    this.applyTexture(this.bottomsMesh, botTex)
    this.applyTexture(this.shoesMesh, shoesTex)

    if (this.bottomsMesh && this.bottomsMesh.material) {
      const mat = Array.isArray(this.bottomsMesh.material)
        ? this.bottomsMesh.material[0]
        : this.bottomsMesh.material
      mat.transparent = false
      mat.opacity = 1.0
      mat.needsUpdate = true
    }

    this.setBaseClothingVisibility(true)
  }

  // ─── 4. CUSTOM USER-UPLOADED GLB GARMENT ─────────────────────────────────────
  private async equipCustomGlb(outfit: Outfit): Promise<void> {
    if (!outfit.modelUrl) return

    const validation = await this.validateGarment(outfit.modelUrl)
    if (!validation.isValid) {
      throw new Error(
        validation.errorMessage ||
          'Unable to equip this outfit because the 3D garment is not compatible with the current ARIA avatar.'
      )
    }

    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      this.gltfLoader.load(outfit.modelUrl!, resolve, undefined, reject)
    })

    const newGarmentGroup = new THREE.Group()
    newGarmentGroup.name = `WardrobeCustom_${outfit.id}`

    gltf.scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const sm = child as THREE.SkinnedMesh
        sm.castShadow = true
        sm.receiveShadow = true
        sm.frustumCulled = false

        if (this.ariaSkeleton) {
          sm.bind(this.ariaSkeleton, sm.bindMatrix)
        }
        newGarmentGroup.add(sm)
      } else if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        m.castShadow = true
        m.receiveShadow = true
        newGarmentGroup.add(m)
      }
    })

    this.avatarScene!.add(newGarmentGroup)
    this.activeGarmentGroup = newGarmentGroup
  }

  /**
   * Helper to set texture on mesh material.
   */
  private applyTexture(mesh: THREE.Mesh | null, texture: THREE.Texture): void {
    if (!mesh || !mesh.material) return

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((mat) => {
      if ('map' in mat) {
        mat.map = texture
        mat.needsUpdate = true
      }
    })
  }

  /**
   * Helper to match bone name to ARIA bone.
   */
  private findMatchingAvatarBone(garmentBoneName: string): THREE.Bone | null {
    if (this.ariaBones.has(garmentBoneName)) {
      return this.ariaBones.get(garmentBoneName)!
    }

    const cleanName = garmentBoneName.toLowerCase().replace(/[^a-z0-9]/g, '')

    for (const [ariaName, bone] of this.ariaBones.entries()) {
      const cleanAria = ariaName.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (cleanAria === cleanName) {
        return bone
      }
    }

    for (const [standardAriaName, aliases] of Object.entries(BONE_ALIAS_MAP)) {
      const isMatch = aliases.some(
        (alias) => cleanName === alias || cleanName.includes(alias)
      )
      if (isMatch && this.ariaBones.has(standardAriaName)) {
        return this.ariaBones.get(standardAriaName)!
      }
    }

    return null
  }

  /**
   * Toggles visibility of base clothing meshes.
   */
  public setBaseClothingVisibility(visible: boolean): void {
    if (this.topsMesh) this.topsMesh.visible = visible
    if (this.bottomsMesh) this.bottomsMesh.visible = visible
    if (this.shoesMesh) this.shoesMesh.visible = visible
  }

  /**
   * Removes 3D bone accessories.
   */
  public removeAccessories(): void {
    this.attachedAccessories.forEach((acc) => {
      if (acc.parent) {
        acc.parent.remove(acc)
      }
      if ((acc as THREE.Mesh).geometry) {
        ;(acc as THREE.Mesh).geometry.dispose()
      }
    })
    this.attachedAccessories = []
  }

  /**
   * Removes external custom garment group.
   */
  public removeActiveGarment(): void {
    if (this.activeGarmentGroup && this.avatarScene) {
      this.avatarScene.remove(this.activeGarmentGroup)
      this.activeGarmentGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
          if (m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material]
            mats.forEach((mat) => mat.dispose())
          }
        }
      })
      this.activeGarmentGroup = null
    }
  }

  public getActiveOutfitId(): string | null {
    return this.activeOutfitId
  }

  public getVRM(): VRM | null {
    return this.vrm
  }

  public dispose(): void {
    this.removeAccessories()
    this.removeActiveGarment()
    this.textureCache.clear()
    this.avatarScene = null
    this.vrm = null
    this.ariaBones.clear()
    this.bodyMesh = null
    this.topsMesh = null
    this.bottomsMesh = null
    this.shoesMesh = null
  }
}

export const clothingAssetManager = new ClothingAssetManager()
