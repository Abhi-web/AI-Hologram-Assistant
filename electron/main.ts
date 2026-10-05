import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import OpenAI from 'openai'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const isDev = !app.isPackaged
const DEFAULT_MODEL = 'gpt-4o-mini'

// ─── Cloud AI Secret & Config Management (Main Process Only) ─────────────────

interface StoredCloudConfig {
  encryptedApiKey?: string
  rawApiKeyFallback?: string
  model?: string
}

let inMemoryApiKey = ''
let inMemoryModel = DEFAULT_MODEL
const activeStreamControllers = new Map<string, AbortController>()

function getConfigFilePath(): string {
  return path.join(app.getPath('userData'), 'cloud-ai-config.json')
}

function loadCloudConfig(): void {
  // 1. Check environment variable first
  if (process.env.OPENAI_API_KEY) {
    inMemoryApiKey = process.env.OPENAI_API_KEY.trim()
    console.log('[CloudAI:Main] Loaded API key from process.env.OPENAI_API_KEY')
  }

  // 2. Load stored config file if present
  try {
    const filePath = getConfigFilePath()
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as StoredCloudConfig

      if (data.model) {
        inMemoryModel = data.model
      }

      if (data.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
        try {
          const buffer = Buffer.from(data.encryptedApiKey, 'base64')
          inMemoryApiKey = safeStorage.decryptString(buffer)
        } catch (decryptErr) {
          console.warn('[CloudAI:Main] Failed to decrypt stored API key:', decryptErr)
        }
      } else if (data.rawApiKeyFallback && !inMemoryApiKey) {
        inMemoryApiKey = data.rawApiKeyFallback
      }
    }
  } catch (err) {
    console.error('[CloudAI:Main] Error reading cloud config file:', err)
  }
}

function saveCloudConfig(apiKey?: string, model?: string): void {
  if (model) {
    inMemoryModel = model
  }
  if (apiKey !== undefined) {
    inMemoryApiKey = apiKey.trim()
  }

  try {
    const filePath = getConfigFilePath()
    const configToSave: StoredCloudConfig = {
      model: inMemoryModel,
    }

    if (inMemoryApiKey) {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(inMemoryApiKey)
        configToSave.encryptedApiKey = encrypted.toString('base64')
      } else {
        configToSave.rawApiKeyFallback = inMemoryApiKey
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(configToSave, null, 2), 'utf-8')
    console.log('[CloudAI:Main] Cloud configuration saved securely.')
  } catch (err) {
    console.error('[CloudAI:Main] Failed to save cloud config file:', err)
  }
}

