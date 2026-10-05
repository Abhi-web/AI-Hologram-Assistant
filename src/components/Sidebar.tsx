import type { NavSection } from '../types'
import styles from './Sidebar.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeSection: NavSection
  onSectionChange: (section: NavSection) => void
  onBack: () => void
}

interface NavItemDef {
  id: NavSection
  label: string
  enabled: boolean
}

// ─── Nav Config ───────────────────────────────────────────────────────────────

const MAIN_NAV: NavItemDef[] = [
  { id: 'assistant', label: 'AI Assistant', enabled: true },
  { id: 'chat',      label: 'Chat',         enabled: true },
  { id: 'voice',     label: 'Voice',        enabled: true },
  { id: 'memory',    label: 'Memory',       enabled: false },
  { id: 'search',    label: 'Web Search',   enabled: false },
]

// ─── Icon Component ───────────────────────────────────────────────────────────

function NavIcon({ section }: { section: NavSection }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (section) {
    case 'assistant':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )
    case 'voice':
      return (
        <svg {...props}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 01-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )
    case 'memory':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M8 11a3 3 0 016 0" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      )
    default:
      return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function Sidebar({ activeSection, onSectionChange, onBack }: SidebarProps) {
  return (
    <aside className={styles.sidebar} id="main-sidebar">
      {/* ── Header / Brand ── */}
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={onBack}
          title="Back to Home"
          aria-label="Back to welcome screen"
          id="sidebar-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className={styles.brand}>
          <div className={styles.brandIcon} aria-hidden="true">
            <span className={styles.brandDot} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>AI Hologram</span>
            <span className={styles.brandSub}>Assistant</span>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className={styles.divider} />

      {/* ── Main Navigation ── */}
      <nav className={styles.nav} aria-label="Main navigation">
        <p className={styles.navGroupLabel}>Workspace</p>
        {MAIN_NAV.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={[
              styles.navItem,
              activeSection === item.id ? styles.navItemActive : '',
              !item.enabled ? styles.navItemDisabled : '',
            ].join(' ')}
            onClick={() => item.enabled && onSectionChange(item.id)}
            aria-current={activeSection === item.id ? 'page' : undefined}
            title={!item.enabled ? `${item.label} — Coming Soon` : item.label}
          >
            <span className={styles.navIcon}>
              <NavIcon section={item.id} />
            </span>
            <span className={styles.navLabel}>{item.label}</span>
            {!item.enabled && (
              <span className={styles.comingSoonBadge}>Soon</span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Footer / Settings ── */}
      <div className={styles.footer}>
        <div className={styles.divider} />
        <button
          id="nav-settings"
          className={[
            styles.navItem,
            activeSection === 'settings' ? styles.navItemActive : '',
          ].join(' ')}
          onClick={() => onSectionChange('settings')}
          title="System Settings"
          aria-label="Settings"
          aria-current={activeSection === 'settings' ? 'page' : undefined}
        >
          <span className={styles.navIcon}>
            <NavIcon section="settings" />
          </span>
          <span className={styles.navLabel}>Settings</span>
        </button>

        {/* Stage badge */}
        <div className={styles.stageBadge}>
          <span className={styles.stageDot} />
          Stage 7
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
