import { useState } from 'react'
import type { ComponentType } from 'react'
import type { BadgeTier, AchievementIcon } from '../lib/achievements'
import { FlameIcon, BookOpenIcon, CalendarIcon, TrophyIcon } from './Icons'

const ICONS: Record<AchievementIcon, ComponentType<{ size?: number }>> = {
  flame: FlameIcon,
  book: BookOpenIcon,
  calendar: CalendarIcon,
  trophy: TrophyIcon,
}

const TIER_CFG: Record<BadgeTier, { ring: string; inner: string; glow: string; label: string; shadow: string }> = {
  bronze: {
    ring: 'linear-gradient(145deg,#b87333 0%,#e8a87c 40%,#cd7f32 60%,#8b4513 100%)',
    inner: 'linear-gradient(145deg,#2d1500,#4a2800)',
    glow: 'rgba(205,127,50,0.55)',
    label: '#a05a1c',
    shadow: 'rgba(205,127,50,0.25)',
  },
  silver: {
    ring: 'linear-gradient(145deg,#7a7a8a 0%,#e0e0ee 40%,#9a9aaa 60%,#505060 100%)',
    inner: 'linear-gradient(145deg,#141420,#20202e)',
    glow: 'rgba(150,150,180,0.5)',
    label: '#5f5f75',
    shadow: 'rgba(150,150,180,0.2)',
  },
  gold: {
    ring: 'linear-gradient(145deg,#b8860b 0%,#ffe066 35%,#fff3a0 50%,#ffd700 65%,#a06400 100%)',
    inner: 'linear-gradient(145deg,#1a1000,#2e1e00)',
    glow: 'rgba(210,166,63,0.6)',
    label: '#9a7311',
    shadow: 'rgba(210,166,63,0.25)',
  },
  rainbow: {
    ring: 'linear-gradient(135deg,#c0455e,#d2a63f,#0f6e78,#6b2a8f,#c0455e)',
    inner: 'linear-gradient(145deg,#0d0020,#150830)',
    glow: 'rgba(107,42,143,0.55)',
    label: '#6b2a8f',
    shadow: 'rgba(107,42,143,0.22)',
  },
}

interface AchievementMedallionProps {
  label: string
  criteria: string
  tier: BadgeTier
  icon: AchievementIcon
  earned: boolean
  animDelay?: number
}

/**
 * One roundel on Profile's achievements leaf. Earned: a tooled tier ring (bronze/silver/gold/
 * rainbow, unchanged from before) around a dark inner face holding the glyph. Unearned: a
 * uniform blind-stamped impression — no tier colour, since a tier only ever applies to something
 * actually earned — with the same glyph shown faintly and its criteria always readable
 * underneath either way.
 */
export default function AchievementMedallion({ label, criteria, tier, icon, earned, animDelay = 0 }: AchievementMedallionProps) {
  const cfg = TIER_CFG[tier]
  const [hovered, setHovered] = useState(false)
  const Icon = ICONS[icon]

  return (
    <div className="flex flex-col items-center gap-2 text-center" style={{ minWidth: 0, width: 96 }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 68, height: 68, borderRadius: '50%',
          background: earned ? cfg.ring : 'var(--color-leaf)',
          padding: 3,
          boxShadow: earned
            ? (hovered
              ? `0 0 28px ${cfg.glow}, 0 0 8px ${cfg.glow}, 0 4px 20px ${cfg.shadow}`
              : `0 0 14px ${cfg.glow}, 0 2px 10px ${cfg.shadow}`)
            : 'inset 0 2px 5px rgba(35,31,26,0.28), inset 0 -1px 1px rgba(255,255,255,0.5), 0 0 0 1px rgba(35,31,26,0.16)',
          transform: earned && hovered ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
          transition: 'transform 0.22s cubic-bezier(.16,1,.3,1), box-shadow 0.22s ease',
          animationDelay: `${animDelay}ms`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: earned ? cfg.inner : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: earned ? cfg.label : 'rgba(35,31,26,0.28)',
          }}
        >
          <Icon size={26} />
        </div>
      </div>
      <span
        className="text-xs font-bold leading-tight"
        style={{ color: earned ? cfg.label : 'rgba(35,31,26,0.45)', maxWidth: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        {label}
      </span>
      <span className="vol-num leading-tight" style={{ fontSize: 10, color: 'rgba(35,31,26,0.5)' }}>
        {criteria}
      </span>
    </div>
  )
}
