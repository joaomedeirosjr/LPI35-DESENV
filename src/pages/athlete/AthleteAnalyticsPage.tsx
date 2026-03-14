import { useEffect, useMemo, useState } from "react"
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"

/* =========================
   Types + helpers
========================= */

type FallbackBestPartner = {
  partner_label: string
  played: number
  wins: number
  losses: number
  win_rate: number
  games_for: number
  games_against: number
  games_diff: number
}

type Agg = { played: number; wins: number; losses: number; gf: number; ga: number }
type BestAgg = Agg & { winRate: number; diff: number }

function computeBestPartnerFromMatches(args: {
  athleteName: string | null
  lastMatches: Array<{
    team_label: string
    result: string
    games_for: number
    games_against: number
  }>
}): FallbackBestPartner | null {
  const athlete = (args.athleteName ?? "").trim()
  if (!athlete) return null

  const agg = new Map<string, Agg>()

  for (const m of args.lastMatches ?? []) {
    const parts = (m.team_label ?? "")
      .split(" + ")
      .map((x) => x.trim())
      .filter(Boolean)
    if (parts.length !== 2) continue

    let partner: string | null = null
    if (parts[0] === athlete) partner = parts[1]
    else if (parts[1] === athlete) partner = parts[0]
    else {
      if (parts[0].includes(athlete)) partner = parts[1]
      else if (parts[1].includes(athlete)) partner = parts[0]
      else continue
    }

    const a: Agg = agg.get(partner) ?? { played: 0, wins: 0, losses: 0, gf: 0, ga: 0 }
    a.played += 1
    if (m.result === "W") a.wins += 1
    else if (m.result === "L") a.losses += 1
    a.gf += Number(m.games_for ?? 0)
    a.ga += Number(m.games_against ?? 0)
    agg.set(partner, a)
  }

  if (agg.size === 0) return null

  let best: { partner: string; a: BestAgg } | null = null

  for (const [partner, a0] of agg.entries()) {
    const winRate = a0.played > 0 ? (a0.wins / a0.played) * 100 : 0
    const diff = a0.gf - a0.ga
    const a: BestAgg = { ...a0, winRate, diff }

    if (!best) {
      best = { partner, a }
      continue
    }

    const b: BestAgg = best.a

    const better =
      a.wins > b.wins ||
      (a.wins === b.wins && a.winRate > b.winRate) ||
      (a.wins === b.wins && a.winRate === b.winRate && a.diff > b.diff) ||
      (a.wins === b.wins && a.winRate === b.winRate && a.diff === b.diff && a.played > b.played) ||
      (a.wins === b.wins && a.winRate === b.winRate && a.diff === b.diff && a.played === b.played && partner < best.partner)

    if (better) best = { partner, a }
  }

  if (!best) return null
  return {
    partner_label: best.partner,
    played: best.a.played,
    wins: best.a.wins,
    losses: best.a.losses,
    win_rate: Number(best.a.winRate.toFixed(1)),
    games_for: best.a.gf,
    games_against: best.a.ga,
    games_diff: best.a.diff,
  }
}

type Overview = {
  summary: {
    played: number
    wins: number
    losses: number
    win_rate: number
    games_for: number
    games_against: number
    games_diff: number
  }
  bySeason: Array<{
    season_id: string
    season_name: string
    year: number | null
    played: number
    wins: number
    losses: number
    win_rate: number
    games_for: number
    games_against: number
    games_diff: number
    bonus_less_games: number
    adjusted_games_diff: number
    adjusted_matches_played?: number
    total_points: number
    stages_played: number
  }>
  byStage: Array<{
    stage_id: number
    stage_name: string
    club_name: string | null
    stage_date: string | null
    season_id: string
    season_name: string
    played: number
    wins: number
    losses: number
    win_rate: number
    games_for: number
    games_against: number
    games_diff: number
    bonus_less_games: number
    adjusted_games_diff: number
    adjusted_matches_played: number
    stage_points: number | null
    stage_position: number | null
  }>
  lastMatches: Array<{
    match_id: string
    season_id: string
    season_name: string
    stage_id: number
    stage_name: string
    club_name: string | null
    round_id: string
    round_name: string
    round_no: number | null
    court_no: number
    slot_no: number
    ended_at: string | null
    team_label: string
    opp_label: string
    games_for: number
    games_against: number
    result: "W" | "L" | "T"
  }>
}

