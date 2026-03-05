import { useMemo, useState } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts"

type ByStageRow = {
  stage_id: number
  stage_name: string
  stage_date: string | null
  club_name?: string | null
  stage_points: number
  stage_position: number
  wins: number
  losses: number
  played: number
  win_rate: number
  games_for: number
  games_against: number
  games_diff: number
}

type Props = {
  byStage: ByStageRow[]
}

type Metric = "points" | "win_rate" | "position"

function fmtPct(v: number) {
  if (!isFinite(v)) return "0%"
  return `${v.toFixed(1)}%`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatStageLabel(s: ByStageRow) {
  // curto e legível no eixo X
  const name = (s.stage_name ?? "").trim()
  return name.length > 18 ? name.slice(0, 18) + "…" : name
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as any
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur">
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-xs text-slate-300">
        {d.club ? `Clube: ${d.club}` : "Clube: —"}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-slate-300">Pontos</div>
        <div className="text-right font-semibold text-white">{d.points}</div>

        <div className="text-slate-300">Posição</div>
        <div className="text-right font-semibold text-white">#{d.position}</div>

        <div className="text-slate-300">Win rate</div>
        <div className="text-right font-semibold text-white">{fmtPct(d.winRate)}</div>

        <div className="text-slate-300">W–L</div>
        <div className="text-right font-semibold text-white">
          {d.wins}–{d.losses} ({d.played})
        </div>

        <div className="text-slate-300">Saldo</div>
        <div className="text-right font-semibold text-white">{d.gamesDiff}</div>
      </div>
    </div>
  )
}

export default function StageEvolutionProChart({ byStage }: Props) {
  const [metric, setMetric] = useState<Metric>("points")

  const data = useMemo(() => {
    const rows = [...(byStage ?? [])]
    // ordem: se tiver stage_date use, senão por stage_id
    rows.sort((a, b) => {
      const ad = a.stage_date ? new Date(a.stage_date).getTime() : 0
      const bd = b.stage_date ? new Date(b.stage_date).getTime() : 0
      if (ad && bd && ad !== bd) return ad - bd
      return (a.stage_id ?? 0) - (b.stage_id ?? 0)
    })

    return rows.map((s) => ({
      key: s.stage_id,
      label: formatStageLabel(s),
      fullLabel: s.stage_name,
      club: (s as any).club_name ?? null,
      points: Number(s.stage_points ?? 0),
      position: Number(s.stage_position ?? 0),
      winRate: Number(s.win_rate ?? 0),
      wins: Number(s.wins ?? 0),
      losses: Number(s.losses ?? 0),
      played: Number(s.played ?? 0),
      gamesDiff: Number(s.games_diff ?? 0),
    }))
  }, [byStage])

  const summary = useMemo(() => {
    if (!data.length) return null
    const last = data[data.length - 1]
    const avgWin = data.reduce((acc, x) => acc + x.winRate, 0) / data.length
    const bestPoints = Math.max(...data.map((x) => x.points))
    const bestWin = Math.max(...data.map((x) => x.winRate))
    return {
      last,
      avgWin,
      bestPoints,
      bestWin,
    }
  }, [data])

  const yDomain = useMemo(() => {
    if (!data.length) return [0, 10]
    if (metric === "points") {
      const max = Math.max(...data.map((x) => x.points))
      return [0, Math.max(10, max + 2)]
    }
    if (metric === "win_rate") return [0, 100]
    // position (quanto menor melhor). invertendo o eixo pra ficar “subindo = melhor”
    const maxPos = Math.max(...data.map((x) => x.position))
    return [1, Math.max(2, maxPos)]
  }, [data, metric])

  const metricLabel = metric === "points" ? "Pontos" : metric === "win_rate" ? "Win rate" : "Posição"
  const metricKey = metric === "points" ? "points" : metric === "win_rate" ? "winRate" : "position"

  const headerRight = summary ? (
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
  ) : null

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm text-slate-300">Sem dados suficientes para mostrar evolução por etapa.</div>
      </div>
    )
  }

  // Para "position", inverte eixo (menor = melhor). Recharts: reversed + formatação.
  const yAxisProps =
    metric === "position"
      ? {
          reversed: true,
          tickFormatter: (v: any) => `#${v}`,
        }
      : metric === "win_rate"
      ? {
          tickFormatter: (v: any) => `${v}%`,
        }
      : {}

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_30px_80px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-lg font-semibold text-white">Evolução por etapa</div>
          <div className="text-xs text-slate-300">
            Performance ao longo das etapas (pontos, win rate e posição). Tooltip detalhado por etapa.
          </div>

          <div className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${
                metric === "points" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setMetric("points")}
            >
              Pontos
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${
                metric === "win_rate" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setMetric("win_rate")}
            >
              Win rate
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-lg ${
                metric === "position" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setMetric("position")}
            >
              Posição
            </button>
          </div>
        </div>

        {headerRight}
      </div>

      <div className="mt-4 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.35} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(226,232,240,0.75)", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
              tickLine={false}
              interval={0}
              height={50}
            />
            <YAxis
              domain={yDomain as any}
              tick={{ fill: "rgba(226,232,240,0.75)", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
              tickLine={false}
              width={52}
              {...(yAxisProps as any)}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Linha de referência: média (para win_rate) */}
            {metric === "win_rate" && summary && (
              <ReferenceLine
                y={clamp(summary.avgWin, 0, 100)}
                stroke="rgba(255,255,255,0.25)"
                strokeDasharray="4 4"
              />
            )}

            {/* Cor controlada via wrapper: usando text-emerald-400 */}
            <g className="text-emerald-400">
              <Area
                type="monotone"
                dataKey={metricKey}
                stroke="currentColor"
                fill="url(#evoFill)"
                strokeWidth={2.6}
                dot={{ r: 3, fill: "currentColor", stroke: "rgba(15,23,42,0.9)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "currentColor", stroke: "rgba(15,23,42,0.9)", strokeWidth: 2 }}
              />
              {/* Linha extra por cima pra ficar “premium” */}
              <Line type="monotone" dataKey={metricKey} stroke="currentColor" strokeWidth={2.6} dot={false} />
            </g>

            {/* Linha secundária sutil: sempre mostra win rate “fantasma” quando métrica não é win_rate */}
            {metric !== "win_rate" && (
              <g className="text-sky-400">
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeOpacity={0.35}
                  dot={false}
                />
              </g>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div>
          <span className="font-semibold text-white">{metricLabel}</span>{" "}
          <span className="text-slate-400">•</span> clique nos botões para alternar
        </div>
        <div className="text-slate-400">Dica: passe o mouse/toque nos pontos para detalhes</div>
      </div>
    </div>
  )
}