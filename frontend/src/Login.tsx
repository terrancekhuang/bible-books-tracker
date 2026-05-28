import { useEffect, useRef } from 'react'
import { GoogleLogin } from '@react-oauth/google'

interface LoginProps {
  onLoginSuccess: (token: string) => void
}

interface Star {
  x: number
  y: number
  r: number
  alpha: number
  alphaVel: number
  speed: number
  depth: number // 0 = farthest, 1 = closest — drives parallax shift amount
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

function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 })

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
      stars = Array.from({ length: 270 }, () => {
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

      // Lerp cursor offset from center — gives parallax a smooth, weighted feel
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

        // Parallax: close stars (depth≈1) shift more, far stars (depth≈0) barely move
        const px = s.x - lerpX * s.depth * 0.03
        const py = s.y - lerpY * s.depth * 0.03

        if (s.r > 0.85) {
          const glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 5)
          glow.addColorStop(0, `rgba(170, 195, 255, ${s.alpha * 0.13})`)
          glow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(px, py, s.r * 5, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(px, py, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`
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

        const g = ctx.createLinearGradient(ss.x, ss.y, ex, ey)
        g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
        g.addColorStop(0.35, `rgba(170, 210, 255, ${a * 0.55})`)
        g.addColorStop(1, 'rgba(170, 210, 255, 0)')

        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(ex, ey)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.8
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(ss.x, ss.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`
        ctx.fill()
      }

      rafId = requestAnimationFrame(tick)
    }

    init()
    tick()
    window.addEventListener('resize', init)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', init)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
    />
  )
}

const FEATURES = [
  'Track all 66 books across multiple reading cycles',
  'Build daily streaks and maintain consistency',
  'Earn achievements as you complete milestones',
]

