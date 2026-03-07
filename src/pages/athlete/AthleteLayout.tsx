import { useEffect, useState } from "react"
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { supabase } from "../../lib/supabase"

import AthleteHome from "./AthleteHome"
import AthleteStages from "./AthleteStages"
import AthleteProfile from "./AthleteProfile"
import RankingPublic from "../RankingPublic"

import AthleteAnalyticsPage from "./AthleteAnalyticsPage"
import AthleteStageAnalyticsPage from "./AthleteStageAnalyticsPage"
import AthleteRounds from "./AthleteRounds"

function MenuItem({
  to,
  label,
  onClick,
}: {
  to: string
  label: string
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={to === "/athlete"}
      onClick={onClick}
      className={({ isActive }) =>
        "block w-full px-4 py-3 rounded-xl border transition " +
        (isActive
          ? "bg-gripoOrange/15 border-gripoOrange/40 text-white"
          : "bg-white/5 border-white/10 text-slate-100 hover:bg-white/10")
      }
    >
      {label}
    </NavLink>
  )
}

export default function AthleteLayout() {
  const [athleteName, setAthleteName] = useState<string>("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const nav = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const u = await supabase.auth.getUser()
      const uid = u.data.user?.id
      if (!uid) return
      const pn = await supabase.from("profiles").select("nome").eq("id", uid).maybeSingle()
      if (!alive) return
      const nome = (pn.data as any)?.nome ?? ""
      setAthleteName(nome)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileMenuOpen])

  async function sair() {
    await supabase.auth.signOut()
    nav("/login", { replace: true })
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  async function sairMobile() {
    closeMobileMenu()
    await sair()
  }

  const sidebarContent = (
    <>
      <div className="card">
        <div className="text-xs text-slate-300">Navegação</div>
        <div className="text-lg font-bold">
          Atleta{athleteName ? ` — ${athleteName}` : ""}
        </div>
      </div>

      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        <MenuItem to="/athlete" label="Início" onClick={closeMobileMenu} />
        <MenuItem to="/athlete/stages" label="Etapas" onClick={closeMobileMenu} />
        <MenuItem to="/athlete/rounds" label="Rodada" onClick={closeMobileMenu} />
        <MenuItem to="/athlete/ranking" label="Ranking" onClick={closeMobileMenu} />
        <MenuItem to="/athlete/analytics" label="Analytics" onClick={closeMobileMenu} />
        <MenuItem to="/athlete/profile" label="Meu Perfil" onClick={closeMobileMenu} />
      </div>

      <button className="btn-ghost w-full text-left" onClick={sairMobile}>
        Sair
      </button>
    </>
  )

  return (
    <div className="min-h-screen w-full bg-gripoBlue text-white">
      <div className="sticky top-0 z-30 w-full border-b border-white/10 bg-gripoBlue/90 backdrop-blur">
        <div className="w-full px-4 md:px-6 py-4">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <span className="text-xl leading-none">☰</span>
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  Liga de Padel Ibirubense 35++
                </div>
                <div className="text-xs text-slate-300">Área do Atleta</div>
              </div>

              <div className="md:hidden w-10" />
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60"
            onClick={closeMobileMenu}
          />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[86%] max-w-[320px] bg-gripoBlue border-r border-white/10 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div>
                <div className="text-sm text-slate-300">Liga 35++</div>
                <div className="font-bold">Menu</div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white"
                onClick={closeMobileMenu}
                aria-label="Fechar menu"
              >
                <span className="text-lg leading-none">✕</span>
              </button>
            </div>

            <div className="h-[calc(100%-73px)] overflow-y-auto p-4 space-y-4">
              {sidebarContent}
            </div>
          </aside>
        </>
      )}

      <div className="w-full px-4 md:px-6 py-4 md:py-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <aside className="hidden md:block space-y-4">
              {sidebarContent}
            </aside>

            <main className="min-h-[520px]">
              <Routes>
                <Route path="/" element={<AthleteHome />} />
                <Route path="/stages" element={<AthleteStages />} />
                <Route path="/rounds" element={<AthleteRounds />} />
                <Route path="/ranking" element={<RankingPublic />} />
                <Route path="/analytics" element={<AthleteAnalyticsPage />} />
                <Route path="/analytics/stage/:stageId" element={<AthleteStageAnalyticsPage />} />
                <Route path="/profile" element={<AthleteProfile />} />
                <Route path="*" element={<Navigate to="/athlete" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}