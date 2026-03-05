import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SHIRT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG'] as const
type ShirtSize = typeof SHIRT_SIZES[number]

function isFutureDate(yyyyMmDd: string) {
  // yyyy-mm-dd
  const d = new Date(yyyyMmDd + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() > today.getTime()
}

export default function SignupPage() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const token = useMemo(() => (sp.get('token') || '').trim(), [sp])

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [shirtSize, setShirtSize] = useState<ShirtSize | ''>('')

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setErr(null)
  }, [nome, email, pass, birthDate, shirtSize])

  async function submit() {
    setErr(null)

    const n = (nome || '').trim()
    const em = (email || '').trim().toLowerCase()
    const pw = pass || ''
    const bd = (birthDate || '').trim()

    if (!token) return setErr('Convite inválido.')
    if (!n) return setErr('Informe o nome.')
    if (!em) return setErr('Informe o email.')
    if (pw.length < 10) return setErr('A senha deve ter no mí­nimo 10 caracteres.')
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) return setErr('A senha deve conter ao menos 1 maiúscula e 1 minúscula.')
    if (!bd) return setErr('Informe sua data de nascimento.')
    if (isFutureDate(bd)) return setErr('Data de nascimento não pode ser no futuro.')
    if (!shirtSize) return setErr('Selecione o tamanho da camiseta.')

    setBusy(true)
    try {
      // 1) Validar convite (RPC)
      const { data: ok, error: vErr } = await supabase.rpc('validate_invite', { p_token: token })
      if (vErr) throw vErr
      if (!ok) throw new Error('Convite inválido, expirado, usado ou revogado.')

      // 2) Criar usuÃ¡rio
      const { error: sErr } = await supabase.auth.signUp({ email: em, password: pw })
      if (sErr) throw sErr

      // 3) Login imediato (sem confirmação)
      const { error: inErr } = await supabase.auth.signInWithPassword({ email: em, password: pw })
      if (inErr) throw inErr

      // 4) Consumir convite (1 uso)
      const { error: cErr } = await supabase.rpc('consume_invite', { p_token: token })
      if (cErr) throw cErr

      // 5) Upsert profile (aguarda aprovação)
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id
      if (!uid) throw new Error('Falha ao obter usuário após login.')

      const { error: upErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: uid,
            nome: n,
            email: em,
            birth_date: bd,
            shirt_size: shirtSize,
            approved: false,
            rejected: false,
            approved_by: null,
            approved_at: null,
            rejected_by: null,
            rejected_at: null,
            rejected_reason: null,
            category: null,
          },
          { onConflict: 'id' }
        )

      if (upErr) throw upErr

      alert('Cadastro realizado. Aguarde aprovação do admin.')
      nav('/pending', { replace: true })
    } catch (e: any) {
      setErr(e?.message || 'Erro ao cadastrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='min-h-[70vh] flex items-center justify-center p-4'>
      <div className='w-full max-w-lg card'>
        <div className='text-2xl font-bold text-white'>Cadastro do Atleta</div>
        <div className='text-slate-300 text-sm mt-1'>Preencha seus dados e aguarde aprovação do admin.</div>

        <div className='mt-6 space-y-3'>
          <div>
            <div className='text-xs text-slate-300'>Nome</div>
            <input className='input w-full' value={nome} onChange={(e) => setNome(e.target.value)} placeholder='Seu nome completo' />
          </div>

          <div>
            <div className='text-xs text-slate-300'>Email</div>
            <input className='input w-full' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='seuemail@exemplo.com' />
          </div>

          <div>
            <div className='text-xs text-slate-300'>Senha</div>
            <input className='input w-full' type='password' value={pass} onChange={(e) => setPass(e.target.value)} placeholder='mín. 10 caracteres (1 maiúscula e 1 minúscula)' />
          </div>

          <div>
            <div className='text-xs text-slate-300'>Data de nascimento</div>
            <input className='input w-full' type='date' value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            <div className='text-[11px] text-slate-400 mt-1'>
              A liga 35++ considera a idade completada no ano da temporada.
            </div>
          </div>

          <div>
            <div className='text-xs text-slate-300'>Tamanho da camiseta</div>
            <select className='input w-full' value={shirtSize} onChange={(e) => setShirtSize(e.target.value as any)}>
              <option value=''>Selecione...</option>
              {SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {err && (
            <div className='rounded-lg border border-red-500/30 bg-red-900/30 p-2 text-sm text-red-200'>
              {err}
            </div>
          )}

          <button className='btn w-full' onClick={submit} disabled={busy}>
            {busy ? 'Cadastrando...' : 'Cadastrar'}
          </button>

          <div className='text-xs text-slate-400'>
            Convite: {token ? 'OK' : 'inválido'}
          </div>
        </div>
      </div>
    </div>
  )
}