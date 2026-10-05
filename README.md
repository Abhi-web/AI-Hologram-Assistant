# 🌌 AI Hologram Assistant (ARIA)

> **Next-Generation 3D Holographic AI Companion Desktop Application**  
> Built with **React 18**, **Three.js / @react-three/fiber**, **VRM 3D humanoid avatars**, and **Electron**.

---

## ✨ Overview

**AI Hologram Assistant (ARIA)** is an immersive, interactive desktop companion. ARIA brings a real-time 3D holographic avatar directly to your desktop, featuring natural voice interaction, live lip-syncing, facial expressions, dynamic wardrobe customization, and flexible AI brain providers (local Ollama or Cloud AI).

---

## 🚀 Key Features

- **🎭 Realistic 3D Holographic Avatar**:
  - Full humanoid 3D avatar rendering powered by Three.js and `@pixiv/three-vrm`.
  - Realistic procedural eye blinks, natural head tracking, and gaze following.
  - Expressive facial blendshapes driven by emotional sentiment and intent analysis.
  - Idle breathing, natural posture shifts, and responsive gesture animations.

- **🎙️ Natural Voice & Lip-Sync**:
  - Real-time speech recognition (Web Speech API) and continuous conversation mode.
  - High-precision audio frequency analysis with 5-vowel phoneme morphing (`A`, `I`, `U`, `E`, `O`) for lifelike mouth movement during speech.
  - Speech synthesis with customizable voices, pitch, and speech rates.

- **🧠 Dual AI Provider Architecture**:
  - **Local AI (Ollama)**: Offline, private inference (e.g., `llama3.2:3b`, `mistral`, `llama3`).
  - **Cloud AI (OpenAI API)**: Connects directly to GPT-4o / GPT-4o-mini with custom API keys.
  - Dynamic runtime switching between Local and Cloud providers.

- **👗 Dynamic Wardrobe & Customization**:
  - Modular clothing and outfit swapping system (Cyberpunk, Dark Gothic, Lace Dress, etc.).
  - Live texture injection and GLB mesh overlay support.
  - Wardrobe upload modal allowing users to import custom outfits and textures.

- **🪟 Hologram Display Modes**:
  - Full desktop hologram mode with glowing holographic shaders and scanlines.
  - Floating companion HUD mode with minimal footprint.
  - Adjustable transparency, glow effects, color palettes, and hologram intensity.

---

## 🛠️ Tech Stack

- **Runtime & Desktop Shell**: [Electron](https://www.electronjs.org/)
- **Frontend & UI**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [CSS Modules](https://github.com/css-modules/css-modules)
- **3D Graphics & VRM**: [Three.js](https://threejs.org/), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber), [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- **Bundler & Tooling**: [Vite](https://vitejs.dev/)
- **AI Runtimes**: [Ollama](https://ollama.com/) (Local) / [OpenAI API](https://platform.openai.com/) (Cloud)

---

## 📦 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- *(Optional for Local AI)*: [Ollama](https://ollama.com/) installed and running locally with `llama3.2:3b`:
  ```bash
  ollama run llama3.2:3b
  ```

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abhi-web/AI-Hologram-Assistant.git
   cd AI-Hologram-Assistant
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Launch in development mode**:
   ```bash
   npm run dev
   ```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server and launches Electron concurrently |
| `npm run build` | Compiles Vite production bundle and TypeScript Electron files |
| `npm run typecheck` | Validates TypeScript types across both frontend and Electron configs |
| `npm run preview` | Previews the compiled Vite production bundle locally |

---

## 📁 Project Architecture

```
AI-Hologram-Assistant/
├── electron/                   # Electron main & preload processes
├── public/                     # Static assets & 3D models
│   ├── models/                 # Default VRM/GLB avatar models
│   └── wardrobe/               # Outfits, textures, and thumbnails
├── src/
│   ├── components/
│   │   ├── avatar/             # 3D Avatar scene, animation, lipsync, wardrobe
│   │   ├── hologram/           # Holographic shaders and workspace
│   │   ├── ChatPanel.tsx       # Interactive chat conversation UI
│   │   ├── SettingsPanel.tsx   # Model selection, voice, visual settings
│   │   └── WelcomeScreen.tsx   # Onboarding and initialization view
│   ├── providers/              # AI providers (Ollama / LocalAI, CloudAI)
│   ├── services/               # Voice, TTS, Speech, Emotion, Behavior engines
│   ├── types/                  # Shared TypeScript interfaces
│   ├── App.tsx                 # Root application component
│   └── main.tsx                # React DOM entrypoint
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔒 Security & Privacy

- **Local Inference First**: When using Local AI mode, all prompt exchanges and companion data remain 100% on your local machine via Ollama.
- **Strict Content Security Policy**: Configured to restrict network requests strictly to local APIs (`localhost:11434` / `127.0.0.1:11434`) and authorized cloud endpoints.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
