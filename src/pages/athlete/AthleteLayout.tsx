import { useEffect, useState } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

import AthleteHome from './AthleteHome'
import AthleteStages from './AthleteStages'
import AthleteProfile from './AthleteProfile'
import RankingPublic from '../RankingPublic'

import AthleteAnalyticsPage from './AthleteAnalyticsPage'
import AthleteStageAnalyticsPage from './AthleteStageAnalyticsPage'
import AthleteRounds from './AthleteRounds'

function MenuItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/athlete'}
      className={({ isActive }) =>
        'block w-full px-4 py-3 rounded-xl border transition ' +
        (isActive
          ? 'bg-gripoOrange/15 border-gripoOrange/40 text-white'
          : 'bg-white/5 border-white/10 text-slate-100 hover:bg-white/10')
      }
    >
      {label}
    </NavLink>
  )
}

export default function AthleteLayout() {
  const [athleteName, setAthleteName] = useState<string>("")

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

  const nav = useNavigate()

  async function sair() {
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white'>
      <div className='sticky top-0 z-20 border-b border-white/10 bg-gripoBlue/90 backdrop-blur'>
        <div className='max-w-[1400px] mx-auto px-6 py-4'>
          <div className='text-center'>
            <div className='text-2xl md:text-3xl font-extrabold tracking-tight'>
              Liga de Padel Ibirubense 35++
            </div>
            <div className='text-xs text-slate-300'>Área do Atleta</div>
          </div>
        </div>
      </div>

      <div className='max-w-[1400px] mx-auto px-6 py-6'>
        <div className='grid gap-6 md:grid-cols-[280px_1fr]'>
          <aside className='space-y-4'>
            <div className='card'>
              <div className='text-xs text-slate-300'>Navegação</div>
              <div className='text-lg font-bold'>Atleta{athleteName ? ` — ${athleteName}` : ""}</div>
            </div>

            <div className='space-y-2 max-h-[70vh] overflow-y-auto pr-1'>
              <MenuItem to='/athlete' label='Início' />
              <MenuItem to='/athlete/stages' label='Etapas' />
              <MenuItem to='/athlete/rounds' label='Rodada' />
              <MenuItem to='/athlete/ranking' label='Ranking' />
              <MenuItem to='/athlete/analytics' label='Analytics' />
              <MenuItem to='/athlete/profile' label='Meu Perfil' />
            </div>

            <button className='btn-ghost w-full text-left' onClick={sair}>
              Sair
            </button>
          </aside>

          <main className='min-h-[520px]'>
            <Routes>
              <Route path='/' element={<AthleteHome />} />
              <Route path='/stages' element={<AthleteStages />} />
              <Route path='/rounds' element={<AthleteRounds />} />
              <Route path='/ranking' element={<RankingPublic />} />
              <Route path='/analytics' element={<AthleteAnalyticsPage />} />
              <Route path='/analytics/stage/:stageId' element={<AthleteStageAnalyticsPage />} />
              <Route path='/profile' element={<AthleteProfile />} />
              <Route path='*' element={<Navigate to='/athlete' replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}
