# 3D Avatar Models Directory

This directory houses the 3D humanoid avatar models used by the AI Hologram Assistant.

## Default Model

- **File**: `avatar.glb`
- **Format**: Binary GLTF (`.glb`)
- **Origin**: Generated locally via `scripts/generate-avatar.mjs` using Three.js.
- **License**: MIT / Public Domain (Project-native procedural asset).
- **Embedded Animations**: `idle` (subtle humanoid breathing loop).

## Model Specifications & Guidelines for Custom Models

You can drop in any custom humanoid 3D model (e.g., from Ready Player Me, Blender, or VRM converted to GLB) by replacing `public/models/avatar.glb` or configuring the model path in `AvatarModel.tsx`.

### Recommended Specs:
1. **Format**: Single binary GLTF (`.glb`) with embedded textures and buffers.
2. **Pose**: Standing upright, facing camera forward (`+Z`), centered at `(0, 0, 0)`.
3. **Height**: Standard humanoid scale (~1.6m to 1.8m total height).
4. **Polycount**: 10,000 - 45,000 triangles recommended for 60fps performance on integrated GPUs.
5. **Animations (Optional)**:
   - Animation clip named `idle` (or similar) will automatically be detected and played by `AvatarAnimationController`.
   - If no animation clips are present in the model, `AvatarAnimationController` automatically provides a smooth procedural idle breathing and resting sway.

## Regenerating Default Model

To regenerate the default ARIA humanoid model at any time, run:
```bash
node scripts/generate-avatar.mjs
```
