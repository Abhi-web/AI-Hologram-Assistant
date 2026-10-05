import { useState, useEffect } from 'react'
import styles from './WelcomeScreen.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Particle {
  id: number
  x: number
  size: number
  duration: number
  delay: number
  color: string
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WelcomeScreenProps {
  onStart: () => void
}

function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [isReady, setIsReady] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])

  // Trigger entrance animation after mount
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Generate floating background particles
  useEffect(() => {
    const colors = ['#00d4ff', '#7b2fff', '#ff2d87']
    const newParticles: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    setParticles(newParticles)
  }, [])

  function handleStartAssistant() {
    onStart()
  }

  return (
    <main className={styles.container} id="welcome-screen">
      {/* ── Background Particles ── */}
      <div className={styles.particleField} aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className={styles.particle}
            style={{
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── Grid Overlay ── */}
      <div className={styles.gridOverlay} aria-hidden="true" />

      {/* ── Scanline Effect ── */}
      <div className={styles.scanline} aria-hidden="true" />

      {/* ── Main Content ── */}
      <div className={`${styles.content} ${isReady ? styles.contentVisible : ''}`}>

        {/* ── Logo / Icon ── */}
        <div className={styles.logoWrapper} aria-hidden="true">
          <div className={styles.logoRing} />
          <div className={styles.logoRingOuter} />
          <div className={styles.logoCore}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="20" cy="20" r="18" stroke="url(#grad)" strokeWidth="1.5" />
              <path
                d="M20 8 L20 32 M8 20 L32 20 M12 12 L28 28 M28 12 L12 28"
                stroke="url(#grad)"
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.4"
              />
              <circle cx="20" cy="20" r="5" fill="url(#grad)" />
              <circle cx="20" cy="8" r="2" fill="#00d4ff" />
              <circle cx="20" cy="32" r="2" fill="#7b2fff" />
              <circle cx="8" cy="20" r="2" fill="#ff2d87" />
              <circle cx="32" cy="20" r="2" fill="#00d4ff" />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff" />
                  <stop offset="50%" stopColor="#7b2fff" />
                  <stop offset="100%" stopColor="#ff2d87" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* ── Heading ── */}
        <div className={styles.headingGroup}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            SYSTEM ONLINE
            <span className={styles.eyebrowDot} />
          </p>
          <h1 className={styles.title}>
            AI Hologram
            <span className={styles.titleAccent}> Assistant</span>
          </h1>
          <p className={styles.subtitle}>Your personal AI companion</p>
        </div>

        {/* ── Feature Pills ── */}
        <div className={styles.featurePills} aria-label="Upcoming features">
          {['AI Intelligence', 'Voice Interface', '3D Avatar', 'Memory', 'Web Search'].map(
            (feature) => (
              <span key={feature} className={styles.pill}>
                {feature}
              </span>
            ),
          )}
        </div>

        {/* ── CTA Button ── */}
        <button
          id="start-assistant-btn"
          className={styles.ctaButton}
          onClick={handleStartAssistant}
          type="button"
          aria-label="Start the AI Hologram Assistant"
        >
          <span className={styles.ctaButtonGlow} aria-hidden="true" />
          <span className={styles.ctaButtonText}>Start Assistant</span>
          <svg
            className={styles.ctaButtonArrow}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 10h12M10 4l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* ── Version Badge ── */}
        <p className={styles.versionBadge}>Stage 7 — Voice Output</p>
      </div>

      {/* ── Corner Decorations ── */}
      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />
    </main>
  )
}

export default WelcomeScreen
