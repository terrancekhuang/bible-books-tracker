import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  alpha: number
  alphaVel: number
  speed: number
  depth: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface BannerCanvasProps {
  theme: 'light' | 'dark'
}

export default function BannerCanvas({ theme }: BannerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 })
  const themeRef = useRef(theme)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

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
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      stars = Array.from({ length: 150 }, () => {
        const r = Math.random() * 1.3 + 0.15
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r,
          alpha: Math.random(),
          alphaVel: (Math.random() - 0.5) * 0.007,
          speed: Math.random() * 0.03 + 0.006,
          depth: (r - 0.15) / 1.3,
        }
      })
    }

    const spawnShooting = () => {
      if (shootingStars.filter(s => s.active).length >= 2) return
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.45
      const spd = Math.random() * 5 + 3
      shootingStars.push({
        x: Math.random() * canvas.width * 0.65,
        y: Math.random() * canvas.height * 0.45,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0,
        maxLife: Math.random() * 50 + 35,
        active: true,
      })
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouseMove)

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      const isLight = themeRef.current === 'light'

      const mx = mouseRef.current.x < 0 ? canvas.width / 2 : mouseRef.current.x
      const my = mouseRef.current.y < 0 ? canvas.height / 2 : mouseRef.current.y
      lerpX += ((mx - canvas.width / 2) - lerpX) * 0.06
      lerpY += ((my - canvas.height / 2) - lerpY) * 0.06

      for (const s of stars) {
        s.alpha += s.alphaVel
        if (s.alpha < 0.04) { s.alpha = 0.04; s.alphaVel *= -1 }
        if (s.alpha > 1) { s.alpha = 1; s.alphaVel *= -1 }
        s.y -= s.speed
        if (s.y < -s.r) { s.y = canvas.height + s.r; s.x = Math.random() * canvas.width }

        const px = s.x - lerpX * s.depth * 0.03
        const py = s.y - lerpY * s.depth * 0.03

        if (s.r > 0.85) {
          const glowColor = isLight
            ? `rgba(80, 100, 220, ${s.alpha * 0.08})`
            : `rgba(170, 195, 255, ${s.alpha * 0.13})`
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 5)
          glow.addColorStop(0, glowColor)
          glow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(px, py, s.r * 5, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        const starColor = isLight
          ? `rgba(60, 80, 180, ${s.alpha * 0.55})`
          : `rgba(255, 255, 255, ${s.alpha})`

        ctx.beginPath()
        ctx.arc(px, py, s.r, 0, Math.PI * 2)
        ctx.fillStyle = starColor
        ctx.fill()
      }

      if (frame % 230 === 0) spawnShooting()

      for (const ss of shootingStars) {
        if (!ss.active) continue
        ss.x += ss.vx; ss.y += ss.vy; ss.life++
        if (ss.life > ss.maxLife) { ss.active = false; continue }

        const p = ss.life / ss.maxLife
        const a = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75
        const spd = Math.hypot(ss.vx, ss.vy)
        const trail = 95
        const ex = ss.x - (ss.vx / spd) * trail
        const ey = ss.y - (ss.vy / spd) * trail

        const isLight2 = themeRef.current === 'light'
        const headColor = isLight2
          ? `rgba(100, 120, 255, ${a * 0.85})`
          : `rgba(255, 255, 255, ${a})`
        const midColor = isLight2
          ? `rgba(140, 160, 255, ${a * 0.45})`
          : `rgba(170, 210, 255, ${a * 0.55})`

        const g = ctx.createLinearGradient(ss.x, ss.y, ex, ey)
        g.addColorStop(0, headColor)
        g.addColorStop(0.35, midColor)
        g.addColorStop(1, isLight2 ? 'rgba(140, 160, 255, 0)' : 'rgba(170, 210, 255, 0)')

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

      rafId = requestAnimationFrame(tick)
    }

    init()
    tick()

    const ro = new ResizeObserver(() => init())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}
