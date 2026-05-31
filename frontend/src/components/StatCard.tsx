import type { ReactNode } from 'react'

export default function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      {icon && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(80,110,220,0.7)] dark:text-[rgba(170,195,255,0.75)]"
          style={{ background: 'rgba(100,130,255,0.1)' }}
        >
          {icon}
        </div>
      )}
      <div>
        <p
          className="text-xs font-medium uppercase tracking-widest text-[rgba(13,21,51,0.48)] dark:text-[rgba(150,175,255,0.58)]"
          style={{ fontFamily: "'Raleway', sans-serif" }}
        >
          {label}
        </p>
        <p
          className="text-2xl font-bold mt-0.5 text-[#0d1533] dark:text-[#dde6ff]"
          style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.02em' }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
