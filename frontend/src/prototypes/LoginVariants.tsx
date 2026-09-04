/*
  WORLD · VOLUMES — three ways in.
  The set is unread here: every head edge is raw paper, because nothing has been
  logged yet. Sign-in is the only action on the page in all three.
*/
import { BOOKS } from './seed'

const CATEGORY_ORDER = [
  'Law', 'History', 'Poetry', 'Major Prophets', 'Minor Prophets',
  'Gospels', 'Church History', "Paul's Epistles", 'General Epistles',
]
const CLOTH: Record<string, string> = {
  'Law': '#0E7245', 'History': '#9E1B2F', 'Poetry': '#0F6E78',
  'Major Prophets': '#1B4B9E', 'Minor Prophets': '#6B2A57', 'Gospels': '#B8840F',
  'Church History': '#B04A24', "Paul's Epistles": '#3C5A70', 'General Epistles': '#5E6B1E',
}
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
const GILT = '#D2A63F'
const PAPER_EDGE = '#EAE5D6'

const SET = CATEGORY_ORDER.map(cat => ({
  cat,
  chapters: BOOKS.filter(b => b.category === cat).reduce((s, b) => s + b.num_chapters, 0),
}))

function GoogleButton() {
  return (
    <button className="gbtn">
      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z"/>
        <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.2l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C7.9 41.1 15.4 46 24 46z"/>
        <path fill="#FBBC05" d="M11.7 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.4A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9l7.3-5.6z"/>
        <path fill="#EA4335" d="M24 10.6c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4 30 2 24 2 15.4 2 7.9 6.9 4.4 14.1l7.3 5.7c1.7-5.2 6.6-9.2 12.3-9.2z"/>
      </svg>
      Sign in with Google
    </button>
  )
}

function Foot() {
  return (
    <p
      style={{
        margin: 0, padding: '26px 0 22px', textAlign: 'center',
        fontFamily: 'Archivo, sans-serif', fontSize: 11, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: 'rgba(242,236,221,0.42)',
      }}
    >
      Made by Terrance Huang
    </p>
  )
}

