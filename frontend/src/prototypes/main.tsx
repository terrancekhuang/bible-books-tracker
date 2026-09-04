import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './proto.css'
import Prototypes from './Prototypes'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Prototypes />
  </StrictMode>,
)
