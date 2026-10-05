import styles from './AvatarPlaceholder.module.css'

/**
 * Animated holographic avatar placeholder.
 * Stage 3+ will replace this with a real 3D avatar.
 */
function AvatarPlaceholder() {
  return (
    <div className={styles.wrapper} aria-label="AI Assistant Avatar">
      {/* ── Outer ambient glow ── */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      {/* ── Orbit rings ── */}
      <div className={styles.ringOuter} aria-hidden="true">
        <span className={styles.ringOrbitDot} />
      </div>
      <div className={styles.ringMid} aria-hidden="true">
        <span className={styles.ringOrbitDotMid} />
      </div>
      <div className={styles.ringInner} aria-hidden="true" />

      {/* ── Core orb ── */}
      <div className={styles.core} aria-hidden="true">
        <div className={styles.coreInner}>
          {/* AI brain SVG */}
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#avatarGrad)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#7b2fff" />
              </linearGradient>
            </defs>
            {/* Simplified neural/AI icon */}
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
            <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          </svg>
        </div>
        <div className={styles.corePulse} aria-hidden="true" />
      </div>

      {/* ── Label ── */}
      <div className={styles.label}>
        <span className={styles.labelDot} aria-hidden="true" />
        <span>ARIA</span>
        <span className={styles.labelSub}>AI Intelligence Ready</span>
      </div>
    </div>
  )
}

export default AvatarPlaceholder