/* ── A · The closed set on its shelf ──────────────────────────────────────── */
function Shelf() {
  return (
    <div className="w-login">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', gap: 38 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="slab" style={{ margin: 0, fontSize: 'clamp(26px, 5vw, 46px)', color: GILT, lineHeight: 1.05 }}>
            Bible Books Tracker
          </h1>
          <div aria-hidden style={{ height: 1, margin: '20px auto 0', width: 'min(300px, 62%)', background: `linear-gradient(90deg, transparent, ${GILT}, transparent)` }} />
          <p style={{ margin: '18px 0 0', fontFamily: 'Archivo, sans-serif', fontSize: 13.5, letterSpacing: '0.06em', color: 'rgba(242,236,221,0.72)' }}>
            Sixty-six books in nine volumes. Every chapter you read, gilded.
          </p>
        </div>

        <div style={{ width: 'min(880px, 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, paddingTop: 22 }}>
            {SET.map((v, i) => (
              <div key={v.cat} style={{ position: 'relative', flex: `${v.chapters} 1 0`, minWidth: 46, height: 300 }}>
                <span aria-hidden style={{ position: 'absolute', left: 2, right: 2, top: -6, height: 7, background: PAPER_EDGE, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.6)' }} />
                <span aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,0.55), ${CLOTH[v.cat]} 20%, ${CLOTH[v.cat]} 68%, rgba(255,255,255,0.16) 96%, rgba(0,0,0,0.4))`, boxShadow: '0 14px 22px -14px rgba(0,0,0,0.9)' }} />
                {[0.1, 0.9].map(t => (
                  <span key={t} aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 9, background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.45))' }} />
                ))}
                <span aria-hidden style={{ position: 'absolute', left: 7, right: 7, top: '16%', bottom: '16%', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.42), inset 0 0 0 2px rgba(255,255,255,0.10)' }} />
                <span
                  className="slab"
                  style={{
                    position: 'absolute', left: 0, right: 0, top: '22%', bottom: '26%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                    fontSize: 'clamp(9px, 1vw, 13px)', color: GILT,
                    textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,236,180,0.28)',
                    whiteSpace: 'nowrap', overflow: 'hidden', padding: '4px 0',
                  }}
                >
                  {v.cat}
                </span>
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: '5.5%', textAlign: 'center', fontSize: 10, color: GILT, fontFamily: 'Archivo, sans-serif', fontWeight: 600 }}>
                  {ROMAN[i + 1]}
                </span>
              </div>
            ))}
          </div>
          <div aria-hidden style={{ height: 13, background: 'linear-gradient(180deg, var(--shelf-lit), #241C15 70%, #100C09)', boxShadow: '0 12px 22px -12px rgba(0,0,0,0.95)' }} />
        </div>

        {/* The sign-in slip, laid on the shelf in front of the set. */}
        <div
          style={{
            padding: '22px 30px', textAlign: 'center',
            backgroundColor: 'var(--leaf)',
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
            boxShadow: '0 18px 32px -18px rgba(0,0,0,0.95)',
            transform: 'rotate(-0.4deg)',
          }}
        >
          <p style={{ margin: '0 0 16px', fontFamily: 'Archivo, sans-serif', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.62)' }}>
            Open the set
          </p>
          <GoogleButton />
        </div>
      </div>
      <Foot />
    </div>
  )
}

/* ── B · One volume, front-on ─────────────────────────────────────────────── */
function Board() {
  return (
    <div className="w-login">
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '44px 24px' }}>
        <div style={{ position: 'relative', width: 'min(430px, 100%)', aspectRatio: '3 / 4', display: 'flex' }}>
          {/* The spine edge, seen at a slight angle. */}
          <span
            aria-hidden
            style={{
              flex: '0 0 26px', position: 'relative',
              background: 'linear-gradient(90deg, #04140C, #0B2F1E 40%, #14432E 80%)',
              boxShadow: 'inset -8px 0 14px -8px rgba(0,0,0,0.9)',
            }}
          >
            {[0.16, 0.4, 0.64, 0.88].map(t => (
              <span key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 11, background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(0,0,0,0.6))' }} />
            ))}
          </span>
          {/* The front board. */}
          <div
            style={{
              flex: 1, position: 'relative',
              background: 'linear-gradient(128deg, #1B5539 0%, #14432E 46%, #0D3122 100%)',
              boxShadow: '0 30px 60px -26px rgba(0,0,0,0.95), inset 0 0 90px -30px rgba(0,0,0,0.7)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '38px 30px',
            }}
          >
            {/* Blind-stamped panel, then a gilt fillet inside it. */}
            <span aria-hidden style={{ position: 'absolute', inset: 16, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.10)' }} />
            <span aria-hidden style={{ position: 'absolute', inset: 26, boxShadow: `inset 0 0 0 1px ${GILT}88` }} />

            <h1
              className="slab"
              style={{
                margin: 0, textAlign: 'center', color: GILT, lineHeight: 1.14,
                fontSize: 'clamp(22px, 5.4vw, 34px)',
                textShadow: '0 1px 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(255,236,180,0.25)',
              }}
            >
              Bible<br />Books<br />Tracker
            </h1>
            <div aria-hidden style={{ height: 1, width: 96, margin: '26px 0 30px', background: GILT, opacity: 0.75 }} />

            {/* The way in, printed on a slip laid against the board. */}
            <div
              style={{
                padding: '18px 22px', textAlign: 'center',
                backgroundColor: 'var(--leaf)',
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(35,31,26,0.032) 0 1px, transparent 1px 4px)',
                boxShadow: 'inset 0 0 0 1px rgba(35,31,26,0.18), 0 14px 26px -14px rgba(0,0,0,0.95)',
              }}
            >
              <GoogleButton />
            </div>
          </div>
        </div>
      </div>
      <Foot />
    </div>
  )
}

/* ── C · The set in its slipcase ──────────────────────────────────────────── */
function Case() {
  return (
    <div className="w-login">
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '44px 24px' }}>
        <div style={{ width: 'min(640px, 100%)' }}>
          {/* The case: cloth-covered, open at the front, spines recessed inside. */}
          <div
            style={{
              position: 'relative', padding: '20px 20px 0',
              background: 'linear-gradient(140deg, #4A3B2C, #362A1E 55%, #241B13)',
              boxShadow: '0 34px 60px -28px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'flex-end', gap: 4, height: 236,
                padding: '14px 12px 0',
                background: '#0E0A07',
                boxShadow: 'inset 0 16px 26px -14px rgba(0,0,0,1), inset 0 -6px 12px -6px rgba(0,0,0,1)',
              }}
            >
              {SET.map((v, i) => (
                <div key={v.cat} style={{ position: 'relative', flex: `${v.chapters} 1 0`, minWidth: 30, height: '100%' }}>
                  <span aria-hidden style={{ position: 'absolute', left: 1, right: 1, top: 0, height: 5, background: PAPER_EDGE, opacity: 0.9 }} />
                  <span aria-hidden style={{ position: 'absolute', inset: 0, top: 5, background: `linear-gradient(90deg, rgba(0,0,0,0.6), ${CLOTH[v.cat]} 24%, ${CLOTH[v.cat]} 70%, rgba(255,255,255,0.12) 96%, rgba(0,0,0,0.45))` }} />
                  <span
                    className="slab"
                    style={{
                      position: 'absolute', left: 0, right: 0, top: 18, bottom: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                      fontSize: 'clamp(7px, 0.95vw, 10px)', color: GILT, opacity: 0.92,
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}
                  >
                    {v.cat}
                  </span>
                  <span style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', fontSize: 8, color: GILT, opacity: 0.8, fontFamily: 'Archivo, sans-serif', fontWeight: 600 }}>
                    {ROMAN[i + 1]}
                  </span>
                </div>
              ))}
            </div>

            {/* The case's printed label, and the way in. */}
            <div
              style={{
                margin: '20px auto', padding: '24px 28px', width: 'min(420px, 100%)',
                textAlign: 'center',
                backgroundColor: 'var(--leaf)',
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(35,31,26,0.03) 0 1px, transparent 1px 4px)',
                boxShadow: 'inset 0 0 0 1px rgba(35,31,26,0.2), 0 8px 18px -12px rgba(0,0,0,0.9)',
              }}
            >
              <h1 className="slab" style={{ margin: 0, fontSize: 'clamp(19px, 3.4vw, 27px)', color: 'var(--ink)' }}>
                Bible Books Tracker
              </h1>
              <div aria-hidden style={{ margin: '14px auto 16px', width: '62%' }}>
                <div style={{ height: 2, background: 'var(--leaf-red)' }} />
                <div style={{ height: 1, marginTop: 3, background: 'var(--leaf-red)' }} />
              </div>
              <p style={{ margin: '0 0 20px', fontFamily: 'Archivo, sans-serif', fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(35,31,26,0.66)' }}>
                Nine volumes · complete
              </p>
              <GoogleButton />
            </div>
          </div>
        </div>
      </div>
      <Foot />
    </div>
  )
}

export default function LoginVariants({ variant }: { variant: 'shelf' | 'board' | 'case' }) {
  return (
    <div className="w-vol">
      {variant === 'shelf' ? <Shelf /> : variant === 'board' ? <Board /> : <Case />}
    </div>
  )
}
