import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import faviconUrl from './assets/favicon.png?inline'

const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement('link')
iconLink.rel = 'icon'
iconLink.href = faviconUrl
document.head.appendChild(iconLink)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
