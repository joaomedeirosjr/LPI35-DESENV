import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function validatePassword(value: string) {
  if (value.length < 10) {
    return 'A senha deve ter no mínimo 10 caracteres.'
  }
  if (!/[A-Z]/.test(value)) {
    return 'A senha deve ter ao menos 1 letra maiúscula.'
  }
  if (!/[a-z]/.test(value)) {
    return 'A senha deve ter ao menos 1 letra minúscula.'
  }
  return null
}

export default function ResetPasswordPage() {
  const nav = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [linkReady, setLinkReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const passwordError = useMemo(() => {
    if (!password) return null
    return validatePassword(password)
  }, [password])

  useEffect(() => {
    let mounted = true

    async function checkRecoverySession() {
      setErr(null)
      setCheckingLink(true)

      const hash = window.location.hash || ''
      const hasAccessToken = hash.includes('access_token=')
      const hasRefreshToken = hash.includes('refresh_token=')
      const hasRecoveryType = hash.includes('type=recovery')

      const { data } = await supabase.auth.getSession()
      const hasSession = !!data.session

      if (!mounted) return

      if (hasSession || (hasAccessToken && hasRefreshToken) || hasRecoveryType) {
        setLinkReady(true)
        setCheckingLink(false)
        return
      }

      setLinkReady(false)
      setCheckingLink(false)
      setErr('Link de recuperação inválido ou expirado. Solicite um novo link.')
    }

    checkRecoverySession()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setLinkReady(true)
        setCheckingLink(false)
        setErr(null)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)

    const validationError = validatePassword(password)
    if (validationError) {
      setErr(validationError)
      return
    }

    if (password !== confirmPassword) {
      setErr('A confirmação da senha não confere.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setErr(error.message)
      return
    }

    setMsg('Senha redefinida com sucesso. Redirecionando para o login...')

    setTimeout(() => {
      nav('/login', { replace: true })
    }, 1500)
  }

  return (
    <div className='min-h-screen bg-gripoBlue text-white flex items-center justify-center p-4'>
      <div className='w-full max-w-md card space-y-4'>
        <div>
          <h1 className='text-2xl font-extrabold'>Redefinir senha</h1>
          <p className='text-slate-300 text-sm'>
            Defina sua nova senha de acesso
          </p>
        </div>

        {checkingLink ? (
          <div className='text-sm text-slate-300'>Validando link de recuperação...</div>
        ) : !linkReady ? (
          <div className='space-y-3'>
            {err && <div className='text-red-200 text-sm'>{err}</div>}

            <div className='text-sm text-center'>
              <Link to='/esqueci-senha' className='text-gripoOrange hover:underline'>
                Solicitar novo link
              </Link>
            </div>

            <div className='text-sm text-center'>
              <Link to='/login' className='text-gripoOrange hover:underline'>
                Voltar para login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className='space-y-3'>
            <div className='rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300'>
              A senha deve ter no mínimo 10 caracteres, com ao menos 1 letra
              maiúscula e 1 minúscula.
            </div>

            <div className='space-y-1'>
              <label className='text-xs text-slate-300'>Nova senha</label>
              <input
                type='password'
                autoComplete='new-password'
                className='w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className='space-y-1'>
              <label className='text-xs text-slate-300'>Confirmar nova senha</label>
              <input
                type='password'
                autoComplete='new-password'
                className='w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordError && (
              <div className='text-amber-200 text-sm'>{passwordError}</div>
            )}

            {err && <div className='text-red-200 text-sm'>{err}</div>}
            {msg && <div className='text-green-200 text-sm'>{msg}</div>}

            <button disabled={loading} className='btn-primary w-full'>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            <div className='text-sm text-center'>
              <Link to='/login' className='text-gripoOrange hover:underline'>
                Voltar para login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}