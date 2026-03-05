import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ProfileRow = {
  id: string
  nome: string | null
  email: string | null
  approved: boolean | null
  category: string | null
}

export default function AdminProfile() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [row, setRow] = useState<ProfileRow | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  async function load() {
    setLoading(true)
    setErr(null)

    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      const emailFromAuth = sess?.session?.user?.email ?? null
      if (!uid) throw new Error('Sessão inválida. Faça login novamente.')

      // 1) Admin vem do RPC is_admin() (não de profiles.is_admin)
      const { data: adminOk, error: adminErr } = await supabase.rpc('is_admin')
      if (adminErr) throw adminErr
      setIsAdmin(Boolean(adminOk))

      // 2) Perfil (somente colunas existentes)
      // OBS: seu schema usa "nome" (PT-BR), não "name".
      const { data, error } = await supabase
        .from('profiles')
        .select('id,nome,email,approved,category')
        .eq('id', uid)
        .maybeSingle()

      if (error) throw error

      setRow({
        id: uid,
        nome: data?.nome ?? null,
        email: data?.email ?? emailFromAuth,
        approved: data?.approved ?? null,
        category: data?.category ?? null,
      })
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className='space-y-4'>
      <div className='text-2xl md:text-3xl font-extrabold'>Meu Perfil</div>

      {err && (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100'>
          <div className='font-semibold'>Erro</div>
          <div className='text-sm opacity-90'>{err}</div>
        </div>
      )}

      <div className='card'>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <div className='text-lg font-bold'>{row?.nome || '(sem nome)'}</div>
            <div className='text-sm text-slate-300'>{row?.email || ''}</div>
            <div className='text-xs text-slate-400 mt-2'>ID: {row?.id || ''}</div>
          </div>

          <button className='btn-ghost' onClick={load} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className='mt-4 grid grid-cols-1 md:grid-cols-3 gap-3'>
          <div className='rounded-xl border border-white/10 bg-white/5 p-3'>
            <div className='text-xs text-slate-300'>Admin</div>
            <div className='text-lg font-extrabold'>{isAdmin ? 'SIM' : 'NÃO'}</div>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-3'>
            <div className='text-xs text-slate-300'>Aprovado</div>
            <div className='text-lg font-extrabold'>{row?.approved ? 'SIM' : 'NÃO'}</div>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-3'>
            <div className='text-xs text-slate-300'>Categoria</div>
            <div className='text-lg font-extrabold'>{row?.category || ''}</div>
          </div>
        </div>
      </div>
    </div>
  )
}