type BestPartner = {
  partner_label: string | null
  played: number
  wins: number
  losses: number
  win_rate: number
  games_for: number
  games_against: number
  games_diff: number
}

type ResultIconInfo = { label: string; kind: "win" | "loss" | "tie" }

function resultIcon(r: string): ResultIconInfo {
  if (r === "W") return { label: "V", kind: "win" }
  if (r === "L") return { label: "D", kind: "loss" }
  return { label: r, kind: "tie" }
}

function ResIcon({ kind }: { kind: ResultIconInfo["kind"] }) {
  if (kind === "win") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm-1 14l-4-4l1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z"
        />
      </svg>
    )
  }
  if (kind === "loss") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm3.7 13.3L13.4 13l2.3-2.3L14.3 9.3L12 11.6L9.7 9.3L8.3 10.7L10.6 13l-2.3 2.3l1.4 1.4L12 14.4l2.3 2.3l1.4-1.4Z"
        />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm-5 11h10v-2H7v2Z" />
    </svg>
  )
}

function pct(n: number) {
  const x = Number(n)
  return Number.isFinite(x) ? `${x.toFixed(1)}%` : "0.0%"
}

function fmtDT(s: string | null) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString()
  } catch {
    return s
  }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  )
}

function StatCardSub({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      {sub ? <div className="text-xs text-slate-300 mt-1">{sub}</div> : null}
    </div>
  )
}

/* =========================
   Chart (NO default export)
========================= */

type EvoMetric = "points" | "win_rate" | "position"

function fmtPct(v: number) {
  if (!isFinite(v)) return "0%"
  return `${v.toFixed(1)}%`
}

