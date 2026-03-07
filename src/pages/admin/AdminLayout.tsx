import { useEffect, useMemo, useState } from "react"
import { NavLink, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { supabase } from "../../lib/supabase"

import AdminDashboard from "./AdminDashboard"
import AdminRounds from "./AdminRounds"
import AdminRanking from "./AdminRanking"
import AdminInvite from "./AdminInvite"
import AdminApproveUsers from "./AdminApproveUsers"
import AdminProfile from "./AdminProfile"

import AdminSeasons from "./AdminSeasons"
import AdminClubs from "./AdminClubs"
import AdminStages from "./AdminStages"
import AdminStageParticipants from "./AdminStageParticipants"

import RankingPublic from "../RankingPublic"

import AdminAthleteAnalyticsPage from "./AdminAthleteAnalyticsPage"
import AdminAthleteRoundsPage from "./AdminAthleteRoundsPage"
import AdminAthletePresencePage from "./AdminAthletePresencePage"

import AdminGuests from "./AdminGuests"

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
      end={to === "/admin"}
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

export default function AdminLayout() {
  const nav = useNavigate()
  const loc = useLocation()

  async function sair() {
    await supabase.auth.signOut()
    nav("/login", { replace: true })
  }

  const athleteBase = "/admin/athlete"
  const athletePaths = useMemo(
    () => [
      `${athleteBase}/presenca`,
      `${athleteBase}/rodada`,
      `${athleteBase}/ranking`,
      `${athleteBase}/analytics`,
    ],
    []
  )

  const isInAthlete = athletePaths.some((p) => loc.pathname.startsWith(p))
  const [athleteOpen, setAthleteOpen] = useState<boolean>(isInAthlete)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setAthleteOpen(isInAthlete)
  }, [isInAthlete])

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
        <div className="text-lg font-bold">Painel</div>
      </div>

      <div className="card">
        <button
          type="button"
          onClick={() => setAthleteOpen((v) => !v)}
          className="w-full text-left"
          aria-expanded={athleteOpen}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-300">Área do jogador</div>
              <div className="text-lg font-extrabold">ATLETA</div>
            </div>
            <div className="text-xs text-slate-300">{athleteOpen ? "▲" : "▼"}</div>
          </div>
        </button>

        {athleteOpen && (
          <div className="mt-3 space-y-2">
            <MenuItem
              to={`${athleteBase}/presenca`}
              label="Presença na Etapa"
              onClick={closeMobileMenu}
            />
            <MenuItem
              to={`${athleteBase}/rodada`}
              label="Rodada"
              onClick={closeMobileMenu}
            />
            <MenuItem
              to={`${athleteBase}/ranking`}
              label="Meu Ranking"
              onClick={closeMobileMenu}
            />
            <MenuItem
              to={`${athleteBase}/analytics`}
              label="Meu Analytics"
              onClick={closeMobileMenu}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <MenuItem to="/admin" label="Dashboard" onClick={closeMobileMenu} />
        <MenuItem to="/admin/seasons" label="Temporadas" onClick={closeMobileMenu} />
        <MenuItem to="/admin/clubs" label="Clubes" onClick={closeMobileMenu} />
        <MenuItem to="/admin/stages" label="Etapas" onClick={closeMobileMenu} />
        <MenuItem to="/admin/guests" label="Convidados" onClick={closeMobileMenu} />
        <MenuItem to="/admin/rounds" label="Rodadas" onClick={closeMobileMenu} />
        <MenuItem to="/admin/ranking" label="Ranking" onClick={closeMobileMenu} />
        <MenuItem
          to="/admin/stage-participants"
          label="Participantes por Etapa"
          onClick={closeMobileMenu}
        />
        <MenuItem to="/admin/invite" label="Gerar Convite" onClick={closeMobileMenu} />
        <MenuItem to="/admin/approve" label="Aprovar Atletas" onClick={closeMobileMenu} />
        <MenuItem to="/admin/profile" label="Meu Perfil" onClick={closeMobileMenu} />
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
                <div className="text-xs text-slate-300">Admin DEV</div>
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
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/seasons" element={<AdminSeasons />} />
                <Route path="/clubs" element={<AdminClubs />} />
                <Route path="/stages" element={<AdminStages />} />
                <Route path="/guests" element={<AdminGuests />} />
                <Route path="/rounds" element={<AdminRounds />} />
                <Route path="/ranking" element={<AdminRanking />} />
                <Route path="/stage-participants" element={<AdminStageParticipants />} />
                <Route path="/invite" element={<AdminInvite />} />
                <Route path="/approve" element={<AdminApproveUsers />} />
                <Route path="/profile" element={<AdminProfile />} />

                <Route path="/athlete/presenca" element={<AdminAthletePresencePage />} />
                <Route path="/athlete/rodada" element={<AdminAthleteRoundsPage />} />
                <Route path="/athlete/ranking" element={<RankingPublic embedded />} />
                <Route path="/athlete/analytics" element={<AdminAthleteAnalyticsPage />} />

                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}