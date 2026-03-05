import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type Profile = {
  id: string
  nome: string | null
  email: string | null
  approved: boolean | null
  rejected: boolean | null
  categoria: string | null
}

export default function AthleteGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const session = s?.session
      if (!alive) return

      if (!session?.user) {
        setRoute('/login')
        setLoading(false)
        return
      }

      const { data: isAdmin } = await supabase.rpc('is_admin')
      if (!alive) return
      if (isAdmin === true) {
        setRoute('/admin')
        setLoading(false)
        return
      }

      const uid = session.user.id
      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id,nome,email,approved,rejected,categoria')
        .eq('id', uid)
        .maybeSingle()

      if (!alive) return
      if (pErr || !p) {
        setRoute('/login')
        setLoading(false)
        return
      }

      const prof = p as Profile

      if (prof.rejected) {
        setRoute('/rejected')
        setLoading(false)
        return
      }

      if (!prof.approved) {
        setRoute('/pending')
        setLoading(false)
        return
      }

      setRoute(null)
      setLoading(false)
    })()

    return () => { alive = false }
  }, [])

  if (loading) {
    return (
      <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center'>
        <div className='card'>Carregando...</div>
      </div>
    )
  }

  if (route) return <Navigate to={route} replace />
  return <>{children}</>
}
