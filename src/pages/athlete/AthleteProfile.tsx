import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Category = 'A' | 'B' | 'C' | 'D'
const SHIRT_SIZES = ['PP','P','M','G','GG','XGG'] as const
type ShirtSize = typeof SHIRT_SIZES[number]

type Profile = {
  id: string
  nome: string | null
  email: string | null
  category: Category | null
  shirt_size: string | null
  birth_date: string | null
  play_side: 'right' | 'left' | null
}

function formatIsoToBr(iso: string | null): string {
  if (!iso) return '(não informado)'
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso)
  if (!m) return '(não informado)'
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatPlaySide(v: 'right' | 'left' | null | undefined): string {
  if (!v) return '(não informado)'
  return v === 'right' ? 'Direito' : 'Esquerdo'
}

export default function AthleteProfile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [p, setP] = useState<Profile | null>(null)
  const [shirtSize, setShirtSize] = useState<ShirtSize | ''>('')

  async function load() {
    setLoading(true)
    setErr(null)

    const { data: u } = await supabase.auth.getUser()
    const uid = u?.user?.id
    if (!uid) { setLoading(false); return }

    const { data, error } = await supabase
      .from('profiles')
      .select('id,nome,email,category,shirt_size,birth_date,play_side')
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      setErr(error.message)
      setLoading(false)
      return
    }

    const prof = (data || null) as any as Profile | null
    setP(prof)
    setShirtSize(((prof?.shirt_size as any) || '') as any)
    setLoading(false)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!alive) return
      await load()
    })()
    return () => { alive = false }
  }, [])

  async function saveShirt() {
    setErr(null)
    setSaving(true)
    try {
      const { error } = await supabase.rpc('athlete_set_shirt_size', { p_size: shirtSize || null })
      if (error) throw error
      await load()
    } catch (e: any) {
      setErr(e?.message || 'Falha ao salvar camiseta')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className='card text-slate-300'>Carregando...</div>

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Meu Perfil</h1>
        <p className='text-slate-300 text-sm'>Dados do atleta</p>
      </div>

      {err && (
        <div className='rounded-lg border border-red-500/30 bg-red-900/30 p-2 text-sm text-red-200'>
          {err}
        </div>
      )}

      <div className='card space-y-3'>
        <div>
          <div className='text-slate-300 text-xs'>Nome</div>
          <div className='text-white font-semibold'>{p?.nome || '(sem nome)'}</div>
        </div>
        <div>
          <div className='text-slate-300 text-xs'>Email</div>
          <div className='text-white font-semibold'>{p?.email || '-'}</div>
        </div>
        <div>
          <div className='text-slate-300 text-xs'>Categoria</div>
          <div className='text-white font-semibold'>{p?.category || '-'}</div>
          {!p?.category && (
            <div className='text-xs text-amber-200 mt-1'>Aprovado, aguardando definição de categoria pelo admin.</div>
          )}
        </div>
        <div className='pt-3 border-t border-white/10'>
          <div className='text-slate-300 text-xs'>Data de nascimento</div>
          <div className='text-white font-semibold mt-1'>
            {formatIsoToBr(p?.birth_date ?? null)}
          </div>
        </div>

        
        <div className='pt-3 border-t border-white/10'>
          <div className='text-slate-300 text-xs'>Lado de jogo</div>
          <div className='text-white font-semibold mt-1'>
            {formatPlaySide(p?.play_side ?? null)}
          </div>
        </div>
<div className='pt-3 border-t border-white/10'>
          <div className='text-slate-300 text-xs'>Tamanho da camiseta</div>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <select className='input' value={shirtSize} onChange={(e) => setShirtSize(e.target.value as any)}>
              <option value=''>Selecione...</option>
              {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <button className='btn btn-orange' onClick={saveShirt} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
