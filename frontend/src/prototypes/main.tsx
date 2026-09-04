import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './proto.css'
import ForeEdge from './ForeEdge'
import SewingFrame from './SewingFrame'
import TooledBoard from './TooledBoard'
import Volumes from './Volumes'
import LoginVariants from './LoginVariants'
import DepartureBoard from './DepartureBoard'
import Specimen from './Specimen'

const WORLDS = [
  { id: 'fore-edge', label: 'Fore-Edge', render: () => <ForeEdge /> },
  { id: 'sewing-frame', label: 'Sewing Frame', render: () => <SewingFrame /> },
  { id: 'tooled-board', label: 'Tooled Board', render: () => <TooledBoard /> },
  { id: 'volumes', label: 'Volumes', render: () => <Volumes /> },
  { id: 'login-shelf', label: 'Login · Shelf', render: () => <LoginVariants variant="shelf" /> },
  { id: 'login-board', label: 'Login · Board', render: () => <LoginVariants variant="board" /> },
  { id: 'login-case', label: 'Login · Case', render: () => <LoginVariants variant="case" /> },
  { id: 'board', label: 'Departure Board', render: () => <DepartureBoard /> },
  { id: 'specimen', label: 'Specimen', render: () => <Specimen /> },
] as const

function currentId(): string {
  const hash = window.location.hash.replace('#', '')
  return WORLDS.some(w => w.id === hash) ? hash : WORLDS[0].id
}

function Prototypes() {
  const [id, setId] = useState(currentId)

  useEffect(() => {
    const onHash = () => setId(currentId())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const world = WORLDS.find(w => w.id === id) ?? WORLDS[0]

  return (
    <>
      <nav className="picker">
        <span>Prototype worlds</span>
        {WORLDS.map(w => (
          <button
            key={w.id}
            aria-current={w.id === world.id}
            onClick={() => { window.location.hash = w.id }}
          >
            {w.label}
          </button>
        ))}
      </nav>
      <div className="stage">{world.render()}</div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Prototypes />
  </StrictMode>,
)
