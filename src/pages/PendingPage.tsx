import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PendingPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState<string>('')
  const [status, setStatus] = useState<'verificando'|'pendente'|'aprovado'|'reprovado'>('verificando')

  useEffect(() => {
    let active = true

    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      const u = userData.user

      if (!u) {
        nav('/login', { replace: true })
        return
      }

      setEmail(u.email ?? '')

      // Admin bypass
      const { data: isAdm, error: admErr } = await supabase.rpc('is_admin')
      if (!active) return
      if (!admErr && isAdm) {
        nav('/admin', { replace: true })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('approved, rejected')
        .eq('id', u.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        console.error(error)
        setStatus('pendente')
        return
      }

      if (data?.rejected) {
        setStatus('reprovado')
        nav('/rejected', { replace: true })
        return
      }

      if (data?.approved) {
        setStatus('aprovado')
        nav('/app', { replace: true })
        return
      }

      setStatus('pendente')
    }

    load()
    const t = setInterval(load, 5000)

    return () => {
      active = false
      clearInterval(t)
    }
  }, [nav])

  async function sair() {
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center p-6'>
      <div className='w-full max-w-lg card space-y-3'>
        <h1 className='text-2xl font-extrabold'>Aguardando aprovação</h1>

        <p className='text-slate-300 text-sm'>
          Seu cadastro foi recebido{email ? ' (' + email + ')' : ''}. Assim que o admin aprovar, o acesso será liberado automaticamente.
        </p>

        <div className='text-xs text-slate-400'>
          Status: {status}
        </div>

        <button className='btn-ghost w-full justify-start text-red-200 hover:bg-red-500/10' onClick={sair}>
          Sair
        </button>
      </div>
    </div>
  )
}
