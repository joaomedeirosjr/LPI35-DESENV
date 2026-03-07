import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

function SplashScreen({ visible }: { visible: boolean }) {
  return (
    <div className={`app-splash ${visible ? 'is-visible' : 'is-hidden'}`}>
      <div className="app-splash__content">
        <img
          src="/icons/icon-192.png"
          alt="Liga 35++"
          className="app-splash__icon"
        />
        <div className="app-splash__title">Liga 35++</div>
        <div className="app-splash__subtitle">Liga de Padel Ibirubense</div>
      </div>
    </div>
  )
}

function RootApp() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowSplash(false)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <SplashScreen visible={showSplash} />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
)