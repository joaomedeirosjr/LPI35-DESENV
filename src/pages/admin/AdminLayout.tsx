import { useMemo, useState } from "react"
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

function MenuItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/admin"}
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

  return (
    <div className="min-h-screen bg-gripoBlue text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-gripoBlue/90 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Liga de Padel Ibirubense 35++
            </div>
            <div className="text-xs text-slate-300">Admin DEV</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="card">
              <div className="text-xs text-slate-300">Navegação</div>
              <div className="text-lg font-bold">Painel</div>
            </div>

            {/* MENU ATLETA */}
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
                  <MenuItem to={`${athleteBase}/presenca`} label="Presença na Etapa" />
                  <MenuItem to={`${athleteBase}/rodada`} label="Rodada" />
                  <MenuItem to={`${athleteBase}/ranking`} label="Meu Ranking" />
                  <MenuItem to={`${athleteBase}/analytics`} label="Meu Analytics" />
                </div>
              )}
            </div>

            {/* ADMIN */}
            <div className="space-y-2">
              <MenuItem to="/admin" label="Dashboard" />
              <MenuItem to="/admin/seasons" label="Temporadas" />
              <MenuItem to="/admin/clubs" label="Clubes" />
              <MenuItem to="/admin/stages" label="Etapas" />
              <MenuItem to="/admin/guests" label="Convidados" />
              <MenuItem to="/admin/rounds" label="Rodadas" />
              <MenuItem to="/admin/ranking" label="Ranking" />
              <MenuItem to="/admin/stage-participants" label="Participantes por Etapa" />
              <MenuItem to="/admin/invite" label="Gerar Convite" />
              <MenuItem to="/admin/approve" label="Aprovar Atletas" />
              <MenuItem to="/admin/profile" label="Meu Perfil" />
            </div>

            <button className="btn-ghost w-full text-left" onClick={sair}>
              Sair
            </button>
          </aside>

          <main className="min-h-[520px]">
            <Routes>
              {/* ADMIN */}
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

              {/* ATLETA dentro do Admin */}
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
  )
}