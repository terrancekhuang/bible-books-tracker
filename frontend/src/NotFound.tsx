import { Link } from 'react-router-dom'
import NavBar from './components/NavBar'
import { useCurrentUserQuery } from './lib/queries'
import { leafSurfaceStyle } from './lib/leafSurface'
import { GILT } from './lib/volumesTokens'

const dimText = 'rgba(35,31,26,0.55)'

export default function NotFound() {
  const { data: user } = useCurrentUserQuery()

  return (
    <div className="min-h-screen pb-20 md:pb-0" style={{ background: 'var(--color-shelf)' }}>
      <NavBar pictureUrl={user?.picture_url} userName={user?.name} />

      <div className="max-w-3xl mx-auto w-full px-4 py-8 md:py-14">
        <section
          aria-label="Page not found"
          style={{ padding: 'clamp(32px, 6vw, 64px)', textAlign: 'center', ...leafSurfaceStyle(GILT) }}
        >
          <p className="vol-num" style={{ margin: 0, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: dimText }}>
            Not Found
          </p>
          <h1 className="slab" style={{ margin: '10px 0 0', fontSize: 'clamp(22px, 4vw, 32px)', color: 'var(--color-ink)' }}>
            This page isn't in the collection.
          </h1>
          <p className="text-sm" style={{ margin: '12px 0 0', color: dimText }}>
            Whatever you were looking for, it isn't on this shelf.
          </p>
          <Link
            to="/"
            className="inline-block text-xs font-semibold uppercase mt-6 px-4 py-2 rounded-lg transition-colors"
            style={{ letterSpacing: '0.08em', color: 'var(--color-gilt)', border: '1px solid rgba(210,166,63,0.4)' }}
          >
            Back to Dashboard
          </Link>
        </section>
      </div>
    </div>
  )
}
