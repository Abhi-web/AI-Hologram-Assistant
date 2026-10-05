import styles from './Avatar.module.css'

export function AvatarLoadingFallback() {
  return (
    <div className={styles.loadingContainer} aria-label="Loading 3D Avatar">
      <div className={styles.loadingSpinner}>
        <div className={styles.spinnerRingOuter} />
        <div className={styles.spinnerRingInner} />
        <div className={styles.spinnerCore} />
      </div>
      <span className={styles.loadingText}>INITIALIZING 3D AVATAR...</span>
    </div>
  )
}
