import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type AthleteRow = {
  id: string
  nome: string | null
  category: "A" | "B" | "C" | "D" | null
}

type BucketKey = "A" | "B" | "C" | "D" | "SEM"

function badgeColor(k: BucketKey) {
  switch (k) {
    case "A":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
    case "B":
      return "border-sky-400/30 bg-sky-500/10 text-sky-100"
    case "C":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100"
    case "D":
      return "border-violet-400/30 bg-violet-500/10 text-violet-100"
    default:
      return "border-white/10 bg-white/5 text-slate-100"
  }
}

type LiveStageRow = {
  id: number
  name: string | null
  status: string | null
  season_id: string | null
  stage_date: string | null
}

type LiveRoundRow = {
  id: string
  stage_id: number
  created_at: string | null
  mode: string | null
}

type LiveMatchRow = {
  match_id: string
  round_id: string
  court_no: number | null
  slot_no: number | null
  status: string | null
  team1_label: string | null
  team2_label: string | null
  score: any | null
}

function fmtDT(s: string | null) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleString("pt-BR")
  } catch {
    return s
  }
}

function fmtDate(s: string | null) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString("pt-BR")
  } catch {
    return s
  }
}

function readScore1(m: any): string {
  const s = m?.score ?? null
  const v =
    (s && (s.games_team1 ?? s.team1 ?? s.t1 ?? s.team1_score ?? null)) ?? (m?.team1_score ?? null)
  if (v === null || v === undefined) return ""
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : String(v).replace(/[^\d]/g, "")
}

function readScore2(m: any): string {
  const s = m?.score ?? null
  const v =
    (s && (s.games_team2 ?? s.team2 ?? s.t2 ?? s.team2_score ?? null)) ?? (m?.team2_score ?? null)
  if (v === null || v === undefined) return ""
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : String(v).replace(/[^\d]/g, "")
}

function statusTone(status: string | null) {
  const s = String(status ?? "").toLowerCase()
  if (s === "played") return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
  if (s === "pending") return "text-amber-200 bg-amber-500/10 border-amber-500/20"
  if (s === "canceled") return "text-rose-200 bg-rose-500/10 border-rose-500/20"
  if (s === "confirming") return "text-sky-200 bg-sky-500/10 border-sky-500/20"
  return "text-white/80 bg-white/5 border-white/10"
}

function stageIsRunning(s: string | null) {
  return String(s ?? "").toLowerCase() === "running"
}

function isPlayed(m: LiveMatchRow) {
  return String(m.status ?? "").toLowerCase() === "played"
}

