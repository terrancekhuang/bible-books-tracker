import { useEffect, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'

interface Star {
  x: number; y: number; r: number
  alpha: number; alphaVel: number; speed: number; depth: number
}

interface ShootingStar {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; active: boolean
}

function StarCanvas() {
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1, y: -1 })
  const themeRef = useRef(theme)

  useEffect(() => { themeRef.current = theme }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let stars: Star[] = []
    const shootingStars: ShootingStar[] = []
    let rafId: number
    let frame = 0
    let lerpX = 0
    let lerpY = 0

    const init = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      stars = Array.from({ length: 150 }, () => {
        const r = Math.random() * 1.25 + 0.15
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r,
          alpha: Math.random() * 0.55,
          alphaVel: (Math.random() - 0.5) * 0.005,
          speed: Math.random() * 0.025 + 0.005,
          depth: (r - 0.15) / 1.25,
        }
      })
    }

    const spawnShooting = () => {
      if (shootingStars.filter(s => s.active).length >= 2) return
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.45
      const spd = Math.random() * 5 + 3
      shootingStars.push({
        x: Math.random() * canvas.width * 0.7,
        y: Math.random() * canvas.height * 0.45,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0,
        maxLife: Math.random() * 50 + 35,
        active: true,
      })
    }

    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMouseMove)

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      const isLight = themeRef.current === 'light'
      const mx = mouseRef.current.x < 0 ? canvas.width / 2 : mouseRef.current.x
      const my = mouseRef.current.y < 0 ? canvas.height / 2 : mouseRef.current.y
      lerpX += ((mx - canvas.width / 2) - lerpX) * 0.05
      lerpY += ((my - canvas.height / 2) - lerpY) * 0.05

      for (const s of stars) {
        s.alpha += s.alphaVel
        const maxA = isLight ? 0.4 : 0.7
        if (s.alpha < 0.02) { s.alpha = 0.02; s.alphaVel *= -1 }
        if (s.alpha > maxA) { s.alpha = maxA; s.alphaVel *= -1 }
        s.y -= s.speed
        if (s.y < -s.r) { s.y = canvas.height + s.r; s.x = Math.random() * canvas.width }

        const px = s.x - lerpX * s.depth * 0.025
        const py = s.y - lerpY * s.depth * 0.025

        if (s.r > 0.8) {
          const glowA = isLight ? s.alpha * 0.1 : s.alpha * 0.16
          const glowColor = isLight
            ? `rgba(80,100,220,${glowA})`
            : `rgba(170,195,255,${glowA})`
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 5)
          glow.addColorStop(0, glowColor)
          glow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(px, py, s.r * 5, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(px, py, s.r, 0, Math.PI * 2)
        ctx.fillStyle = isLight
          ? `rgba(60,80,180,${s.alpha * 0.6})`
          : `rgba(255,255,255,${s.alpha})`
        ctx.fill()
      }

      if (frame % 220 === 0) spawnShooting()

      for (const ss of shootingStars) {
        if (!ss.active) continue
        ss.x += ss.vx; ss.y += ss.vy; ss.life++
        if (ss.life > ss.maxLife) { ss.active = false; continue }
        const p = ss.life / ss.maxLife
        const a = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75
        const spd = Math.hypot(ss.vx, ss.vy)
        const trail = 90
        const ex = ss.x - (ss.vx / spd) * trail
        const ey = ss.y - (ss.vy / spd) * trail
        const headColor = isLight ? `rgba(100,120,255,${a * 0.8})` : `rgba(255,255,255,${a})`
        const midColor = isLight ? `rgba(140,160,255,${a * 0.4})` : `rgba(170,210,255,${a * 0.5})`
        const g = ctx.createLinearGradient(ss.x, ss.y, ex, ey)
        g.addColorStop(0, headColor)
        g.addColorStop(0.35, midColor)
        g.addColorStop(1, isLight ? 'rgba(140,160,255,0)' : 'rgba(170,210,255,0)')
        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(ex, ey)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.8
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = headColor
        ctx.fill()
      }

      if (!document.hidden) rafId = requestAnimationFrame(tick)
    }

    const onVisibilityChange = () => {
      if (document.hidden) cancelAnimationFrame(rafId)
      else tick()
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(init, 150) }

    init()
    tick()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

const BLOB = { position: 'absolute' as const, borderRadius: '50%', pointerEvents: 'none' as const }
const WRAP: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }

export default function CelestialBackground() {
  const { theme } = useTheme()

  if (theme === 'light') {
    return (
      <div style={WRAP}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 60% 15%, #f0f4ff 0%, #e8eeff 45%, #dde6ff 100%)' }} />
        <div style={{ ...BLOB, width: 800, height: 800, background: 'radial-gradient(circle, rgba(100,130,255,0.09) 0%, transparent 70%)', filter: 'blur(120px)', top: '-20%', right: '-12%', animation: 'nebulaDrift1 38s ease-in-out infinite' }} />
        <div style={{ ...BLOB, width: 640, height: 640, background: 'radial-gradient(circle, rgba(120,80,200,0.07) 0%, transparent 70%)', filter: 'blur(100px)', bottom: '-14%', left: '-14%', animation: 'nebulaDrift2 44s ease-in-out infinite' }} />
        <div style={{ ...BLOB, width: 500, height: 500, background: 'radial-gradient(circle, rgba(60,100,220,0.06) 0%, transparent 70%)', filter: 'blur(85px)', top: '40%', left: '50%', animation: 'nebulaDrift3 30s ease-in-out infinite' }} />
        <StarCanvas />
      </div>
    )
  }

  return (
    <div style={WRAP}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 35% 25%, #0d1533 0%, #060c1e 55%, #030810 100%)' }} />
      <div style={{ ...BLOB, width: 820, height: 820, background: 'radial-gradient(circle, rgba(52,16,160,0.28) 0%, transparent 70%)', filter: 'blur(90px)', top: '-22%', left: '-18%', animation: 'nebulaDrift1 30s ease-in-out infinite' }} />
      <div style={{ ...BLOB, width: 680, height: 680, background: 'radial-gradient(circle, rgba(8,42,170,0.22) 0%, transparent 70%)', filter: 'blur(95px)', bottom: '-18%', right: '-12%', animation: 'nebulaDrift2 36s ease-in-out infinite' }} />
      <div style={{ ...BLOB, width: 520, height: 520, background: 'radial-gradient(circle, rgba(105,12,105,0.15) 0%, transparent 70%)', filter: 'blur(75px)', top: '38%', right: '12%', animation: 'nebulaDrift3 24s ease-in-out infinite' }} />
      <div style={{ ...BLOB, width: 460, height: 460, background: 'radial-gradient(circle, rgba(12,65,135,0.18) 0%, transparent 70%)', filter: 'blur(70px)', bottom: '18%', left: '6%', animation: 'nebulaDrift1 28s ease-in-out infinite reverse' }} />
      <StarCanvas />
    </div>
  )
}