function maskApiKey(key: string): string {
  if (!key) return ''
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 3)}...${trimmed.slice(-4)}`
}

function getOpenAIClient(): OpenAI {
  if (!inMemoryApiKey) {
    throw new Error('OpenAI API key is not configured. Please open Settings > Cloud AI and enter your API key.')
  }
  return new OpenAI({
    apiKey: inMemoryApiKey,
  })
}

// ─── Window Management ────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Hologram Assistant',
    frame: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.warn(`[Electron:Main] Load error (${errorCode}): ${errorDescription}. Retrying...`)
    if (isDev) {
      setTimeout(() => {
        mainWindow?.loadURL(DEV_SERVER_URL)
      }, 1000)
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Fallback to ensure window is visible even if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }, 2500)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Desktop Hologram Mode Window Management ──────────────────────────────────

interface HologramBounds {
  x?: number
  y?: number
  width: number
  height: number
}

interface StoredHologramSettings {
  enabled: boolean
  alwaysOnTop: boolean
  showMiniChat: boolean
  clickThrough: boolean
  bounds?: HologramBounds
}

let hologramWindow: BrowserWindow | null = null

const DEFAULT_HOLOGRAM_SETTINGS: StoredHologramSettings = {
  enabled: false,
  alwaysOnTop: true,
  showMiniChat: true,
  clickThrough: false,
  bounds: {
    width: 380,
    height: 580,
  },
}

let inMemoryHologramSettings: StoredHologramSettings = { ...DEFAULT_HOLOGRAM_SETTINGS }

function getHologramConfigPath(): string {
  return path.join(app.getPath('userData'), 'hologram-settings.json')
}

function loadHologramSettings(): void {
  try {
    const filePath = getHologramConfigPath()
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(raw) as Partial<StoredHologramSettings>
      inMemoryHologramSettings = {
        ...DEFAULT_HOLOGRAM_SETTINGS,
        ...data,
        bounds: {
          ...DEFAULT_HOLOGRAM_SETTINGS.bounds!,
          ...(data.bounds || {}),
        },
      }
      console.log('[Hologram:Main] Loaded hologram settings from disk.')
    }
  } catch (err) {
    console.warn('[Hologram:Main] Failed to load hologram settings:', err)
  }
}

function saveHologramSettings(settings?: Partial<StoredHologramSettings>): void {
  if (settings) {
    inMemoryHologramSettings = {
      ...inMemoryHologramSettings,
      ...settings,
      bounds: {
        ...(inMemoryHologramSettings.bounds || DEFAULT_HOLOGRAM_SETTINGS.bounds!),
        ...(settings.bounds || {}),
      },
    }
  }

  try {
    const filePath = getHologramConfigPath()
    fs.writeFileSync(filePath, JSON.stringify(inMemoryHologramSettings, null, 2), 'utf-8')
    console.log('[Hologram:Main] Saved hologram settings to disk.')
  } catch (err) {
    console.error('[Hologram:Main] Failed to save hologram settings:', err)
  }
}

function notifyHologramState(): void {
  const isOpen = Boolean(hologramWindow && !hologramWindow.isDestroyed())
  const payload = {
    isOpen,
    alwaysOnTop: inMemoryHologramSettings.alwaysOnTop,
    showMiniChat: inMemoryHologramSettings.showMiniChat,
    clickThrough: inMemoryHologramSettings.clickThrough,
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('hologram:state-change', payload)
  }
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    hologramWindow.webContents.send('hologram:state-change', payload)
  }
}

function createOrFocusHologramWindow(): BrowserWindow {
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    console.log('[Hologram:Main] Hologram window already exists. Focusing...')
    if (hologramWindow.isMinimized()) hologramWindow.restore()
    hologramWindow.show()
    hologramWindow.focus()
    notifyHologramState()
    return hologramWindow
  }

  const bounds = inMemoryHologramSettings.bounds || DEFAULT_HOLOGRAM_SETTINGS.bounds!

  hologramWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 280,
    minHeight: 420,
    maxWidth: 900,
    maxHeight: 1100,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: inMemoryHologramSettings.alwaysOnTop ?? true,
    resizable: true,
    skipTaskbar: false,
    title: 'ARIA Desktop Hologram',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  })

  // Apply click-through if configured
  if (inMemoryHologramSettings.clickThrough) {
    hologramWindow.setIgnoreMouseEvents(true, { forward: true })
  }

  // Load hologram mode in renderer
  if (isDev) {
    hologramWindow.loadURL(`${DEV_SERVER_URL}?mode=hologram`)
  } else {
    hologramWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      search: 'mode=hologram',
      hash: 'hologram',
    })
  }

  hologramWindow.once('ready-to-show', () => {
    hologramWindow?.show()
    hologramWindow?.focus()
    notifyHologramState()
  })

  // Remember bounds on move or resize
  const recordBounds = () => {
    if (hologramWindow && !hologramWindow.isDestroyed()) {
      const currentBounds = hologramWindow.getBounds()
      saveHologramSettings({
        bounds: {
          x: currentBounds.x,
          y: currentBounds.y,
          width: currentBounds.width,
          height: currentBounds.height,
        },
      })
    }
  }

  hologramWindow.on('moved', recordBounds)
  hologramWindow.on('resized', recordBounds)

  hologramWindow.on('closed', () => {
    console.log('[Hologram:Main] Hologram window closed.')
    hologramWindow = null
    notifyHologramState()
  })

  return hologramWindow
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Grant microphone and media permissions inside Electron
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true)
    }
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true
    return false
  })

  loadCloudConfig()
  loadHologramSettings()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  voiceWorkerManager.destroy()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  voiceWorkerManager.destroy()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:get-version', () => app.getVersion())

// 1. Get Cloud AI configuration state (never returns raw key)
ipcMain.handle('cloud:get-config', () => {
  return {
    configured: Boolean(inMemoryApiKey),
    maskedKey: maskApiKey(inMemoryApiKey),
    model: inMemoryModel,
    provider: 'openai',
  }
})

// 2. Save Cloud AI settings
ipcMain.handle('cloud:save-config', (_event, payload: { apiKey?: string; model?: string }) => {
  saveCloudConfig(payload.apiKey, payload.model)
  return {
    success: true,
    configured: Boolean(inMemoryApiKey),
    maskedKey: maskApiKey(inMemoryApiKey),
    model: inMemoryModel,
    provider: 'openai',
  }
})

// 3. Test Connection against OpenAI
ipcMain.handle('cloud:test-connection', async () => {
  if (!inMemoryApiKey) {
    return {
      success: false,
      error: 'OpenAI API key is missing. Please enter your API key first.',
    }
  }

  const startTime = Date.now()
  try {
    console.log('[CloudAI:Main] Testing connection to OpenAI with model:', inMemoryModel)
    const client = getOpenAIClient()

    // Test credentials with a lightweight model retrieval
    await client.models.retrieve(inMemoryModel)
    const latencyMs = Date.now() - startTime
    console.log(`[CloudAI:Main] OpenAI credentials verified successfully in ${latencyMs}ms`)

    return {
      success: true,
      latencyMs,
      model: inMemoryModel,
    }
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime
    console.error('[CloudAI:Main] Test connection failed after %dms:', elapsed, err)

    let message = 'Failed to connect to OpenAI.'
    if (err && typeof err === 'object') {
      const errorObj = err as { status?: number; message?: string }
      if (errorObj.status === 401) {
        message = 'Authentication failed: Invalid OpenAI API key.'
      } else if (errorObj.status === 429) {
        message = 'Rate limit or quota exceeded on your OpenAI account.'
      } else if (errorObj.status === 404) {
        message = `Model "${inMemoryModel}" was not found or is unavailable for this API key.`
      } else if (errorObj.message) {
        message = errorObj.message
      }
    }
    return {
      success: false,
      error: message,
    }
  }
})

// 4. Stream chat response from OpenAI
ipcMain.handle(
  'cloud:chat-stream',
  async (
    event,
    payload: {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      requestId: string
      model?: string
    }
  ) => {
    const { messages, requestId, model = inMemoryModel } = payload

    if (!inMemoryApiKey) {
      return {
        success: false,
        error: 'OpenAI API key is not configured. Please open Settings > Cloud AI and enter your API key.',
      }
    }

    const abortController = new AbortController()
    activeStreamControllers.set(requestId, abortController)

    const startTime = Date.now()
    console.log(
      `[CloudAI:Main] Starting streaming chat request to OpenAI (model: ${model}, messages: ${messages.length})`
    )

    try {
      const client = getOpenAIClient()

      // Primary approach: Chat completions streaming with standard messages
      const stream = await client.chat.completions.create(
        {
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
        },
        { signal: abortController.signal }
      )

      let totalChars = 0
      for await (const chunk of stream) {
        if (abortController.signal.aborted) break
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          totalChars += delta.length
          event.sender.send(`cloud:chat-chunk:${requestId}`, delta)
        }
      }

      const elapsed = Date.now() - startTime
      console.log(
        `[CloudAI:Main] Streaming completed (${totalChars} chars in ${elapsed}ms)`
      )

      return { success: true, aborted: abortController.signal.aborted }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        console.log('[CloudAI:Main] Chat generation aborted by user.')
        return { success: true, aborted: true }
      }

      console.error('[CloudAI:Main] Error during OpenAI streaming:', err)

      let message = 'An error occurred while communicating with OpenAI.'
      if (err && typeof err === 'object') {
        const errorObj = err as { status?: number; message?: string }
        if (errorObj.status === 401) {
          message = 'Authentication failed: Invalid OpenAI API key. Please check Settings.'
        } else if (errorObj.status === 429) {
          message = 'OpenAI rate limit or quota exceeded. Please check your account billing.'
        } else if (errorObj.status === 404) {
          message = `Model "${model}" was not found or is unavailable.`
        } else if (errorObj.message) {
          message = errorObj.message
        }
      }

      return { success: false, error: message }
    } finally {
      activeStreamControllers.delete(requestId)
    }
  }
)

// 5. Abort an active streaming chat
ipcMain.handle('cloud:chat-abort', (_event, payload: { requestId: string }) => {
  const controller = activeStreamControllers.get(payload.requestId)
  if (controller) {
    console.log('[CloudAI:Main] Aborting stream requestId:', payload.requestId)
    controller.abort()
    activeStreamControllers.delete(payload.requestId)
  }
  return { success: true }
})

// ─── Windows Voice Input / Speech Recognition Manager ─────────────────────────

class VoiceWorkerManager {
  private worker: ChildProcess | null = null
  private isReady = false
  private pendingWorkerInitReject: ((err: Error) => void) | null = null
  private pendingStartResolve: ((res: { success: boolean; text?: string; error?: string }) => void) | null = null
  private safetyTimeout: NodeJS.Timeout | null = null
  private recognizedText = ''
  private isListening = false

  public isAvailable(): boolean {
    return process.platform === 'win32'
  }

  private getScriptPath(): string {
    const distPath = path.join(__dirname, 'speech-worker.ps1')
    if (fs.existsSync(distPath)) return distPath
    const srcPath = path.join(__dirname, '../electron/speech-worker.ps1')
    if (fs.existsSync(srcPath)) return srcPath
    const cwdPath = path.join(process.cwd(), 'electron/speech-worker.ps1')
    if (fs.existsSync(cwdPath)) return cwdPath
    return distPath
  }

  private ensureWorker(): Promise<void> {
    if (this.worker && !this.worker.killed && this.isReady) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        const scriptPath = this.getScriptPath()
        console.log('[Voice:Main] Starting speech worker:', scriptPath)
        this.pendingWorkerInitReject = reject

        this.worker = spawn(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          }
        )

        this.worker.stdout?.on('data', (data: Buffer) => {
          const textData = data.toString('utf-8')
          const lines = textData.split('\n').map((l) => l.trim()).filter(Boolean)
          for (const line of lines) {
            console.log('[Voice:Worker]', line)
            if (line === 'VOICE_ENGINE_READY') {
              this.isReady = true
              this.pendingWorkerInitReject = null
              resolve()
            } else if (line.startsWith('SPEECH_RECOGNIZED:')) {
              const chunk = line.substring('SPEECH_RECOGNIZED:'.length).trim()
              if (chunk) {
                this.recognizedText = this.recognizedText ? `${this.recognizedText} ${chunk}` : chunk
              }
            } else if (line.startsWith('SPEECH_HYPOTHESIZED:')) {
              const hypo = line.substring('SPEECH_HYPOTHESIZED:'.length).trim()
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('voice:hypothesis', hypo)
              }
            } else if (line === 'RECOGNIZE_COMPLETED') {
              this.isListening = false
              this.clearSafetyTimeout()
              if (this.pendingStartResolve) {
                const text = this.recognizedText.trim()
                this.recognizedText = ''
                if (text) {
                  this.pendingStartResolve({ success: true, text })
                } else {
                  this.pendingStartResolve({ success: false, error: 'no-speech' })
                }
                this.pendingStartResolve = null
              }
            } else if (line === 'CANCELLED') {
              this.isListening = false
              this.clearSafetyTimeout()
              if (this.pendingStartResolve) {
                this.recognizedText = ''
                this.pendingStartResolve({ success: false, error: 'cancelled' })
                this.pendingStartResolve = null
              }
            } else if (line.startsWith('ERROR:')) {
              const err = line.substring('ERROR:'.length)
              this.isListening = false
              this.clearSafetyTimeout()
              if (this.pendingStartResolve) {
                this.pendingStartResolve({ success: false, error: err })
                this.pendingStartResolve = null
              }
            }
          }
        })

        this.worker.on('error', (err) => {
          console.error('[Voice:Worker] Spawn error:', err)
          this.isReady = false
          this.isListening = false
          this.clearSafetyTimeout()
          if (this.pendingWorkerInitReject) {
            this.pendingWorkerInitReject(err)
            this.pendingWorkerInitReject = null
          }
          if (this.pendingStartResolve) {
            this.pendingStartResolve({ success: false, error: err.message })
            this.pendingStartResolve = null
          }
          reject(err)
        })

        this.worker.on('exit', (code) => {
          console.log('[Voice:Worker] Exited with code:', code)
          this.worker = null
          this.isReady = false
          this.isListening = false
          this.clearSafetyTimeout()
          if (this.pendingWorkerInitReject) {
            this.pendingWorkerInitReject(new Error(`Voice worker process exited prematurely (code ${code}).`))
            this.pendingWorkerInitReject = null
          }
          if (this.pendingStartResolve) {
            this.pendingStartResolve({ success: false, error: 'Worker process terminated.' })
            this.pendingStartResolve = null
          }
        })
      } catch (err) {
        this.pendingWorkerInitReject = null
        reject(err)
      }
    })
  }

  private clearSafetyTimeout(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout)
      this.safetyTimeout = null
    }
  }

  public async startListening(): Promise<{ success: boolean; text?: string; error?: string }> {
    if (this.isListening) {
      return { success: false, error: 'Already listening.' }
    }

    try {
      await this.ensureWorker()
      this.recognizedText = ''
      this.isListening = true

      return new Promise((resolve) => {
        this.pendingStartResolve = resolve

        // Safety timeout of 10s of complete silence
        this.safetyTimeout = setTimeout(() => {
          console.log('[Voice:Worker] Safety timeout reached (no speech). Cancelling...')
          this.cancelListening()
        }, 10000)

        this.worker?.stdin?.write('START\n')
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  public stopListening(): Promise<{ success: boolean }> {
    if (this.worker && this.isListening) {
      this.worker.stdin?.write('STOP\n')
    }
    return Promise.resolve({ success: true })
  }

  public cancelListening(): Promise<{ success: boolean }> {
    if (this.worker && this.isListening) {
      this.worker.stdin?.write('CANCEL\n')
    }
    this.clearSafetyTimeout()
    this.isListening = false
    if (this.pendingStartResolve) {
      this.pendingStartResolve({ success: false, error: 'cancelled' })
      this.pendingStartResolve = null
    }
    return Promise.resolve({ success: true })
  }

  public destroy(): void {
    this.clearSafetyTimeout()
    if (this.worker) {
      try {
        this.worker.stdin?.write('QUIT\n')
        setTimeout(() => {
          if (this.worker && !this.worker.killed) {
            this.worker.kill()
          }
        }, 300)
      } catch {}
      this.worker = null
    }
  }
}

const voiceWorkerManager = new VoiceWorkerManager()

// ─── Voice Input IPC Handlers ─────────────────────────────────────────────────

ipcMain.handle('voice:start-listening', async () => {
  return await voiceWorkerManager.startListening()
})

ipcMain.handle('voice:stop-listening', async () => {
  return await voiceWorkerManager.stopListening()
})

ipcMain.handle('voice:cancel-listening', async () => {
  return await voiceWorkerManager.cancelListening()
})

ipcMain.handle('voice:get-status', async () => {
  return { available: voiceWorkerManager.isAvailable() }
})

// ─── Desktop Hologram Mode IPC Handlers ───────────────────────────────────────

ipcMain.handle('hologram:launch', () => {
  createOrFocusHologramWindow()
  return { success: true, isOpen: true }
})

ipcMain.handle('hologram:close', () => {
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    hologramWindow.close()
  }
  return { success: true, isOpen: false }
})

ipcMain.handle('hologram:get-settings', () => {
  const isOpen = Boolean(hologramWindow && !hologramWindow.isDestroyed())
  return {
    ...inMemoryHologramSettings,
    isOpen,
  }
})

ipcMain.handle('hologram:save-settings', (_event, patch: Partial<StoredHologramSettings>) => {
  saveHologramSettings(patch)

  if (hologramWindow && !hologramWindow.isDestroyed()) {
    if (patch.alwaysOnTop !== undefined) {
      hologramWindow.setAlwaysOnTop(patch.alwaysOnTop)
    }
    if (patch.clickThrough !== undefined) {
      hologramWindow.setIgnoreMouseEvents(patch.clickThrough, { forward: true })
    }
  }
  notifyHologramState()
  return { success: true, ...inMemoryHologramSettings }
})

ipcMain.handle('hologram:set-always-on-top', (_event, alwaysOnTop: boolean) => {
  saveHologramSettings({ alwaysOnTop })
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    hologramWindow.setAlwaysOnTop(alwaysOnTop)
  }
  notifyHologramState()
  return { success: true, alwaysOnTop }
})

ipcMain.handle('hologram:set-click-through', (_event, clickThrough: boolean) => {
  saveHologramSettings({ clickThrough })
  if (hologramWindow && !hologramWindow.isDestroyed()) {
    hologramWindow.setIgnoreMouseEvents(clickThrough, { forward: true })
  }
  notifyHologramState()
  return { success: true, clickThrough }
})



