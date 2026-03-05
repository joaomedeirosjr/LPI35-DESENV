import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type StageAnalytics = {
  stageId: number
  summary: {
    played: number
    wins: number
    losses: number
    games_for: number
    games_against: number
    games_diff: number
    win_rate: number
  }
  ranking: {
    pos?: number
    points?: number
    category?: string
  }
  matches: Array<{
    match_id: string
    round_id: string
    group_id: string | null
    court_no: number
    slot_no: number
    team_label: string
    opp_label: string
    games_for: number
    games_against: number
    result: string
    ended_at: string | null
  }>
}

function pct(n: number) {
  const x = Number(n)
  return Number.isFinite(x) ? `${x.toFixed(1)}%` : '0.0%'
}

function fmtDT(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleString()
  } catch {
    return s
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className='card p-4'>
      <div className='text-xs text-slate-300'>{label}</div>
      <div className='text-2xl font-extrabold tracking-tight'>{value}</div>
    </div>
  )
}

export default function AthleteStageAnalyticsPage() {
  const { stageId } = useParams()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<StageAnalytics | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)

    const id = Number(stageId)
    if (!Number.isFinite(id)) {
      setErr('stageId inválido')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.rpc('athlete_analytics_stage', {
      p_stage_id: id,
    })

    if (error) {
      setErr(error.message)
      setData(null)
      setLoading(false)
      return
    }

    setData(data as StageAnalytics)
    setLoading(false)
  }

  useEffect(() => {
    load()

    const ch = supabase
      .channel('athlete-stage-analytics-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [stageId])

  if (loading) return <div className='card p-4'>Carregando etapa...</div>
  if (err) return <div className='card p-4 text-red-200'>Erro: {err}</div>
  if (!data) return <div className='card p-4'>Sem dados.</div>

  return (
    <div className='space-y-6'>
      <div className='card p-4'>
        <div className='text-sm text-slate-300'>Detalhamento</div>
        <div className='text-2xl font-extrabold tracking-tight'>Analytics da etapa #{data.stageId}</div>
      </div>

      <div className='grid gap-3 md:grid-cols-4'>
        <StatCard label='Jogos' value={data.summary.played} />
        <StatCard label='Vitórias' value={data.summary.wins} />
        <StatCard label='Derrotas' value={data.summary.losses} />
        <StatCard label='Win rate' value={pct(data.summary.win_rate)} />
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <StatCard label='Games pró' value={data.summary.games_for} />
        <StatCard label='Games contra' value={data.summary.games_against} />
        <StatCard label='Saldo' value={data.summary.games_diff} />
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <StatCard label='Pontos' value={data.ranking?.points ?? '—'} />
        <StatCard label='Posição' value={data.ranking?.pos ?? '—'} />
        <StatCard label='Categoria' value={data.ranking?.category ?? '—'} />
      </div>

      <div className='card p-4'>
        <div className='text-lg font-bold mb-3'>Jogos</div>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='text-slate-300'>
              <tr className='border-b border-white/10'>
                <th className='text-left py-2 pr-3'>Res</th>
                <th className='text-right py-2 px-2'>Quadra</th>
                <th className='text-right py-2 px-2'>Slot</th>
                <th className='text-left py-2 pr-3'>Minha dupla</th>
                <th className='text-left py-2 pr-3'>Adversários</th>
                <th className='text-right py-2 px-2'>Placar</th>
                <th className='text-left py-2 pl-2'>Fim</th>
              </tr>
            </thead>
            <tbody>
              {data.matches.map((m) => (
                <tr key={m.match_id} className='border-b border-white/5'>
                  <td className='py-2 pr-3 font-bold'>
                    {m.result === 'W' ? 'V' : m.result === 'L' ? 'D' : m.result}
                  </td>
                  <td className='py-2 px-2 text-right'>{m.court_no}</td>
                  <td className='py-2 px-2 text-right'>{m.slot_no}</td>
                  <td className='py-2 pr-3'>{m.team_label}</td>
                  <td className='py-2 pr-3'>{m.opp_label}</td>
                  <td className='py-2 px-2 text-right'>
                    {m.games_for} x {m.games_against}
                  </td>
                  <td className='py-2 pl-2'>{fmtDT(m.ended_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
