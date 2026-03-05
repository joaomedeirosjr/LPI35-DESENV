import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AthleteHome from './AthleteHome'
import AthleteProfile from './AthleteProfile'

function NavItem({ label, to }: { label: string; to: string }) {
  const nav = useNavigate()
  const loc = useLocation()
  const active = loc.pathname === to

  return (
    <button
      onClick={() => nav(to)}
      className={[
        'w-full text-left px-3 py-2 rounded-xl border transition',
        active
          ? 'bg-gripoOrange/15 border-gripoOrange/40 text-white'
          : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export default function AppLayout() {
  const nav = useNavigate()
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    let active = true

    async function check() {
      try {
        const { data: sess } = await supabase.auth.getSession()
        if (!sess.session) {
          nav('/login', { replace: true })
          return
        }

        // Admin nunca entra na ?rea do atleta
        const { data: isAdm } = await supabase.rpc('is_admin')
        if (!active) return
        if (isAdm) {
          nav('/admin', { replace: true })
          return
        }

        const { data: u } = await supabase.auth.getUser()
        const user = u.user
        if (!user) {
          nav('/login', { replace: true })
          return
        }
        setEmail(user.email ?? '')

        // Gate: approved/rejected
        const { data: prof, error } = await supabase
          .from('profiles')
          .select('approved, rejected')
          .eq('id', user.id)
          .maybeSingle()

        if (!active) return

        if (error) {
          console.error(error)
          nav('/login', { replace: true })
          return
        }

        if (prof?.rejected) {
          nav('/rejected', { replace: true })
          return
        }

        if (!prof?.approved) {
          nav('/pending', { replace: true })
          return
        }

        setChecking(false)
      } catch (e) {
        console.error(e)
        nav('/login', { replace: true })
      }
    }

    check()

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') nav('/login', { replace: true })
      if (event === 'SIGNED_IN') check()
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [nav])

  async function sair() {
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  if (checking) {
    return (
      <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center'>
        <div className='card'>Validando acesso do atleta...</div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex flex-col'>
      {/* Topbar */}
      <header className='h-16 border-b border-white/10 bg-gripoBlue2 flex items-center justify-center px-4'>
        <div className='text-center'>
          <div className='text-lg md:text-2xl font-extrabold tracking-tight'>
            Liga de Padel Ibirubense 35++
          </div>
          <div className='text-xs text-slate-300 -mt-0.5'>
            Atleta  {email ? email : 'logado'}
          </div>
        </div>
      </header>

      <div className='flex flex-1 min-h-0'>
        {/* Sidebar */}
        <aside className='w-72 shrink-0 border-r border-white/10 bg-gripoBlue2 p-4 space-y-3'>
          <div className='card'>
            <div className='text-slate-300 text-xs'>Navega??o</div>
            <div className='text-white font-bold'>?rea do Atleta</div>
          </div>

          <div className='space-y-2'>
            <NavItem label='In?cio' to='/app' />
            <NavItem label='Meu Perfil' to='/app/profile' />
          </div>

          <div className='pt-3 border-t border-white/10' />

          <button className='btn-ghost w-full justify-start text-red-200 hover:bg-red-500/10' onClick={sair}>
            Sair
          </button>
        </aside>

        {/* Conte?do */}
        <main className='flex-1 min-w-0 p-6 overflow-auto'>
          <Routes>
            <Route path='/' element={<AthleteHome />} />
            <Route path='/profile' element={<AthleteProfile />} />
            <Route path='*' element={<Navigate to='/app' replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