export default function AdminDashboard() {
  // =========================
  //  Dashboard (athletes)
  // =========================
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [athletes, setAthletes] = useState<AthleteRow[]>([])
  const [q, setQ] = useState("")

  async function loadAthletes() {
    setLoading(true)
    setErr(null)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,category")
        .eq("approved", true)
        .is("rejected_at", null)

      if (error) throw error

      const rows: AthleteRow[] = (data || []).map((r: any) => ({
        id: String(r.id),
        nome: r.nome ?? null,
        category: r.category ?? null,
      }))

      rows.sort((a, b) => {
        const an = (a.nome || "").trim()
        const bn = (b.nome || "").trim()
        if (!an && !bn) return 0
        if (!an) return 1
        if (!bn) return -1
        return an.localeCompare(bn, "pt-BR", { sensitivity: "base" })
      })

      setAthletes(rows)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAthletes()
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return athletes
    return athletes.filter((a) => (a.nome || "").toLowerCase().includes(s))
  }, [athletes, q])

  const buckets = useMemo(() => {
    const out: Record<BucketKey, AthleteRow[]> = { A: [], B: [], C: [], D: [], SEM: [] }
    for (const a of filtered) {
      const k: BucketKey =
        a.category === "A"
          ? "A"
          : a.category === "B"
          ? "B"
          : a.category === "C"
          ? "C"
          : a.category === "D"
          ? "D"
          : "SEM"
      out[k].push(a)
    }
    return out
  }, [filtered])

  const total = filtered.length

  // =========================
  //  Rodada ao Vivo (admin)
  // =========================
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveErr, setLiveErr] = useState<string | null>(null)

  const [liveStage, setLiveStage] = useState<LiveStageRow | null>(null)
  const [liveRound, setLiveRound] = useState<LiveRoundRow | null>(null)
  const [liveMatches, setLiveMatches] = useState<LiveMatchRow[]>([])
  const [liveRefreshing, setLiveRefreshing] = useState(false)

  async function loadLive(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent
    if (!silent) setLiveLoading(true)
    else setLiveRefreshing(true)

    setLiveErr(null)

    try {
      // 1) preferir etapa running
      const stRes = await supabase
        .from("stages")
        .select("id,name,status,season_id,stage_date")
        .order("id", { ascending: false })
        .limit(30)

      if (stRes.error) throw stRes.error

      const stages = (stRes.data ?? []) as any[]
      const running = stages.find((x) => String(x.status ?? "").toLowerCase() === "running") ?? null
      const chosen = running as any

      // ✅ se não tem running, some Rodada ao Vivo
      if (!chosen?.id) {
        setLiveStage(null)
        setLiveRound(null)
        setLiveMatches([])
        return
      }

      const st: LiveStageRow = {
        id: Number(chosen.id),
        name: chosen.name ?? null,
        status: chosen.status ?? null,
        season_id: chosen.season_id ?? null,
        stage_date: chosen.stage_date ?? null,
      }
      setLiveStage(st)

      // 2) última rodada da etapa running
      const rRes = await supabase
        .from("rounds")
        .select("id,stage_id,created_at,mode")
        .eq("stage_id", st.id)
        .order("created_at", { ascending: false })
        .limit(1)

      if (rRes.error) throw rRes.error

      const r0 = (rRes.data?.[0] ?? null) as any
      if (!r0?.id) {
        setLiveRound(null)
        setLiveMatches([])
        return
      }

      const rr: LiveRoundRow = {
        id: String(r0.id),
        stage_id: Number(r0.stage_id),
        created_at: r0.created_at ?? null,
        mode: r0.mode ?? null,
      }
      setLiveRound(rr)

      // 3) matches via RPC
      const { data, error } = await supabase.rpc("admin_list_round_matches", { p_round_id: rr.id })
      if (error) throw error

      const rows = (data ?? []) as any[]
      const mapped: LiveMatchRow[] = rows.map((m) => ({
        match_id: String(m.match_id ?? m.id),
        round_id: String(m.round_id ?? rr.id),
        court_no: m.court_no ?? null,
        slot_no: m.slot_no ?? null,
        status: m.status ?? null,
        team1_label: m.team1_label ?? m.team1 ?? null,
        team2_label: m.team2_label ?? m.team2 ?? null,
        score: m.score ?? null,
      }))

      mapped.sort((a, b) => {
        const ca = a.court_no ?? 0
        const cb = b.court_no ?? 0
        if (ca !== cb) return ca - cb
        const sa = a.slot_no ?? 0
        const sb = b.slot_no ?? 0
        return sa - sb
      })

      setLiveMatches(mapped)
    } catch (e: any) {
      setLiveErr(e?.message || String(e))
      setLiveStage(null)
      setLiveRound(null)
      setLiveMatches([])
    } finally {
      if (!silent) setLiveLoading(false)
      setLiveRefreshing(false)
    }
  }

  useEffect(() => {
    void loadLive()
  }, [])

  // realtime: se mexer em matches, refresh silencioso
  useEffect(() => {
    if (!liveRound?.id) return

    let t: any = null
    const ch = supabase
      .channel(`admin-dashboard-live-round:${liveRound.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        if (t) clearTimeout(t)
        t = setTimeout(() => loadLive({ silent: true }), 250)
      })
      .subscribe()

    return () => {
      if (t) clearTimeout(t)
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRound?.id])

  // progresso (conta played no total real)
  const livePlayed = useMemo(() => liveMatches.filter((m) => isPlayed(m)).length, [liveMatches])
  const liveTotal = liveMatches.length
  const livePct = useMemo(() => {
    if (!liveTotal) return 0
    return Math.max(0, Math.min(100, Math.round((livePlayed / liveTotal) * 100)))
  }, [livePlayed, liveTotal])

  // ✅ você pediu: mostrar só NÃO-played
  const liveMatchesNotPlayed = useMemo(() => liveMatches.filter((m) => !isPlayed(m)), [liveMatches])

  // ✅ se tudo já foi played, consideramos "rodada finalizada" e não mostramos o live
  const liveAllPlayed = useMemo(() => liveTotal > 0 && livePlayed === liveTotal, [livePlayed, liveTotal])

  const matchesByCourtNotPlayed = useMemo(() => {
    const map: Record<string, LiveMatchRow[]> = {}
    for (const m of liveMatchesNotPlayed) {
      const k = String(m.court_no ?? 0)
      if (!map[k]) map[k] = []
      map[k].push(m)
    }
    // garante ordenação por slot em cada quadra
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.slot_no ?? 0) - (b.slot_no ?? 0))
    }
    return map
  }, [liveMatchesNotPlayed])

  const courtKeys = useMemo(() => {
    return Object.keys(matchesByCourtNotPlayed)
      .map(Number)
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
  }, [matchesByCourtNotPlayed])

  // helper: janela (atual + próximos 2)
  function windowForCourt(arr: LiveMatchRow[]) {
    if (!arr.length) return { current: null as LiveMatchRow | null, window: [] as LiveMatchRow[] }
    const current = arr[0] // primeiro não-played por slot_no
    const window = arr.slice(0, 3)
    return { current, window }
  }

  // =========================
  //  Render
  // =========================
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl md:text-3xl font-extrabold">Dashboard</div>
          <div className="text-sm text-slate-300">Visão geral do ambiente DEV</div>
        </div>

        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() => loadLive({ silent: true })}
            disabled={liveRefreshing || liveLoading}
          >
            {liveRefreshing ? "Rodada..." : "Rodada ao vivo"}
          </button>

          <button className="btn-ghost" onClick={loadAthletes} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
          <div className="font-semibold">Erro</div>
          <div className="text-sm opacity-90">{err}</div>
        </div>
      )}

      {/* ========================= */}
      {/*  Rodada ao Vivo (NOVO)    */}
      {/* ========================= */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Rodada ao Vivo</div>
            <div className="text-xs text-slate-300 mt-1">
              Acompanha a última rodada da etapa <b>running</b> e atualiza automaticamente quando mudar placar/status.
            </div>
          </div>

          <button
            className="btn-ghost"
            onClick={() => loadLive({ silent: true })}
            disabled={liveRefreshing || liveLoading}
            title="Atualizar rodada ao vivo"
          >
            {liveRefreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {liveErr && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100">
            <div className="font-semibold">Erro (Rodada ao Vivo)</div>
            <div className="text-sm opacity-90">{liveErr}</div>
          </div>
        )}

        {liveLoading ? (
          <div className="mt-3 text-slate-200">Carregando rodada ao vivo...</div>
        ) : !liveStage ? (
          <div className="mt-3 text-slate-200">
            Nenhuma etapa <b>running</b> no momento.
          </div>
        ) : !stageIsRunning(liveStage.status) ? (
          <div className="mt-3 text-slate-200">
            Etapa não está <b>running</b>. Rodada ao vivo ocultada.
          </div>
        ) : !liveRound ? (
          <div className="mt-3 text-slate-200">
            Etapa: <b>{liveStage.name ?? `Etapa ${liveStage.id}`}</b> • Status:{" "}
            <b>{String(liveStage.status ?? "—").toLowerCase()}</b>
            <div className="text-xs text-slate-300 mt-1">Não há rodadas nessa etapa.</div>
          </div>
        ) : liveMatches.length === 0 ? (
          <div className="mt-3 text-slate-200">Nenhum jogo encontrado nessa rodada.</div>
        ) : liveAllPlayed ? (
          <div className="mt-3 text-slate-200">
            Rodada finalizada (todos os jogos estão <b>played</b>). Rodada ao vivo ocultada.
          </div>
        ) : liveMatchesNotPlayed.length === 0 ? (
          <div className="mt-3 text-slate-200">
            Não há jogos pendentes nesta rodada.
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-slate-300">Etapa</div>
                <div className="text-base font-extrabold mt-1">
                  {liveStage.name ?? `Etapa ${liveStage.id}`}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Data: <b>{fmtDate(liveStage.stage_date)}</b>
                </div>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                    running
                  </span>

                  <span className="text-xs text-slate-300">
                    Rodada: <b>{liveRound.id.slice(0, 8)}</b>
                  </span>
                </div>
              </div>

              <div className="md:col-span-7 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-300">Progresso</div>
                    <div className="text-lg font-extrabold mt-1">
                      {livePlayed} / {liveTotal} jogos finalizados
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Atualização: <b>realtime</b> • Última rodada em {fmtDT(liveRound.created_at)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-300">%</div>
                    <div className="text-2xl font-extrabold">{livePct}%</div>
                  </div>
                </div>

                <div className="mt-3 h-3 w-full rounded-full bg-black/30 border border-white/10 overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${livePct}%` }} />
                </div>
              </div>
            </div>

            {/* Quadras - janela (atual + próximos 2) + marcador AGORA */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {courtKeys.map((courtNo) => {
                const list = matchesByCourtNotPlayed[String(courtNo)] ?? []
                const { current, window } = windowForCourt(list)

                return (
                  <div key={courtNo} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-base font-extrabold">Quadra {courtNo}</div>
                      <div className="text-xs text-slate-300">
                        {list.length} pendente(s)
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {window.map((m) => {
                        const s1 = readScore1(m)
                        const s2 = readScore2(m)
                        const score = s1 !== "" && s2 !== "" ? `${s1} x ${s2}` : "—"

                        const st = String(m.status ?? "—").toLowerCase()
                        const tone = statusTone(m.status)

                        const isCurrent = current?.match_id === m.match_id

                        return (
                          <div
                            key={m.match_id}
                            className={
                              "rounded-2xl border bg-[#0f172a] p-3 " +
                              (isCurrent ? "border-orange-500/30 ring-1 ring-orange-500/20" : "border-white/10")
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs text-white/60">
                                  <span>
                                    Slot <b>{m.slot_no ?? "—"}</b>
                                  </span>

                                  {/* ✅ mini marcador do jogo atual */}
                                  {isCurrent && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold border border-orange-500/25 bg-orange-500/10 text-orange-200">
                                      AGORA
                                    </span>
                                  )}
                                </div>

                                <div className="mt-1 text-sm font-extrabold truncate">
                                  {m.team1_label ?? "Time 1"} <span className="text-white/50">x</span>{" "}
                                  {m.team2_label ?? "Time 2"}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div
                                  className={
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border " +
                                    tone
                                  }
                                >
                                  {st}
                                </div>
                                <div className="mt-1 text-sm font-extrabold">{score}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {list.length > 3 && (
                        <div className="text-[11px] text-white/50 pt-1">
                          + {list.length - 3} jogo(s) na fila…
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================= */}
      {/*  Atletas aprovados        */}
      {/* ========================= */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-slate-300">Jogadores aprovados</div>
            <div className="text-2xl font-extrabold">{total}</div>
          </div>

          <div className="w-full md:w-[420px]">
            <div className="text-xs text-slate-300 mb-1">Filtrar por nome</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite para filtrar..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(["A", "B", "C", "D", "SEM"] as BucketKey[]).map((k) => (
          <div key={k} className="card">
            <div className="flex items-center justify-between">
              <div className="text-lg font-extrabold">
                {k === "SEM" ? "Sem categoria" : "Categoria " + k}
              </div>
              <div className={"text-xs px-2 py-1 rounded-lg border " + badgeColor(k)}>
                {buckets[k].length}
              </div>
            </div>

            <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
              {buckets[k].length === 0 ? (
                <div className="text-sm text-slate-300">Nenhum atleta.</div>
              ) : (
                buckets[k].map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    title={a.id}
                  >
                    <div className="font-semibold">
                      {a.nome && a.nome.trim() ? a.nome : "(sem nome)"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}