function shortLabel(name: string) {
  const n = (name ?? "").trim()
  return n.length > 18 ? n.slice(0, 18) + "…" : n
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function StageEvolutionSvgChart({ byStage }: { byStage: any[] }) {
  const [metric, setMetric] = React.useState<EvoMetric>("points")
  const [hover, setHover] = React.useState<number | null>(null)

  const rows = React.useMemo(() => {
    const r = [...(byStage ?? [])]
    r.sort((a, b) => {
      const ad = a.stage_date ? new Date(a.stage_date).getTime() : 0
      const bd = b.stage_date ? new Date(b.stage_date).getTime() : 0
      if (ad && bd && ad !== bd) return ad - bd
      return (a.stage_id ?? 0) - (b.stage_id ?? 0)
    })
    return r.map((s) => ({
      stage_id: s.stage_id,
      label: shortLabel(s.stage_name ?? ""),
      fullLabel: s.stage_name ?? "",
      club: s.club_name ?? s.club ?? null,
      points: Number(s.stage_points ?? 0),
      position: Number(s.stage_position ?? 0),
      winRate: Number(s.win_rate ?? 0),
      wins: Number(s.wins ?? 0),
      losses: Number(s.losses ?? 0),
      played: Number(s.played ?? 0),
      gamesDiff: Number(s.adjusted_games_diff ?? s.games_diff ?? 0),
    }))
  }, [byStage])

  const summary = React.useMemo(() => {
    if (!rows.length) return null
    const last = rows[rows.length - 1]
    const avgWin = rows.reduce((acc, x) => acc + x.winRate, 0) / rows.length
    const bestPoints = Math.max(...rows.map((x) => x.points))
    const bestWin = Math.max(...rows.map((x) => x.winRate))
    return { last, avgWin, bestPoints, bestWin }
  }, [rows])

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-slate-300">Sem dados suficientes para mostrar evolução por etapa.</div>
      </div>
    )
  }

  const metricKey = metric === "points" ? "points" : metric === "win_rate" ? "winRate" : "position"
  const metricLabel = metric === "points" ? "Pontos" : metric === "win_rate" ? "Win rate" : "Posição"

  const values = rows.map((r) => r[metricKey as keyof typeof r] as number)

  const domain = React.useMemo(() => {
    if (metric === "points") {
      const max = Math.max(...values)
      return { min: 0, max: Math.max(10, max + 2) }
    }
    if (metric === "win_rate") return { min: 0, max: 100 }
    const maxPos = Math.max(...values)
    return { min: 1, max: Math.max(2, maxPos) }
  }, [metric, values])

  const W = 1120
  const H = 360
  const padL = 56
  const padR = 22
  const padT = 18
  const padB = 48
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const xAt = (i: number) => {
    if (rows.length === 1) return padL + innerW / 2
    return padL + (innerW * i) / (rows.length - 1)
  }

  const yAt = (v: number) => {
    const min = domain.min
    const max = domain.max
    if (max === min) return padT + innerH / 2
    if (metric === "position") {
      const t = (v - min) / (max - min)
      return padT + innerH * t
    }
    const t = (v - min) / (max - min)
    return padT + innerH * (1 - t)
  }

  const pts = rows.map((r, i) => {
    const v = r[metricKey as keyof typeof r] as number
    return { i, x: xAt(i), y: yAt(v), v, r }
  })

  const linePath = pts.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L ${xAt(rows.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

  const avgY = metric === "win_rate" && summary ? yAt(clamp(summary.avgWin, 0, 100)) : null

  const yTicks = React.useMemo(() => {
    const n = 4
    const res: { v: number; y: number; label: string }[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const v = domain.min + (domain.max - domain.min) * (metric === "position" ? t : 1 - t)
      const y = padT + innerH * t
      let label = ""
      if (metric === "win_rate") label = `${Math.round(v)}%`
      else if (metric === "position") label = `#${Math.round(v)}`
      else label = `${Math.round(v)}`
      res.push({ v, y, label })
    }
    return res
  }, [domain.max, domain.min, metric])

  const hovered = hover != null ? pts[hover] : null

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">Evolução por etapa</div>
          <div className="text-xs text-slate-300">Gráfico robusto sem bibliotecas externas (SVG).</div>

          <div className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${metric === "points" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"}`}
              onClick={() => setMetric("points")}
              type="button"
            >
              Pontos
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${metric === "win_rate" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"}`}
              onClick={() => setMetric("win_rate")}
              type="button"
            >
              Win rate
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${metric === "position" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"}`}
              onClick={() => setMetric("position")}
              type="button"
            >
              Posição
            </button>
          </div>
        </div>

        {summary ? (
          <div className="flex flex-wrap gap-2 justify-end">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Última etapa</div>
              <div className="text-sm font-semibold text-white">
                {summary.last.fullLabel}{" "}
                <span className="text-slate-300 font-medium">
                  (#{summary.last.position}, {summary.last.points} pts, {fmtPct(summary.last.winRate)})
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Média win rate</div>
              <div className="text-sm font-semibold text-white">{fmtPct(summary.avgWin)}</div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Melhor</div>
              <div className="text-sm font-semibold text-white">
                {summary.bestPoints} pts • {fmtPct(summary.bestWin)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 relative">
        {hovered ? (
          <div className="absolute z-10 -top-2 left-0 right-0 flex justify-center pointer-events-none">
            <div className="pointer-events-none rounded-xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur max-w-[560px] w-[92%] md:w-auto">
              <div className="text-sm font-semibold text-white">{hovered.r.fullLabel}</div>
              <div className="mt-1 text-xs text-slate-300">{hovered.r.club ? `Clube: ${hovered.r.club}` : "Clube: —"}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-slate-300">Pontos</div>
                <div className="text-right font-semibold text-white">{hovered.r.points}</div>

                <div className="text-slate-300">Posição</div>
                <div className="text-right font-semibold text-white">#{hovered.r.position}</div>

                <div className="text-slate-300">Win rate</div>
                <div className="text-right font-semibold text-white">{fmtPct(hovered.r.winRate)}</div>

                <div className="text-slate-300">V–D</div>
                <div className="text-right font-semibold text-white">
                  {hovered.r.wins}–{hovered.r.losses} ({hovered.r.played})
                </div>

                <div className="text-slate-300">Saldo</div>
                <div className="text-right font-semibold text-white">{hovered.r.gamesDiff}</div>
              </div>
            </div>
          </div>
        ) : null}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[360px] rounded-xl border border-white/10 bg-slate-950/30"
          role="img"
          aria-label="Evolução por etapa"
        >
          <defs>
            <linearGradient id="evoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.45)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.00)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="rgba(255,255,255,0.08)" />
              <text x={padL - 12} y={t.y + 4} textAnchor="end" fill="rgba(226,232,240,0.75)" fontSize="12">
                {t.label}
              </text>
            </g>
          ))}

          {avgY != null ? <line x1={padL} x2={W - padR} y1={avgY} y2={avgY} stroke="rgba(255,255,255,0.22)" strokeDasharray="6 6" /> : null}

          <path d={areaPath} fill="url(#evoArea)" />
          <path d={linePath} fill="none" stroke="rgba(52,211,153,0.95)" strokeWidth="3" filter="url(#glow)" />

          {pts.map((p) => (
            <g
              key={p.i}
              onMouseEnter={() => setHover(p.i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(p.i)}
              onTouchEnd={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={hover === p.i ? 7 : 4} fill="rgba(52,211,153,1)" stroke="rgba(15,23,42,0.95)" strokeWidth="3" />
            </g>
          ))}

          {pts.map((p) => (
            <text key={`xl-${p.i}`} x={p.x} y={H - 18} textAnchor="middle" fill="rgba(226,232,240,0.75)" fontSize="12">
              {p.r.label}
            </text>
          ))}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <div>
            <span className="font-semibold text-white">{metricLabel}</span> <span className="text-slate-400">•</span> passe o mouse/toque nos pontos
          </div>
          <div className="text-slate-400">Sem libs externas</div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   Page (DEFAULT export)
========================= */

export default function AthleteAnalyticsPage({ embedded = true }: { embedded?: boolean }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [data, setData] = useState<Overview | null>(null)
  const [bestPartner, setBestPartner] = useState<BestPartner | null>(null)
  const [athleteName, setAthleteName] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setErr(null)

    const u = await supabase.auth.getUser()
    const uid = u.data.user?.id ?? null
    if (!uid) {
      setErr("Você precisa estar logado.")
      setData(null)
      setBestPartner(null)
      setLoading(false)
      return
    }

    let athleteNameLocal: string | null = null
    const pn = await supabase.from("profiles").select("nome").eq("id", uid).maybeSingle()
    athleteNameLocal = ((pn.data as any)?.nome ?? null) as any
    setAthleteName(athleteNameLocal)

    const statsRes = await supabase
      .from("v_stage_player_stats")
      .select("stage_id, category, profile_id, player_name, matches_played, wins, losses, games_for, games_against, games_diff, birth_date, age_years")
      .eq("profile_id", uid)

    if (statsRes.error) {
      setErr(statsRes.error.message)
      setData(null)
      setBestPartner(null)
      setLoading(false)
      return
    }

    const statsRows = ((statsRes.data ?? []) as any[]).filter((r) => Number(r.matches_played ?? 0) > 0)

    if (statsRows.length === 0) {
      setData({
        summary: { played: 0, wins: 0, losses: 0, win_rate: 0, games_for: 0, games_against: 0, games_diff: 0 },
        bySeason: [],
        byStage: [],
        lastMatches: [],
      } as any)
      setBestPartner(null)
      setLoading(false)
      return
    }

    const stageIds = Array.from(new Set(statsRows.map((r) => Number(r.stage_id)).filter(Boolean)))

    const stagesRes = await supabase.from("stages").select("id, name, season_id, club_id, stage_date").in("id", stageIds)
    if (stagesRes.error) {
      setErr(stagesRes.error.message)
      setData(null)
      setBestPartner(null)
      setLoading(false)
      return
    }

    const stages = (stagesRes.data ?? []) as any[]
    const stageById = new Map<number, any>()
    for (const s of stages) stageById.set(Number(s.id), s)

    const seasonIds = Array.from(new Set(stages.map((s) => String(s.season_id)).filter(Boolean)))
    const clubIds = Array.from(new Set(stages.map((s) => String(s.club_id)).filter(Boolean)))

    const [seasonsRes, clubsRes, posRes, ov, bp] = await Promise.all([
      supabase.from("seasons").select("id, name").in("id", seasonIds),
      clubIds.length ? supabase.from("clubs").select("id, name").in("id", clubIds) : Promise.resolve({ data: [], error: null } as any),
      supabase
        .from("v_ranking_stage_players")
        .select("stage_id, category, profile_id, position, bonus_less_games, adjusted_games_diff, adjusted_matches_played")
        .eq("profile_id", uid)
        .in("stage_id", stageIds),
      supabase.rpc("athlete_analytics_overview", { p_season_id: null }),
      supabase.rpc("athlete_analytics_best_partner", { p_season_id: null }),
    ])

    const seasonById = new Map<string, any>()
    if (!seasonsRes.error) for (const s of (seasonsRes.data ?? []) as any[]) seasonById.set(String(s.id), s)

    const clubById = new Map<string, any>()
    if (!clubsRes.error) for (const c of (clubsRes.data ?? []) as any[]) clubById.set(String(c.id), c)

    const posKey = (stage_id: number, category: string) => `${stage_id}|${category}`
    const posBy = new Map<string, number>()
    const rankExtraBy = new Map<string, { bonus_less_games: number; adjusted_games_diff: number; adjusted_matches_played: number }>()
    if (!posRes.error) {
      for (const r of (posRes.data ?? []) as any[]) {
        const key = posKey(Number(r.stage_id), String(r.category))
        posBy.set(key, Number(r.position ?? 0))
        rankExtraBy.set(key, {
          bonus_less_games: Number(r.bonus_less_games ?? 0),
          adjusted_games_diff: Number(r.adjusted_games_diff ?? r.games_diff ?? 0),
          adjusted_matches_played: Number(r.adjusted_matches_played ?? r.matches_played ?? 0),
        })
      }
    }

    const byStage = statsRows.map((r) => {
      const sid = Number(r.stage_id)
      const st = stageById.get(sid)
      const seasonId = st?.season_id ? String(st.season_id) : ""
      const season = seasonById.get(seasonId)
      const club = st?.club_id ? clubById.get(String(st.club_id)) : null

      const played = Number(r.matches_played ?? 0)
      const wins = Number(r.wins ?? 0)
      const losses = Number(r.losses ?? 0)
      const win_rate = played > 0 ? (wins / played) * 100 : 0
      const rankExtra = rankExtraBy.get(posKey(sid, String(r.category)))

      const stage_points = wins * 10

      return {
        stage_id: sid,
        stage_name: st?.name ?? `Etapa ${sid}`,
        club_name: club?.name ?? null,
        stage_date: st?.stage_date ?? null,
        season_id: seasonId,
        season_name: season?.name ?? "—",
        played,
        wins,
        losses,
        win_rate,
        games_for: Number(r.games_for ?? 0),
        games_against: Number(r.games_against ?? 0),
        games_diff: Number(r.games_diff ?? 0),
        bonus_less_games: Number(rankExtra?.bonus_less_games ?? 0),
        adjusted_games_diff: Number(rankExtra?.adjusted_games_diff ?? r.games_diff ?? 0),
        adjusted_matches_played: Number(rankExtra?.adjusted_matches_played ?? r.matches_played ?? 0),
        stage_points,
        stage_position: posBy.get(posKey(sid, String(r.category))) ?? null,
      }
    })

    const totalPlayed = byStage.reduce((acc, x) => acc + Number(x.played ?? 0), 0)
    const totalWins = byStage.reduce((acc, x) => acc + Number(x.wins ?? 0), 0)
    const totalLosses = byStage.reduce((acc, x) => acc + Number(x.losses ?? 0), 0)
    const totalGF = byStage.reduce((acc, x) => acc + Number(x.games_for ?? 0), 0)
    const totalGA = byStage.reduce((acc, x) => acc + Number(x.games_against ?? 0), 0)
    const totalDiff = byStage.reduce((acc, x) => acc + Number(x.adjusted_games_diff ?? x.games_diff ?? 0), 0)
    const totalBonus = byStage.reduce((acc, x) => acc + Number(x.bonus_less_games ?? 0), 0)
    const totalWR = totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : 0

    const bySeasonMap = new Map<string, any>()
    for (const st of byStage) {
      const key = st.season_id
      const cur = bySeasonMap.get(key) ?? {
        season_id: st.season_id,
        season_name: st.season_name,
        year: null,
        played: 0,
        wins: 0,
        losses: 0,
        games_for: 0,
        games_against: 0,
        games_diff: 0,
        total_points: 0,
        stages_played: 0,
        win_rate: 0,
        bonus_less_games: 0,
        adjusted_games_diff: 0,
      }
      cur.played += Number(st.played ?? 0)
      cur.wins += Number(st.wins ?? 0)
      cur.losses += Number(st.losses ?? 0)
      cur.games_for += Number(st.games_for ?? 0)
      cur.games_against += Number(st.games_against ?? 0)
      cur.total_points += Number(st.stage_points ?? 0)
      cur.bonus_less_games += Number(st.bonus_less_games ?? 0)
      cur.adjusted_games_diff += Number(st.adjusted_games_diff ?? st.games_diff ?? 0)
      cur.stages_played += Number(st.played ?? 0) > 0 ? 1 : 0
      bySeasonMap.set(key, cur)
    }

    const bySeason = Array.from(bySeasonMap.values()).map((x) => {
      x.games_diff = Number(x.adjusted_games_diff ?? 0)
      x.win_rate = Number(x.played) > 0 ? (Number(x.wins) / Number(x.played)) * 100 : 0
      return x
    })

    const ovData = ov && !(ov as any).error ? ((ov as any).data as any) : null
    const lastMatches = (ovData?.lastMatches ?? []) as any[]

    setData({
      summary: {
        played: totalPlayed,
        wins: totalWins,
        losses: totalLosses,
        win_rate: totalWR,
        games_for: totalGF,
        games_against: totalGA,
        games_diff: totalDiff,
        bonus_less_games: totalBonus,
      } as any,
      bySeason,
      byStage,
      lastMatches,
    } as any)

    const bpData = (((bp as any)?.data) as any) ?? null
    const bpPartner = bpData?.partner_label ?? bpData?.partner_name ?? bpData?.partner ?? null
    if (!bpPartner) {
      const fb = computeBestPartnerFromMatches({ athleteName: athleteNameLocal ?? athleteName, lastMatches: lastMatches as any })
      setBestPartner((fb ?? null) as any)
    } else {
      setBestPartner((bpData ?? null) as any)
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()

    const ch = supabase
      .channel("athlete-analytics-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void load())
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stagesSorted = useMemo(() => {
    const arr = data?.byStage ? [...data.byStage] : []
    arr.sort((a, b) => (b.stage_id ?? 0) - (a.stage_id ?? 0))
    return arr
  }, [data])

  const lastMatchesSorted = useMemo(() => {
    const arr = (data?.lastMatches ?? []) as any[]
    return [...arr].sort((a, b) => {
      const ta = a?.ended_at ? Date.parse(a.ended_at) : 0
      const tb = b?.ended_at ? Date.parse(b.ended_at) : 0
      if (tb !== ta) return tb - ta
      return String(b?.match_id ?? "").localeCompare(String(a?.match_id ?? ""))
    })
  }, [data])

  if (loading) return <div className="card p-4">Carregando Analytics...</div>
  if (err) return <div className="card p-4 text-red-200">Erro: {err}</div>
  if (!data) return <div className="card p-4">Sem dados.</div>

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-gripoBlue text-white space-y-6 p-6"}>
      <div className="card p-4">
        <div className="text-sm text-slate-300">Desempenho geral</div>
        <div className="text-2xl font-extrabold tracking-tight">Analytics</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Jogos" value={data.summary.played} />
        <StatCard label="Vitórias" value={data.summary.wins} />
        <StatCard label="Derrotas" value={data.summary.losses} />
        <StatCard label="Win rate" value={pct(data.summary.win_rate)} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Games pró" value={data.summary.games_for} />
        <StatCard label="Games contra" value={data.summary.games_against} />
        <StatCard label="Saldo ajustado" value={data.summary.games_diff} />
        <StatCard label="Compensação" value={Number((data.summary as any).bonus_less_games ?? 0) > 0 ? `+${Number((data.summary as any).bonus_less_games)}` : "—"} />
      </div>

      <div className="card p-4">
        <div className="text-lg font-bold mb-2">Melhor dupla do atleta</div>
        <div className="text-xs text-slate-300 mb-3">
          Baseado no histórico de jogos <b>played</b>, considerando o parceiro que mais rendeu (vitórias e desempenho).
        </div>

        {bestPartner?.partner_label ? (
          <div className="grid gap-3 md:grid-cols-4">
            <StatCardSub label="Parceiro" value={bestPartner.partner_label} sub={`${bestPartner.played} jogo(s) juntos`} />
            <StatCard label="Vitórias" value={bestPartner.wins} />
            <StatCard label="Derrotas" value={bestPartner.losses} />
            <StatCard label="Win rate" value={pct(bestPartner.win_rate)} />
            <StatCard label="Games pró" value={bestPartner.games_for} />
            <StatCard label="Games contra" value={bestPartner.games_against} />
            <StatCard label="Saldo" value={bestPartner.games_diff} />
          </div>
        ) : (
          <div className="text-sm text-slate-200">Ainda não foi possível calcular a melhor dupla (dados insuficientes ou parceiro não identificado).</div>
        )}
      </div>

      <div className="card p-4">
        <div className="text-lg font-bold mb-3">Temporadas</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-3">Temporada</th>
                <th className="text-right py-2 px-2">Pontos</th>
                <th className="text-right py-2 px-2">Etapas</th>
                <th className="text-right py-2 px-2">Jogos</th>
                <th className="text-right py-2 px-2">V</th>
                <th className="text-right py-2 px-2">D</th>
                <th className="text-right py-2 px-2">Win%</th>
                <th className="text-right py-2 px-2">Comp.</th>
                <th className="text-right py-2 px-2">Comp.</th>
                <th className="text-right py-2 pl-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.bySeason.map((s) => (
                <tr key={s.season_id} className="border-b border-white/5">
                  <td className="py-2 pr-3">{s.season_name}</td>
                  <td className="py-2 px-2 text-right">{s.total_points}</td>
                  <td className="py-2 px-2 text-right">{s.stages_played}</td>
                  <td className="py-2 px-2 text-right">{s.played}</td>
                  <td className="py-2 px-2 text-right">{s.wins}</td>
                  <td className="py-2 px-2 text-right">{s.losses}</td>
                  <td className="py-2 px-2 text-right">{pct(s.win_rate)}</td>
                  <td className="py-2 px-2 text-right">{Number(s.bonus_less_games ?? 0) > 0 ? `+${Number(s.bonus_less_games)}` : "—"}</td>
                  <td className="py-2 pl-2 text-right">{s.games_diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-lg font-bold mb-3">Etapas</div>
        <div className="text-xs text-slate-300 mb-3">Lista por etapa. (A navegação detalhada por etapa você pode ativar depois.)</div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-3">Etapa</th>
                <th className="text-left py-2 pr-3">Temporada</th>
                <th className="text-right py-2 px-2">Jogos</th>
                <th className="text-right py-2 px-2">V</th>
                <th className="text-right py-2 px-2">D</th>
                <th className="text-right py-2 px-2">Win%</th>
                <th className="text-right py-2 px-2">Saldo</th>
                <th className="text-right py-2 px-2">Comp.</th>
                <th className="text-right py-2 px-2">J. Ajust.</th>
                <th className="text-right py-2 px-2">Pontos</th>
                <th className="text-right py-2 pl-2">Posição</th>
              </tr>
            </thead>
            <tbody>
              {stagesSorted.map((st) => (
                <tr key={st.stage_id} className="border-b border-white/5 hover:bg-white/5" onClick={() => {}}>
                  <td className="py-2 pr-3">{st.stage_name}</td>
                  <td className="py-2 pr-3">{st.season_name}</td>
                  <td className="py-2 px-2 text-right">{st.played}</td>
                  <td className="py-2 px-2 text-right">{st.wins}</td>
                  <td className="py-2 px-2 text-right">{st.losses}</td>
                  <td className="py-2 px-2 text-right">{pct(st.win_rate)}</td>
                  <td className="py-2 px-2 text-right">{st.adjusted_games_diff}</td>
                  <td className="py-2 px-2 text-right">{Number(st.bonus_less_games ?? 0) > 0 ? `+${Number(st.bonus_less_games)}` : "—"}</td>
                  <td className="py-2 px-2 text-right">{st.adjusted_matches_played}</td>
                  <td className="py-2 px-2 text-right">{st.stage_points ?? "—"}</td>
                  <td className="py-2 pl-2 text-right">{st.stage_position ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data?.byStage?.length ? (
        <div className="mt-4">
          <StageEvolutionSvgChart byStage={data.byStage} />
        </div>
      ) : null}

      <div className="card p-4">
        <div className="text-lg font-bold mb-3">Últimos jogos</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-3">Res</th>
                <th className="text-left py-2 pr-3">Clube</th>
                <th className="text-left py-2 pr-3">Etapa</th>
                <th className="text-left py-2 pr-3">Dupla</th>
                <th className="text-left py-2 pr-3">Adversários</th>
                <th className="text-right py-2 px-2">Placar</th>
                <th className="text-left py-2 pl-2">Fim</th>
              </tr>
            </thead>
            <tbody>
              {lastMatchesSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Nenhum jogo encontrado (precisa estar com status <b>played</b>).
                  </td>
                </tr>
              ) : (
                lastMatchesSorted.map((m) => {
                  const r = resultIcon(m.result)
                  const colorClass =
                    r.kind === "win" ? "text-emerald-400" : r.kind === "loss" ? "text-rose-400" : "text-slate-300"
                  return (
                    <tr key={m.match_id} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-bold">
                        <span className="inline-flex items-center gap-2">
                          <span className={colorClass}>
                            <ResIcon kind={r.kind} />
                          </span>
                          <span>{r.label}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-3">{m.club_name ?? "—"}</td>
                      <td className="py-2 pr-3">{m.stage_name}</td>
                      <td className="py-2 pr-3">{m.team_label}</td>
                      <td className="py-2 pr-3">{m.opp_label}</td>
                      <td className="py-2 px-2 text-right">
                        {m.games_for} x {m.games_against}
                      </td>
                      <td className="py-2 pl-2">{fmtDT(m.ended_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-ghost" onClick={() => nav("/admin")}>
          Voltar
        </button>
      </div>
    </div>
  )
}