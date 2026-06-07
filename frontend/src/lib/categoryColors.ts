export interface CategoryPalette {
  color: string
  glow: string
  dim: string
}

const PALETTE: Record<string, CategoryPalette> = {
  'Law':              { color: 'rgba(220,172,60,1)',  glow: 'rgba(220,172,60,0.22)', dim: 'rgba(220,172,60,0.7)' },
  'History':          { color: 'rgba(205,115,55,1)',  glow: 'rgba(205,115,55,0.22)', dim: 'rgba(205,115,55,0.7)' },
  'Poetry':           { color: 'rgba(55,190,175,1)',  glow: 'rgba(55,190,175,0.22)', dim: 'rgba(55,190,175,0.7)' },
  'Major Prophets':   { color: 'rgba(165,80,240,1)',  glow: 'rgba(165,80,240,0.22)', dim: 'rgba(165,80,240,0.7)' },
  'Minor Prophets':   { color: 'rgba(185,140,255,1)', glow: 'rgba(185,140,255,0.22)', dim: 'rgba(185,140,255,0.7)' },
  'Gospels':          { color: 'rgba(55,150,255,1)',  glow: 'rgba(55,150,255,0.22)', dim: 'rgba(55,150,255,0.7)' },
  'Paul':             { color: 'rgba(220,110,155,1)', glow: 'rgba(220,110,155,0.22)', dim: 'rgba(220,110,155,0.7)' },
  "Paul's Epistles":  { color: 'rgba(220,110,155,1)', glow: 'rgba(220,110,155,0.22)', dim: 'rgba(220,110,155,0.7)' },
  'General Epistles': { color: 'rgba(230,130,100,1)', glow: 'rgba(230,130,100,0.22)', dim: 'rgba(230,130,100,0.7)' },
  'Church History':   { color: 'rgba(75,205,130,1)',  glow: 'rgba(75,205,130,0.22)', dim: 'rgba(75,205,130,0.7)' },
}

const DEFAULT: CategoryPalette = { color: 'rgba(150,175,255,1)', glow: 'rgba(150,175,255,0.22)', dim: 'rgba(150,175,255,0.7)' }

export function getCategoryPalette(category: string): CategoryPalette {
  return PALETTE[category] ?? DEFAULT
}
