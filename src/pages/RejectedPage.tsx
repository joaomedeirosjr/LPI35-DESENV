import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RejectedPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.auth.getUser()
      const user = u.user
      if (!user) { nav('/login', { replace: true }); return }

      setEmail(user.email ?? '')

      const { data: prof } = await supabase
        .from('profiles')
        .select('rejected, rejected_reason')
        .eq('id', user.id)
        .maybeSingle()

      if (!prof?.rejected) {
        nav('/pending', { replace: true })
        return
      }

      setReason((prof?.rejected_reason ?? '').toString())
    }
    load()
  }, [nav])

  async function sair() {
    await supabase.auth.signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center p-6'>
      <div className='w-full max-w-lg card space-y-3'>
        <h1 className='text-2xl font-extrabold'>Cadastro reprovado</h1>
        <p className='text-slate-300 text-sm'>
          Seu cadastro{email ? ' (' + email + ')' : ''} foi reprovado pelo administrador.
        </p>
        {reason ? (
          <div className='text-sm text-red-100 bg-red-500/10 border border-red-500/30 rounded-xl p-3'>
            Motivo: {reason}
          </div>
        ) : (
          <div className='text-xs text-slate-400'>Motivo não informado.</div>
        )}

        <button className='btn-ghost w-full justify-start text-red-200 hover:bg-red-500/10' onClick={sair}>
          Sair
        </button>
      </div>
    </div>
  )
}
