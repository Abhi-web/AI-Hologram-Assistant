import { useState, useEffect } from 'react'
import WelcomeScreen from './components/WelcomeScreen'
import AssistantWorkspace from './components/AssistantWorkspace'
import HologramWorkspace from './components/hologram/HologramWorkspace'
import type { Screen } from './types'
import './index.css'

function App() {
  const [screen, setScreen] = useState<Screen>('workspace')

  const isHologramWindow =
    typeof window !== 'undefined' &&
    (window.location.search.includes('mode=hologram') ||
      window.location.hash.includes('hologram'))

  useEffect(() => {
    if (isHologramWindow) {
      document.documentElement.classList.add('hologram-window-mode')
      document.body.classList.add('hologram-window-mode')
    } else {
      document.documentElement.classList.remove('hologram-window-mode')
      document.body.classList.remove('hologram-window-mode')
    }
  }, [isHologramWindow])

  // Desktop Hologram Mode Window
  if (isHologramWindow) {
    return <HologramWorkspace />
  }

  // Normal Window Mode
  return (
    <div className="app">
      {screen === 'welcome' ? (
        <WelcomeScreen onStart={() => setScreen('workspace')} />
      ) : (
        <AssistantWorkspace onBack={() => setScreen('welcome')} />
      )}
    </div>
  )
}

export default App
