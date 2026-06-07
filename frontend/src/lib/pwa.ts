export type Platform = 'ios' | 'android'

export function detectPlatform(): Platform | null {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function shouldShowPWAPrompt(): boolean {
  if (isStandalone()) return false
  if (detectPlatform() === null) return false
  return localStorage.getItem('pwa_install_seen') !== 'true'
}
