// AthleteRounds.tsx
import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type MatchRow = {
  match_id: string
  round_id: string
  court_no: number
  slot_no: number
  status: string
  team1_label: string | null
  team2_label: string | null
  score: any
  has_pending: boolean
  stage_status?: string | null
}

type PendingRow = {
  match_id: string
  reported_by: string
  reported_name: string | null
  score: any
  created_at: string
}

function fmtScore(score: any): string {
  const s = score ?? {}
  const a = s?.games_team1
  const b = s?.games_team2
  if (typeof a === "number" && typeof b === "number") return `${a} x ${b}`
  return "-"
}

function stageStatusLabel(s?: string | null) {
  switch (s) {
    case "draft":
      return "Rascunho"
    case "scheduled":
      return "Agendada"
    case "signup_open":
      return "Inscrições abertas"
    case "signup_closed":
      return "Inscrições encerradas"
    case "running":
      return "Em andamento"
    case "finished":
      return "Finalizada"
    case "canceled":
      return "Cancelada"
    default:
      return null
  }
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export default function AthleteRounds() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [pending, setPending] = useState<PendingRow[]>([])

  const [me, setMe] = useState<string | null>(null)

  const [editing, setEditing] = useState<MatchRow | null>(null)
  const [t1, setT1] = useState<string>("")
  const [t2, setT2] = useState<string>("")

  const pendingByMatch = useMemo(() => {
    const map = new Map<string, PendingRow[]>()
    for (const p of pending) {
      const arr = map.get(p.match_id) ?? []
      arr.push(p)
      map.set(p.match_id, arr)
    }
    return map
  }, [pending])

  // UX: se a RPC devolver stage_status, mostramos mensagem amigável
  const anyStageStatus = useMemo(() => matches.some((m) => m.stage_status != null), [matches])
  const hasRunning = useMemo(() => matches.some((m) => (m.stage_status ?? "").toLowerCase() === "running"), [matches])

  // ✅ listar apenas jogos pendentes
  const pendingMatchesOnly = useMemo(() => matches.filter((m) => String(m.status) === "pending"), [matches])

  async function load(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent
    if (!silent) setLoading(true)
    else setRefreshing(true)

    setError(null)

    const { data: auth } = await supabase.auth.getUser()
    setMe(auth.user?.id ?? null)

    const resMatches = await supabase.rpc("athlete_list_my_matches", { p_round_id: null })
    if (resMatches.error) {
      setError(resMatches.error.message)
      setMatches([])
      setPending([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const resPending = await supabase.rpc("athlete_list_pending_reports", { p_round_id: null })

    setMatches((resMatches.data ?? []) as MatchRow[])
    setPending(resPending.error ? [] : ((resPending.data ?? []) as PendingRow[]))

    if (!silent) setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  function canInteractWithMatch(m: MatchRow) {
    if (m.stage_status != null) return (m.stage_status ?? "").toLowerCase() === "running"
    return true
  }

  function openReport(m: MatchRow) {
    if (!canInteractWithMatch(m)) {
      setError("A etapa ainda não está em andamento. O lançamento de placar está bloqueado.")
      return
    }

    setEditing(m)
    const s = m.score ?? {}
    setT1(typeof s?.games_team1 === "number" ? String(s.games_team1) : "")
    setT2(typeof s?.games_team2 === "number" ? String(s.games_team2) : "")
  }

  async function submitReport() {
    if (!editing) return
    if (!canInteractWithMatch(editing)) {
      setError("A etapa ainda não está em andamento. O lançamento de placar está bloqueado.")
      return
    }

    const n1 = Number(t1)
    const n2 = Number(t2)
    if (!Number.isFinite(n1) || !Number.isFinite(n2) || n1 < 0 || n2 < 0) {
      setError("Informe um placar válido (números >= 0).")
      return
    }

    setError(null)

    const { error } = await supabase.rpc("athlete_report_score", {
      p_match_id: editing.match_id,
      p_games_team1: n1,
      p_games_team2: n2,
    })

    if (error) {
      setError(error.message)
      return
    }

    setEditing(null)
    await load({ silent: true })
  }

  async function confirmScore(matchId: string, reportedBy: string, match?: MatchRow) {
    if (match && !canInteractWithMatch(match)) {
      setError("A etapa ainda não está em andamento. A confirmação de placar está bloqueada.")
      return
    }

    setError(null)

    const { error } = await supabase.rpc("athlete_confirm_score", {
      p_match_id: matchId,
      p_reported_by: reportedBy,
    })

    if (error) {
      setError(error.message)
      return
    }

    await load({ silent: true })
  }

  // ===== Indicador de progresso (micro-detalhes) =====
  const progress = useMemo(() => {
    const total = matches.length
    const played = matches.filter((m) => String(m.status).toLowerCase() === "played").length
    const pendingCount = matches.filter((m) => String(m.status).toLowerCase() === "pending").length

    // “Preciso confirmar” = existe pendência do adversário pra eu confirmar
    let needMyConfirm = 0
    // “Aguardando” = eu já enviei e estou aguardando (has_pending=true e não tenho nada pra confirmar)
    let waitingConfirm = 0

    for (const m of matches) {
      if (String(m.status).toLowerCase() !== "pending") continue
      const pend = pendingByMatch.get(m.match_id) ?? []
      const pendFromOther = me ? pend.filter((p) => p.reported_by !== me) : []
      const isNeedConfirm = pendFromOther.length > 0
      const isWaiting = Boolean(m.has_pending) && pendFromOther.length === 0

      if (isNeedConfirm) needMyConfirm += 1
      else if (isWaiting) waitingConfirm += 1
    }

    const ratio = total > 0 ? played / total : 0
    return { total, played, pendingCount, needMyConfirm, waitingConfirm, ratio }
  }, [matches, pendingByMatch, me])

  const progressPct = Math.round(clamp01(progress.ratio) * 100)

  return (
    <div className="space-y-3">
      {/* Header compacto + Atualizar + Progresso */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold">Rodada • Meus Jogos</div>

            <div className="mt-1 text-[12px] text-slate-300 leading-snug">
              Mostrando apenas jogos <b>pendentes</b>. Após enviar, fica <b>aguardando confirmação</b>.
            </div>

            {anyStageStatus && !hasRunning && (
              <div className="mt-2 text-[12px] text-amber-200 leading-snug">
                Rodada não liberada: etapa não está <b>Em andamento</b>.
              </div>
            )}

            {/* Progresso da rodada (do atleta) */}
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/70">
                  Progresso: <b className="text-white">{progress.played}</b> /{" "}
                  <b className="text-white">{progress.total}</b> finalizados{" "}
                  <span className="text-white/40">•</span>{" "}
                  <b className="text-white">{progress.pendingCount}</b> pendentes
                </div>
                <div className="text-xs font-extrabold text-white">{progressPct}%</div>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${clamp01(progress.ratio) * 100}%` }}
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/70">
                <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5">
                  Preciso confirmar: <b className="ml-1 text-white">{progress.needMyConfirm}</b>
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5">
                  Aguardando aceite: <b className="ml-1 text-white">{progress.waitingConfirm}</b>
                </span>
              </div>
            </div>
          </div>

          <button
            className="btn btn-secondary shrink-0"
            onClick={() => load({ silent: true })}
            disabled={refreshing || loading}
            title="Atualizar jogos"
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-red-500/40 bg-red-500/10">
          <b>Erro:</b> {error}
        </div>
      )}

      {loading ? (
        <div className="card text-slate-200">Carregando...</div>
      ) : pendingMatchesOnly.length === 0 ? (
        <div className="card text-slate-200">
          Nenhum jogo pendente encontrado.
          <div className="text-xs text-slate-300 mt-2">
            Se a etapa não estiver <b>Em andamento</b>, a interação pode estar bloqueada.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingMatchesOnly.map((m) => {
            const pend = pendingByMatch.get(m.match_id) ?? []
            const enabled = canInteractWithMatch(m)
            const stLabel = stageStatusLabel(m.stage_status)

            // pendências do adversário (para eu confirmar)
            const pendFromOther = me ? pend.filter((p) => p.reported_by !== me) : []

            // eu já enviei e estou aguardando
            const waitingMyReport = Boolean(m.has_pending) && pendFromOther.length === 0

            const showConfirm = pendFromOther.length > 0
            const showLaunch = !waitingMyReport && !showConfirm

            const scoreLabel = fmtScore(m.score)
            const headerRight = scoreLabel !== "-" ? scoreLabel : "—"

            return (
              <div key={m.match_id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold">
                      Quadra {m.court_no} • Ordem {m.slot_no}{" "}
                      <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold bg-white/10 text-white/80">
                        pending
                      </span>
                      {stLabel && (
                        <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25">
                          Etapa: {stLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-3">
                        <div className="text-[11px] text-white/60">Minha dupla</div>
                        <div className="font-extrabold break-words">{m.team1_label ?? "-"}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-3">
                        <div className="text-[11px] text-white/60">Adversários</div>
                        <div className="font-extrabold break-words">{m.team2_label ?? "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-xs text-white/60">Placar</div>
                    <div className="mt-1 inline-flex items-center rounded-2xl border border-white/10 bg-[#0f172a] px-3 py-1.5 text-sm font-extrabold">
                      {headerRight}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 items-end">
                      {showLaunch && (
                        <button
                          className="btn btn-primary"
                          onClick={() => openReport(m)}
                          disabled={!enabled}
                          title={!enabled ? "Etapa não está em andamento." : undefined}
                        >
                          Lançar placar
                        </button>
                      )}

                      {waitingMyReport && (
                        <button className="btn btn-secondary" disabled title="Aguardando adversário confirmar">
                          Aguardando confirmação
                        </button>
                      )}

                      {showConfirm && (
                        <button
                          // ✅ confirmar em azul (depende do CSS do .btn-confirm no index.css)
                          className="btn btn-confirm"
                          onClick={() => confirmScore(m.match_id, pendFromOther[0].reported_by, m)}
                          disabled={!enabled}
                          title={
                            !enabled
                              ? "Etapa não está em andamento."
                              : `Confirmar placar proposto por ${
                                  pendFromOther[0].reported_name ?? "adversário"
                                }: ${fmtScore(pendFromOther[0].score)}`
                          }
                        >
                          Confirmar
                        </button>
                      )}
                    </div>

                    {showConfirm && (
                      <div className="mt-2 text-[11px] text-white/60">
                        Pendente: <b>{fmtScore(pendFromOther[0].score)}</b> (por{" "}
                        {pendFromOther[0].reported_name ?? "adversário"})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: menos transparente */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">Lançar placar</div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {editing.team1_label ?? "Time 1"} vs {editing.team2_label ?? "Time 2"} • Quadra{" "}
                  {editing.court_no} • Ordem {editing.slot_no}
                </div>
              </div>

              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Fechar
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                className="input w-24"
                inputMode="numeric"
                placeholder="Time 1"
                value={t1}
                onChange={(e) => setT1(e.target.value)}
              />
              <div className="font-extrabold">x</div>
              <input
                className="input w-24"
                inputMode="numeric"
                placeholder="Time 2"
                value={t2}
                onChange={(e) => setT2(e.target.value)}
              />

              <div className="flex-1" />

              <button className="btn btn-secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={submitReport}>
                Enviar
              </button>
            </div>

            <div className="text-xs text-slate-300 mt-3">
              Ao enviar, o jogo fica <b>aguardando confirmação</b> do adversário.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}