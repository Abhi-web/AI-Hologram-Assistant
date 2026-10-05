import { Component, ReactNode, ErrorInfo } from 'react'
import styles from './Avatar.module.css'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AvatarErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AvatarErrorBoundary] Caught error in 3D Avatar:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className={styles.errorContainer} role="alert">
          <div className={styles.errorIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4757" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className={styles.errorTitle}>3D Avatar Rendering Error</p>
          <p className={styles.errorMessage}>
            {this.state.error?.message || 'Unable to load 3D scene or avatar asset.'}
          </p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={this.handleRetry}
            id="avatar-retry-button"
          >
            Retry Loading Avatar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
