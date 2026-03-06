import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function routeAfterAuth() {
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) return

    // 1) Admin -> /admin
    const { data: isAdm, error: admErr } = await supabase.rpc('is_admin')
    if (!admErr && isAdm) {
      nav('/admin', { replace: true })
      return
    }

    // 2) Atleta -> checa approved/rejected
    const { data: u } = await supabase.auth.getUser()
    const user = u.user
    if (!user) {
      await supabase.auth.signOut()
      nav('/login', { replace: true })
      return
    }

    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('approved, rejected')
      .eq('id', user.id)
      .maybeSingle()

    if (pErr) {
      setErr(pErr.message)
      return
    }

    if (prof?.rejected) nav('/rejected', { replace: true })
    else if (prof?.approved) nav('/app', { replace: true })
    else nav('/pending', { replace: true })
  }

  useEffect(() => {
    routeAfterAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) return setErr(error.message)

    await routeAfterAuth()
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center p-4'>
      <div className='w-full max-w-md card space-y-4'>
        <div>
          <h1 className='text-2xl font-extrabold'>LIGA35 (DEV)</h1>
          <p className='text-slate-300 text-sm'>Acesso ao aplicativo</p>
        </div>

        <form onSubmit={onLogin} className='space-y-3'>
          <div className='space-y-1'>
            <label className='text-xs text-slate-300'>Email</label>
            <input
              type='email'
              autoComplete='email'
              className='w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className='space-y-1'>
            <label className='text-xs text-slate-300'>Senha</label>
            <input
              type='password'
              autoComplete='current-password'
              className='w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className='flex justify-end'>
            <Link
              to='/esqueci-senha'
              className='text-sm text-gripoOrange hover:underline'
            >
              Esqueci minha senha
            </Link>
          </div>

          {err && <div className='text-red-200 text-sm'>{err}</div>}

          <button disabled={loading} className='btn-primary w-full'>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}