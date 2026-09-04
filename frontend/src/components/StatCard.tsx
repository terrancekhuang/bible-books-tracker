import type { ReactNode } from 'react'

export default function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(35,31,26,0.12)' }}
    >
      {icon && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(210,166,63,0.14)', color: 'var(--color-gilt)' }}
        >
          {icon}
        </div>
      )}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(35,31,26,0.48)' }}>
          {label}
        </p>
        <p
          className="slab text-2xl font-bold mt-0.5"
          style={{ letterSpacing: '0.02em', color: 'var(--color-ink)' }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
