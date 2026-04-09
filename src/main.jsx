import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import KTDistillerApp from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KTDistillerApp />
  </StrictMode>,
)