export default function Login({ onLoginSuccess }: LoginProps) {
  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    const googleToken = credentialResponse.credential
    if (!googleToken) return
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: googleToken }),
    })
    if (!res.ok) { console.error('Auth failed:', await res.text()); return }
    const data = await res.json()
    onLoginSuccess(data.access_token)
  }

  return (
    <>
      <style precedence="cosmos">{`
        @keyframes nebulaDrift1 {
          0%, 100% { transform: translate(0,0) scale(1) rotate(0deg); }
          33% { transform: translate(50px,-40px) scale(1.12) rotate(18deg); }
          66% { transform: translate(-25px,25px) scale(0.93) rotate(-12deg); }
        }
        @keyframes nebulaDrift2 {
          0%, 100% { transform: translate(0,0) scale(1) rotate(0deg); }
          40% { transform: translate(-60px,50px) scale(1.08) rotate(-22deg); }
          70% { transform: translate(35px,-15px) scale(1.12) rotate(14deg); }
        }
        @keyframes nebulaDrift3 {
          0%, 100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,40px) scale(1.1); }
        }
        @keyframes cosmicFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes titleGlow {
          0%, 100% { text-shadow: 0 0 22px rgba(170,195,255,0.2), 0 0 70px rgba(70,100,255,0.07); }
          50% { text-shadow: 0 0 40px rgba(170,195,255,0.42), 0 0 100px rgba(70,100,255,0.14); }
        }

        .cosmos-wrap {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: radial-gradient(ellipse at 35% 25%, #0d1533 0%, #060c1e 55%, #030810 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cosmos-nebula {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }
        .cosmos-nebula-1 {
          width: 820px; height: 820px;
          background: radial-gradient(circle, rgba(52,16,160,0.3) 0%, transparent 70%);
          filter: blur(85px);
          top: -22%; left: -18%;
          animation: nebulaDrift1 30s ease-in-out infinite;
        }
        .cosmos-nebula-2 {
          width: 680px; height: 680px;
          background: radial-gradient(circle, rgba(8,42,170,0.26) 0%, transparent 70%);
          filter: blur(95px);
          bottom: -18%; right: -12%;
          animation: nebulaDrift2 36s ease-in-out infinite;
        }
        .cosmos-nebula-3 {
          width: 520px; height: 520px;
          background: radial-gradient(circle, rgba(105,12,105,0.17) 0%, transparent 70%);
          filter: blur(75px);
          top: 38%; right: 12%;
          animation: nebulaDrift3 24s ease-in-out infinite;
        }
        .cosmos-nebula-4 {
          width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(12,65,135,0.2) 0%, transparent 70%);
          filter: blur(70px);
          bottom: 18%; left: 6%;
          animation: nebulaDrift1 28s ease-in-out infinite reverse;
        }
        .cosmos-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.2rem;
          max-width: 420px;
          width: 90%;
          text-align: center;
        }
        .cosmos-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0;
          animation: cosmicFadeUp 0.9s ease 0.1s forwards;
        }
        .cosmos-eyebrow-line {
          width: 26px;
          height: 1px;
          background: rgba(150, 175, 255, 0.28);
        }
        .cosmos-eyebrow-text {
          font-family: 'Raleway', sans-serif;
          font-weight: 400;
          font-size: 10px;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          color: rgba(150, 175, 255, 0.42);
        }
        .cosmos-title {
          font-family: 'Cinzel', serif;
          font-weight: 600;
          font-size: clamp(1.6rem, 5vw, 2.75rem);
          color: #dde6ff;
          letter-spacing: 0.1em;
          line-height: 1.2;
          margin: 0;
          opacity: 0;
          animation: cosmicFadeUp 1s ease 0.3s forwards, titleGlow 5s ease-in-out 1.3s infinite;
        }
        .cosmos-divider {
          width: 48px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(150,175,255,0.32), transparent);
          opacity: 0;
          animation: cosmicFadeUp 0.9s ease 0.55s forwards;
        }
        .cosmos-verse {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-size: clamp(0.88rem, 2.2vw, 1.02rem);
          color: rgba(195, 210, 255, 0.58);
          line-height: 1.78;
          max-width: 330px;
          margin: 0;
          opacity: 0;
          animation: cosmicFadeUp 1s ease 0.75s forwards;
        }
        .cosmos-verse-ref {
          display: block;
          font-family: 'Raleway', sans-serif;
          font-style: normal;
          font-weight: 300;
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: rgba(145, 170, 255, 0.38);
          margin-top: 0.45rem;
        }
        .cosmos-features {
          display: flex;
          flex-direction: column;
          gap: 0.42rem;
          width: 100%;
          text-align: left;
          opacity: 0;
          animation: cosmicFadeUp 1s ease 1s forwards;
        }
        .cosmos-feature {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-family: 'Raleway', sans-serif;
          font-weight: 400;
          font-size: 0.77rem;
          color: rgba(160, 185, 255, 0.48);
          letter-spacing: 0.02em;
          line-height: 1.5;
        }
        .cosmos-feature-star {
          color: rgba(200, 170, 100, 0.68);
          font-size: 7px;
          flex-shrink: 0;
          margin-top: 5px;
        }
        .cosmos-signin {
          width: 100%;
          opacity: 0;
          animation: cosmicFadeUp 1s ease 1.25s forwards;
          padding-top: 0.2rem;
        }
        .cosmos-signin-rule {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(150,175,255,0.1), transparent);
          margin-bottom: 1.2rem;
        }
        .cosmos-signin-card {
          background: rgba(255,255,255,0.033);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(150,175,255,0.09);
          border-radius: 14px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .cosmos-signin-label {
          font-family: 'Raleway', sans-serif;
          font-weight: 300;
          font-size: 0.7rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(150,175,255,0.42);
        }
      `}</style>

      <div className="cosmos-wrap">
        <div className="cosmos-nebula cosmos-nebula-1" />
        <div className="cosmos-nebula cosmos-nebula-2" />
        <div className="cosmos-nebula cosmos-nebula-3" />
        <div className="cosmos-nebula cosmos-nebula-4" />
        <CosmicCanvas />

        <div className="cosmos-content">
          <div className="cosmos-eyebrow">
            <div className="cosmos-eyebrow-line" />
            <span className="cosmos-eyebrow-text">Scripture Tracker</span>
            <div className="cosmos-eyebrow-line" />
          </div>

          <h1 className="cosmos-title">Bible Books Tracker</h1>

          <div className="cosmos-divider" />

          <blockquote style={{ margin: 0 }}>
            <p className="cosmos-verse">
              "Lift up your eyes and look to the heavens:
              <br />
              Who created all these?"
              <span className="cosmos-verse-ref">— Isaiah 40:26</span>
            </p>
          </blockquote>

          <div className="cosmos-features">
            {FEATURES.map((f) => (
              <div className="cosmos-feature" key={f}>
                <span className="cosmos-feature-star">✦</span>
                {f}
              </div>
            ))}
          </div>

          <div className="cosmos-signin">
            <div className="cosmos-signin-rule" />
            <div className="cosmos-signin-card">
              <span className="cosmos-signin-label">Begin your journey</span>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={() => console.error('Google login failed')}
                theme="filled_black"
                shape="pill"
                size="large"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
