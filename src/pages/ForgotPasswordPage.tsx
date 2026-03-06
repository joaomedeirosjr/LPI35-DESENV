import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)

    if (!email) {
      setErr('Informe seu email.')
      return
    }

    setLoading(true)

    const redirectTo = `${window.location.origin}/redefinir-senha`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    setLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    setMsg(
      'Se existir uma conta para este email, enviamos um link de recuperação.'
    )
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center p-4'>
      <div className='w-full max-w-md card space-y-4'>
        <div>
          <h1 className='text-2xl font-extrabold'>Recuperar senha</h1>
          <p className='text-slate-300 text-sm'>
            Informe seu email para receber o link de recuperação
          </p>
        </div>

        <form onSubmit={handleReset} className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs text-slate-300'>Email</label>
            <input
              type='email'
              className='w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {err && <div className='text-red-200 text-sm'>{err}</div>}
          {msg && <div className='text-green-200 text-sm'>{msg}</div>}

          <button disabled={loading} className='btn-primary w-full'>
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </button>

          <div className='text-sm text-center'>
            <Link to='/login' className='text-gripoOrange hover:underline'>
              Voltar para login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}