import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type StageRow = {
  id: number
  name: string | null
  stage_no: number | null
  status: string | null
  starts_on: string | null
}

type SPRow = {
  stage_id: number
  athlete_id: string
  going: boolean
  responded_at: string | null
}

type ProfileRow = {
  id: string
  nome: string | null
  email: string | null
  category: string | null
  categoria: string | null
}

type Joined = {
  athlete_id: string
  athlete_name: string
  email: string
  category: string
  responded_at: string | null
}

type TabKey = 'going' | 'notGoing'

function fmtDateOnly(v: string | null) {
  if (!v) return '-'
  const d = new Date(String(v).length === 10 ? String(v) + 'T00:00:00' : String(v))
  if (isNaN(d.getTime())) return String(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function fmtDateTime(v: string | null) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function stageLabel(s: StageRow) {
  const n = s.stage_no ? `#${s.stage_no}` : `#${s.id}`
  const name = s.name?.trim() ? s.name!.trim() : 'Etapa'
  const date = s.starts_on ? `  ${fmtDateOnly(s.starts_on)}` : ''
  return `${n} ${name}${date}`
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (x: string) => `"${String(x ?? '').replace(/"/g, '""')}"`
  const csv = rows.map(r => r.map(esc).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function AdminStageParticipants() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<StageRow[]>([])
  const [stageId, setStageId] = useState<string>('')

  const [tab, setTab] = useState<TabKey>('going') // going=Confirmados / notGoing=Recusaram
  const [people, setPeople] = useState<Joined[]>([])

  const isGoing = tab === 'going'

  async function loadStages() {
    setError(null)
    const { data, error } = await supabase
      .from('stages')
      .select('id,name,stage_no,status,starts_on')
      .order('id', { ascending: false })
      .limit(200)

    if (error) throw error
    setStages((data as StageRow[]) ?? [])
    if (!stageId && data && data.length) setStageId(String((data as any)[0].id))
  }

  async function loadParticipants(stage_id: number, going: boolean) {
    setError(null)
    setLoading(true)
    try {
      const { data: sp, error: e1 } = await supabase
        .from('stage_participants')
        .select('stage_id,athlete_id,going,responded_at')
        .eq('stage_id', stage_id)
        .eq('going', going)
        .order('responded_at', { ascending: true })

      if (e1) throw e1
      const rows = (sp as SPRow[]) ?? []
      const ids = Array.from(new Set(rows.map(r => r.athlete_id).filter(Boolean)))

      if (!ids.length) {
        setPeople([])
        return
      }

      const { data: prof, error: e2 } = await supabase
        .from('profiles')
        .select('id,nome,email,category,categoria')
        .in('id', ids)

      if (e2) throw e2
      const profiles = (prof as ProfileRow[]) ?? []
      const byId = new Map(profiles.map(p => [p.id, p]))

      const joined: Joined[] = rows.map(r => {
        const p = byId.get(r.athlete_id)
        const cat = (p?.category || p?.categoria || '').trim() || 'Sem categoria'
        return {
          athlete_id: r.athlete_id,
          athlete_name: (p?.nome || '').trim() || '(sem nome)',
          email: (p?.email || '').trim() || '-',
          category: cat,
          responded_at: r.responded_at,
        }
      })

      joined.sort((a, b) => {
        const c = a.category.localeCompare(b.category)
        if (c !== 0) return c
        return a.athlete_name.localeCompare(b.athlete_name)
      })

      setPeople(joined)
    } catch (err: any) {
      setError(err?.message || String(err))
      setPeople([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        await loadStages()
      } catch (err: any) {
        setError(err?.message || String(err))
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const n = Number(stageId)
    if (!n) return
    loadParticipants(n, isGoing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, tab])

  const grouped = useMemo(() => {
    const m = new Map<string, Joined[]>()
    for (const p of people) {
      const k = p.category || 'Sem categoria'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(p)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [people])

  const selectedStage = useMemo(() => {
    const id = Number(stageId)
    return stages.find(s => s.id === id) || null
  }, [stages, stageId])

  function exportCsv() {
    const stageTitle = selectedStage ? stageLabel(selectedStage) : 'etapa'
    const safe = stageTitle.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
    const kind = isGoing ? 'confirmados' : 'recusaram'

    const rows: string[][] = []
    rows.push(['categoria', 'atleta', 'email', 'respondido_em', 'status'])
    for (const [cat, list] of grouped) {
      for (const p of list) {
        rows.push([cat, p.athlete_name, p.email, fmtDateTime(p.responded_at), isGoing ? 'Vou' : 'Não vou'])
      }
    }
    downloadCsv(`participantes_${kind}_${safe}.csv`, rows)
  }

  const title = isGoing ? 'Confirmados (Vou)' : 'Recusaram (Não vou)'
  const subtitle = isGoing
    ? 'Lista de atletas que marcaram Vou, agrupado por categoria.'
    : 'Lista de atletas que marcaram Não vou, agrupado por categoria.'

  const tabBtn = (active: boolean) =>
    'px-4 py-2 rounded-xl border transition ' +
    (active
      ? 'bg-gripoOrange/15 border-gripoOrange/40 text-white'
      : 'bg-white/5 border-white/10 text-slate-100 hover:bg-white/10')

  return (
    <div className='space-y-6'>
      <div className='card'>
        <div className='text-xs text-slate-300'>Relatórios</div>
        <div className='text-2xl font-extrabold tracking-tight'>Participantes por etapa</div>
        <div className='text-slate-200/80'>Duas abas: <b>Confirmados</b> e <b>Recusaram</b> (CSV separado).</div>
      </div>

      {error && (
        <div className='card border-red-500/30 bg-red-500/10 text-red-200'>
          <div className='font-semibold'>Erro</div>
          <div className='text-sm whitespace-pre-wrap'>{error}</div>
        </div>
      )}

      <div className='card'>
        <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
          <div className='grid gap-2'>
            <label className='text-sm text-slate-200'>Selecionar etapa</label>
            <select
              className='input'
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loading}
            >
              <option value=''>Selecione...</option>
              {stages.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className='flex flex-wrap gap-2 items-center'>
            <button className={tabBtn(tab === 'going')} onClick={() => setTab('going')} disabled={loading}>
              Confirmados (Vou)
            </button>
            <button className={tabBtn(tab === 'notGoing')} onClick={() => setTab('notGoing')} disabled={loading}>
              Recusaram (Não vou)
            </button>

            <button
              className='btn-ghost'
              onClick={() => {
                if (stageId) loadParticipants(Number(stageId), isGoing)
              }}
              disabled={loading || !stageId}
            >
              Recarregar
            </button>

            <button className='btn' onClick={exportCsv} disabled={!stageId || grouped.length === 0}>
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      <div className='card'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <div className='text-lg font-bold'>{title}</div>
            <div className='text-sm text-slate-300'>
              {subtitle} Total: <b className='text-white'>{people.length}</b>
              {selectedStage?.starts_on ? (
                <span className='ml-3'>
                  Data da etapa: <b className='text-white'>{fmtDateOnly(selectedStage.starts_on)}</b>
                </span>
              ) : null}
            </div>
          </div>

          {loading && <div className='text-slate-300 text-sm'>Carregando...</div>}
        </div>

        <div className='mt-4 space-y-4'>
          {!stageId ? (
            <div className='text-slate-300'>Selecione uma etapa acima.</div>
          ) : grouped.length === 0 ? (
            <div className='text-slate-300'>Nenhum atleta nesta aba para esta etapa.</div>
          ) : (
            grouped.map(([cat, list]) => (
              <div key={cat} className='rounded-2xl border border-white/10 bg-white/5 p-4'>
                <div className='flex items-center justify-between'>
                  <div className='text-lg font-extrabold'>{cat}</div>
                  <div className='text-sm text-slate-300'>{list.length} atleta(s)</div>
                </div>

                <div className='mt-3 overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='text-slate-300'>
                        <th className='text-left py-2 pr-3'>Atleta</th>
                        <th className='text-left py-2 pr-3'>Email</th>
                        <th className='text-left py-2'>Respondido em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => (
                        <tr key={p.athlete_id} className='border-t border-white/10'>
                          <td className='py-2 pr-3 text-white'>{p.athlete_name}</td>
                          <td className='py-2 pr-3 text-slate-200'>{p.email}</td>
                          <td className='py-2 text-slate-200'>{fmtDateTime(p.responded_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}