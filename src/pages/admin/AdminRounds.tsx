import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type SeasonRow = { id: string; name: string | null }
type StageRow  = { id: number; name: string | null; club_id: string | null; courts_used: number | null; status: string | null }
type ClubRow   = { id: string; name: string | null; courts_count: number | null }
type RoundRow  = { id: string; stage_id: number; mode: string | null; courts_available: number | null; created_at: string | null }

type GroupRow = {
  id: string
  round_id: string
  label: string | null
  cat_a: string | null
  cat_b: string | null
  sort_order: number | null
  court_from: number | null
  court_to: number | null
}

type MatchRow = {
  match_id: string
  slot_no: number | null
  court_no: number | null
  status: string | null
  team1: string | null
  team2: string | null
  team1_score?: number | null
  team2_score?: number | null
  score: any | null
  updated_at: string | null
}

type PendingScoreReport = {
  report_id: number
  match_id: string
  round_id: string
  court_no: number | null
  slot_no: number | null
  match_status: string | null
  team1_label: string | null
  team2_label: string | null
  reported_by: string
  reported_name: string | null
  score: any | null
  created_at: string | null
}

type TabKey = "config" | "gen" | "online"
type CatKey = "A" | "B" | "C" | "D"

function CatSelect(props: { value: string; onChange: (v: string) => void; options?: string[]; disabled?: boolean }) {
  const opts = props.options ?? ["A", "B", "C", "D"]
  return (
    <select
      className="w-[90px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20 disabled:opacity-60"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    >
      {opts.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; label: string }) {
  const cls = props.active ? "btn-primary" : "btn-ghost"
  return (
    <button className={cls} onClick={props.onClick} type="button">
      {props.label}
    </button>
  )
}

function _scoreToString(v: any): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "number") return String(v)
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) return ""
    return s.replace(/[^\d]/g, "")
  }
  return ""
}

function readScore1(m: any): string {
  const s = m?.score ?? null
  const v =
    (s &&
      (s.team1 ??
        s.t1 ??
        s.team_1 ??
        s.team1_score ??
        s.games_team1 ??
        s.games1 ??
        s.gamesFor1)) ??
    m?.team1_score ??
    null
  return _scoreToString(v)
}

function readScore2(m: any): string {
  const s = m?.score ?? null
  const v =
    (s &&
      (s.team2 ??
        s.t2 ??
        s.team_2 ??
        s.team2_score ??
        s.games_team2 ??
        s.games2 ??
        s.gamesFor2)) ??
    m?.team2_score ??
    null
  return _scoreToString(v)
}

export default function AdminRounds() {
  const [tab, setTab] = useState<TabKey>("config")

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Print stylesheet (sem libs externas)
  useEffect(() => {
    const id = "lpi35-print-styles"
    if (document.getElementById(id)) return

    const style = document.createElement("style")
    style.id = id
    style.textContent = `
/* ===== PRINT: Folha oficial (A4) ===== */
@page { size: A4; margin: 12mm; }

.print-only { display: none; }
.screen-only { display: block; }

@media print {
  /* Mostra só a área de impressão */
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }

  .screen-only, .no-print, button, input, select, textarea { display: none !important; }

  .print-area {
    position: absolute;
    left: 0; top: 0;
    width: 100%;
  }

  .print-only { display: block !important; }

  /* Remove sombras / bordas modernas */
  .card { box-shadow: none !important; }
}

/* Componentes do PDF */
.print-sheet {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
  color: #111;
}

.print-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid #111;
  margin-bottom: 10px;
}

.print-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: .2px;
}

.print-meta {
  font-size: 11px;
  line-height: 1.25;
  text-align: right;
  white-space: nowrap;
}

.print-meta strong { font-weight: 800; }

.print-court {
  margin-top: 10px;
}

.print-court-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 0 6px 0;
  border-bottom: 1px solid #333;
}

.print-court-head h2 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 11px;
}

.print-table th, .print-table td {
  border: 1px solid #222;
  padding: 6px 6px;
  vertical-align: top;
}

.print-table th {
  background: #f1f1f1;
  font-weight: 800;
}

.print-muted {
  font-size: 10px;
  opacity: .85;
}

.print-pagebreak {
  break-after: page;
  page-break-after: always;
}
`
    document.head.appendChild(style)
  }, [])

  function handlePrint() {
    setTimeout(() => window.print(), 50)
  }

  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [stages, setStages] = useState<StageRow[]>([])
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])

  const [seasonId, setSeasonId] = useState<string>("")
  const [stageId, setStageId] = useState<number | null>(null)

  const stageStatus = useMemo(() => {
    if (!stageId) return null
    return stages.find(s => s.id === stageId)?.status ?? null
  }, [stages, stageId])

  const isStageFinished = stageStatus === "finished"
  const [roundId, setRoundId] = useState<string>("")

  // Criar Rodada
  const [createRoundMode, setCreateRoundMode] = useState<"fixed_pairs" | "americano">("fixed_pairs")
  const [createRoundLabel, setCreateRoundLabel] = useState<string>("Rodada 1")
  const [creatingRound, setCreatingRound] = useState(false)

  const [club, setClub] = useState<ClubRow | null>(null)
  const [clubCourts, setClubCourts] = useState<number | null>(null)
  const [courtsAvailable, setCourtsAvailable] = useState<number | null>(null)

  const [newCatA, setNewCatA] = useState<CatKey>("A")
  const [newCatB, setNewCatB] = useState<CatKey>("B")

  // ON-LINE
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [pendingReports, setPendingReports] = useState<any[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [courtFilter, setCourtFilter] = useState<number | null>(null)
  const [scoreDraft, setScoreDraft] = useState<Record<string, { s1: string; s2: string }>>({})

  // ===== Helpers: GEN =====
  type GenCounts = { a: number; b: number; needA: number; needB: number; pairs: number }
  const [genPairsQty, setGenPairsQty] = useState<Record<string, number>>({})
  const [genCounts, setGenCounts] = useState<Record<string, GenCounts>>({})
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({})
  const [availableCountsStageId, setAvailableCountsStageId] = useState<number | null>(null)

  type PairView = { pair_id: string; a_id: string | null; b_id: string | null; a_name: string | null; b_name: string | null }
  const [groupPairs, setGroupPairs] = useState<Record<string, PairView[]>>({})
  const [pairsLoading, setPairsLoading] = useState<Record<string, boolean>>({})

  function getPairsQty(groupId: string) {
    const v = genPairsQty[groupId]
    return (typeof v === "number" && v > 0) ? v : 6
  }

  function setPairsQty(groupId: string, v: number) {
    setGenPairsQty((prev) => ({ ...prev, [groupId]: v }))
  }

  async function countStageRosterByCategory(pStageId: number, cat: string): Promise<number> {
    const { count, error } = await supabase
      .from("stage_roster")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", pStageId)
      .eq("category", cat)

    if (error) throw error
    return count || 0
  }

  async function countPairsByGroup(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from("round_pairs")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)

    if (error) throw error
    return count || 0
  }

  async function loadPairsForGroup(groupId: string) {
    if (!roundId) return
    setPairsLoading((p) => ({ ...p, [groupId]: true }))
    try {
      const { data, error } = await supabase.rpc("admin_list_round_pairs", {
        p_round_id: roundId,
        p_group_id: groupId,
      })
      if (error) throw error

      const rows = (data || []) as any[]
      const mapped: PairView[] = rows.map((r) => {
        const aLabel = (r.a_label ?? r.a_name ?? r.p1_label ?? r.left_label ?? null)
        const bLabel = (r.b_label ?? r.b_name ?? r.p2_label ?? r.right_label ?? null)
        const aId =
          (r.a_id ?? r.a_roster_id ?? r.player1_roster_id ?? r.player1_id ?? r.p1_id ?? null) != null
            ? String(r.a_id ?? r.a_roster_id ?? r.player1_roster_id ?? r.player1_id ?? r.p1_id)
            : null
        const bId =
          (r.b_id ?? r.b_roster_id ?? r.player2_roster_id ?? r.player2_id ?? r.p2_id ?? null) != null
            ? String(r.b_id ?? r.b_roster_id ?? r.player2_roster_id ?? r.player2_id ?? r.p2_id)
            : null
        return {
          pair_id: String(r.pair_id ?? r.id ?? ""),
          a_id: aId,
          b_id: bId,
          a_name: aLabel != null ? String(aLabel) : null,
          b_name: bLabel != null ? String(bLabel) : null,
        }
      })

      setGroupPairs((prev) => ({ ...prev, [groupId]: mapped }))
    } catch (e: any) {
      console.error(e)
      alert("Erro ao listar duplas: " + (e?.message || e))
    } finally {
      setPairsLoading((p) => ({ ...p, [groupId]: false }))
    }
  }

  async function loadAvailableCountsForStage(pStageId: number): Promise<Record<string, number>> {
    if (availableCountsStageId === pStageId && Object.keys(availableCounts).length > 0) return availableCounts

    try {
      const { data, error } = await supabase
        .from("stage_roster")
        .select("category, kind")
        .eq("stage_id", pStageId)

      if (error) throw error

      const map: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
      for (const r of (data as any[]) || []) {
        const cat = String(r?.category || "").toUpperCase().trim()
        const kind = String(r?.kind || "")
        if (!cat || !Object.prototype.hasOwnProperty.call(map, cat)) continue
        if (kind !== "athlete" && kind !== "guest") continue
        map[cat] = (map[cat] || 0) + 1
      }

      setAvailableCounts(map)
      setAvailableCountsStageId(pStageId)
      return map
    } catch {
      const fallback: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
      setAvailableCounts(fallback)
      setAvailableCountsStageId(pStageId)
      return fallback
    }
  }

  async function countStageRosterAthletesByCategory(pStageId: number, cat: string): Promise<number> {
    const { count, error } = await supabase
      .from("stage_roster")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", pStageId)
      .eq("category", cat)
      .eq("kind", "athlete")

    if (error) throw error
    return count || 0
  }

  async function clearPairsForGroup(groupId: string): Promise<number> {
    if (!roundId) return 0

    const tryRpc = await supabase.rpc("admin_clear_round_pairs_for_group", { p_round_id: roundId, p_group_id: groupId })
    if (!tryRpc.error) return Number((tryRpc.data as any) ?? 0)

    const { error, count } = await supabase
      .from("round_pairs")
      .delete({ count: "exact" })
      .eq("round_id", roundId)
      .eq("group_id", groupId)

    if (error) throw error
    return count || 0
  }

  async function resetGroupGuestsToPairs(g: GroupRow) {
    if (!stageId || !roundId) { alert("Selecione etapa/rodada"); return }

    const qty = getPairsQty(g.id)
    const aCat = String(g.cat_a || "").toUpperCase().trim()
    const bCat = String(g.cat_b || "").toUpperCase().trim()
    if (!aCat || !bCat) { alert("Grupo inválido"); return }

    try {
      setLoading(true); setErr(null); setMsg(null)

      await clearPairsForGroup(g.id)

      const [aAth, bAth] = await Promise.all([
        countStageRosterAthletesByCategory(stageId, aCat),
        countStageRosterAthletesByCategory(stageId, bCat),
      ])

      const keepA = Math.max(0, qty - aAth)
      const keepB = Math.max(0, qty - bAth)

      const tA = await supabase.rpc("admin_trim_stage_guests", { p_stage_id: stageId, p_category: aCat, p_keep: keepA })
      if (tA.error) throw tA.error
      const tB = await supabase.rpc("admin_trim_stage_guests", { p_stage_id: stageId, p_category: bCat, p_keep: keepB })
      if (tB.error) throw tB.error

      await genAutofillGuestsForGroup(g)

      await refreshGenCountsForGroup(g)
      setMsg(`Grupo ${aCat}+${bCat} resetado (duplas limpas + convidados ajustados).`)
      alert("Reset do grupo concluído.")
    } catch (e: any) {
      setErr(e?.message || String(e))
      alert("Erro no reset do grupo: " + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function refreshGenCountsForGroup(g: GroupRow) {
    if (!stageId) return
    const qty = getPairsQty(g.id)
    const aCat = String(g.cat_a || "").toUpperCase().trim()
    const bCat = String(g.cat_b || "").toUpperCase().trim()
    if (!aCat || !bCat) return

    const counts = await loadAvailableCountsForStage(stageId)
    const [pairs] = await Promise.all([countPairsByGroup(g.id)])

    const a = Number(counts[aCat] ?? 0)
    const b = Number(counts[bCat] ?? 0)

    const needA = Math.max(0, qty - a)
    const needB = Math.max(0, qty - b)

    setGenCounts((prev) => ({ ...prev, [g.id]: { a, b, needA, needB, pairs } }))
  }

  async function genAutofillGuestsForGroup(g: GroupRow) {
    if (!stageId) { alert("Etapa inválida"); return }

    const qty = getPairsQty(g.id)
    const aCat = String(g.cat_a || "").toUpperCase()
    const bCat = String(g.cat_b || "").toUpperCase()
    if (!aCat || !bCat) { alert("Categorias do grupo inválidas"); return }

    setLoading(true)
    setErr(null)
    try {
      const [a, b] = await Promise.all([
        countStageRosterByCategory(stageId, aCat),
        countStageRosterByCategory(stageId, bCat),
      ])

      const needA = Math.max(0, qty - a)
      const needB = Math.max(0, qty - b)

      if (needA > 0) {
        const { error } = await supabase.rpc("admin_add_stage_roster_guests", {
          p_stage_id: stageId,
          p_category: aCat,
          p_count: needA,
        })
        if (error) throw error
      }

      if (needB > 0) {
        const { error } = await supabase.rpc("admin_add_stage_roster_guests", {
          p_stage_id: stageId,
          p_category: bCat,
          p_count: needB,
        })
        if (error) throw error
      }

      await refreshGenCountsForGroup(g)
      alert("Autofill OK. Agora você pode Sortear.")
    } catch (e: any) {
      setErr(e?.message || String(e))
      alert("Erro: " + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function genDrawFixedPairsForGroup(g: GroupRow) {
    if (!roundId) { alert("Rodada inválida"); return }

    setLoading(true)
    setErr(null)
    try {
      const tryNew = await supabase.rpc("admin_draw_fixed_pairs_for_group", {
        p_round_id: roundId,
        p_group_id: g.id,
        p_clear_existing: true,
        p_autofill_guests: false,
      })

      if (tryNew.error) {
        const tryOld = await supabase.rpc("admin_draw_fixed_pairs_for_group", {
          p_round_id: roundId,
          p_group_id: g.id,
          p_clear_existing: true,
        })
        if (tryOld.error) throw tryOld.error
      }

      await refreshGenCountsForGroup(g)
      await loadPairsForGroup(g.id)
      alert("Duplas fixas sorteadas OK.")
    } catch (e: any) {
      setErr(e?.message || String(e))
      alert("Erro: " + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function genCanGenerateGames(groupId: string): Promise<boolean> {
    const pairs = await countPairsByGroup(groupId)
    return pairs >= 2
  }

  async function genGenerateMatchesForGroup(groupId: string) {
    if (!roundId) throw new Error("Selecione uma rodada.")
    const { data, error } = await supabase.rpc("admin_generate_round_robin_matches_for_group", {
      p_round_id: roundId,
      p_group_id: groupId,
      p_clear_existing: true,
    })
    if (error) throw error
    return Number(data ?? 0)
  }

  // ===== Loads =====
  async function loadSeasons() {
    const { data, error } = await supabase
      .from("seasons")
      .select("id,name")
      .order("created_at", { ascending: false })
    if (error) throw error

    const rows = (data || []) as SeasonRow[]
    setSeasons(rows)
    if (!seasonId && rows.length > 0) setSeasonId(rows[0].id)
  }

  async function loadStages(p_seasonId: string) {
    setStages([])
    setStageId(null)
    setClub(null)
    setClubCourts(null)
    setRounds([])
    setRoundId("")
    setGroups([])
    setCourtsAvailable(null)
    setMatches([])
    setScoreDraft({})
    setCourtFilter(null)

    if (!p_seasonId) return

    const { data, error } = await supabase
      .from("stages")
      .select("id,name,club_id,courts_used,status")
      .eq("season_id", p_seasonId)
      .order("id", { ascending: false })
    if (error) throw error

    const rows = (data || []) as StageRow[]
    setStages(rows)
    if (rows.length > 0) setStageId(rows[0].id)
  }

  async function loadClub(p_clubId: string | null) {
    setClub(null)
    setClubCourts(null)
    if (!p_clubId) return

    const { data, error } = await supabase
      .from("clubs")
      .select("id,name,courts_count")
      .eq("id", p_clubId)
      .maybeSingle()

    if (error) throw error
    const row = (data || null) as ClubRow | null
    setClub(row)
    setClubCourts(row?.courts_count ?? null)
  }

  async function loadRounds(p_stageId: number) {
    setRounds([])
    setRoundId("")
    setGroups([])
    setCourtsAvailable(null)
    setMatches([])
    setScoreDraft({})
    setCourtFilter(null)

    const { data, error } = await supabase
      .from("rounds")
      .select("id,stage_id,mode,courts_available,created_at")
      .eq("stage_id", p_stageId)
      .order("created_at", { ascending: false })
    if (error) throw error

    const rows = (data || []) as RoundRow[]
    setRounds(rows)
    if (rows.length > 0) setRoundId(rows[0].id)
  }

  async function loadGroups(p_roundId: string) {
    setGroups([])
    if (!p_roundId) return

    const { data, error } = await supabase
      .from("round_groups")
      .select("id,round_id,label,cat_a,cat_b,sort_order,court_from,court_to")
      .eq("round_id", p_roundId)
      .order("sort_order", { ascending: true })
    if (error) throw error

    setGroups((data || []) as GroupRow[])
  }

  async function loadPendingReports(p_roundId: string) {
    setPendingReports([])
    if (!p_roundId) return
    setPendingLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_list_pending_score_reports", { p_round_id: p_roundId })
      if (error) throw error
      const rows = (data ?? []) as any[]
      setPendingReports(rows)

      setScoreDraft(prev => {
        const next = { ...prev }
        for (const r of rows) {
          const s: any = r?.score ?? {}
          const t1 = (typeof s?.team1 === "number") ? String(s.team1)
                   : (typeof s?.games_team1 === "number") ? String(s.games_team1)
                   : ""
          const t2 = (typeof s?.team2 === "number") ? String(s.team2)
                   : (typeof s?.games_team2 === "number") ? String(s.games_team2)
                   : ""
          if (!r?.match_id) continue
          const cur = next[r.match_id]
          if (!cur || ((cur.s1 ?? "") === "" && (cur.s2 ?? "") === "")) {
            next[r.match_id] = { s1: t1, s2: t2 }
          }
        }
        return next
      })
    } catch (e: any) {
      console.warn("admin_list_pending_score_reports:", e?.message || e)
    } finally {
      setPendingLoading(false)
    }
  }

  async function confirmPendingReport(reportId: number) {
    if (!roundId) return
    if (!confirm("Confirmar este placar e finalizar o jogo?")) return
    try {
      setPendingLoading(true)
      const { error } = await supabase.rpc("admin_confirm_score_report", { p_report_id: reportId })
      if (error) throw error
      await loadMatches(roundId)
      await loadPendingReports(roundId)
    } catch (e: any) {
      alert("Erro ao confirmar: " + (e?.message || String(e)))
    } finally {
      setPendingLoading(false)
    }
  }

  async function loadMatches(p_roundId: string) {
    setMatches([])
    setScoreDraft({})
    if (!p_roundId) return

    setMatchesLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_list_round_matches", { p_round_id: p_roundId })
      if (error) throw error

      const rows = (data || []) as MatchRow[]
      rows.sort((a, b) => {
        const ca = a.court_no ?? 0
        const cb = b.court_no ?? 0
        if (ca !== cb) return ca - cb
        const sa = a.slot_no ?? 0
        const sb = b.slot_no ?? 0
        return sa - sb
      })

      setMatches(rows)

      const init: Record<string, { s1: string; s2: string }> = {}
      for (const m of rows) {
        init[m.match_id] = { s1: String(readScore1(m) ?? ""), s2: String(readScore2(m) ?? "") }
      }
      setScoreDraft(init)

      await loadPendingReports(p_roundId)
    } finally {
      setMatchesLoading(false)
    }
  }

  async function refreshAll() {
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      await loadSeasons()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshAll() }, []) // eslint-disable-line

  useEffect(() => {
    ;(async () => {
      if (!seasonId) return
      setLoading(true); setErr(null); setMsg(null)
      try { await loadStages(seasonId) }
      catch (e: any) { setErr(e?.message || String(e)) }
      finally { setLoading(false) }
    })()
  }, [seasonId])

  useEffect(() => {
    ;(async () => {
      if (!stageId) return
      setLoading(true); setErr(null); setMsg(null)
      try {
        const st = stages.find(s => s.id === stageId) ?? null
        await loadClub(st?.club_id ?? null)
        await loadRounds(stageId)
      } catch (e: any) {
        setErr(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [stageId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ;(async () => {
      if (!roundId) return
      setLoading(true); setErr(null); setMsg(null)
      try {
        await loadGroups(roundId)
        const r = rounds.find(x => x.id === roundId) ?? null
        setCourtsAvailable(r?.courts_available ?? null)
        if (tab === "online") await loadMatches(roundId)
      } catch (e: any) {
        setErr(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [roundId, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Actions =====
  async function createRound() {
    if (stageId == null) { setErr("Selecione uma etapa para criar a rodada."); return }

    setCreatingRound(true)
    setErr(null)
    setMsg(null)

    try {
      const label = (createRoundLabel || "").trim() || "Rodada 1"
      const sortOrder = (rounds?.length ?? 0) + 1
      const mode = createRoundMode

      const { data, error } = await supabase.rpc("admin_create_round", {
        p_stage_id: stageId,
        p_sort_order: sortOrder,
        p_label: label,
        p_mode: mode,
        p_groups: [],
      })

      if (error) throw error
      const createdId = String(data)

      setMsg("Rodada criada com sucesso.")
      await loadRounds(stageId)
      setRoundId(createdId)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setCreatingRound(false)
    }
  }

  function setGroupCourt(groupId: string, field: "court_from" | "court_to", value: number | null) {
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, [field]: value } : g)))
  }

  async function saveGroupCourts(g: GroupRow) {
    setMsg(null); setErr(null)

    const { data, error } = await supabase.rpc("admin_set_round_group_courts", {
      p_group_id: g.id,
      p_court_from: g.court_from,
      p_court_to: g.court_to,
    })
    if (error) throw error
    if (data !== true) throw new Error("RPC retornou falso")

    setMsg("Salvo: " + (g.label ?? ((g.cat_a ?? "?") + "+" + (g.cat_b ?? "?"))))
    await loadGroups(roundId)
  }

  async function saveCourtsAvailable() {
    setMsg(null); setErr(null)
    if (!roundId) { setErr("Selecione uma rodada."); return }
    if (!courtsAvailable || courtsAvailable < 1) { setErr("Informe um número válido de quadras disponíveis."); return }
    if (clubCourts && courtsAvailable > clubCourts) { setErr("Não pode exceder as quadras do clube."); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_set_round_courts_available", {
        p_round_id: roundId,
        p_courts_available: courtsAvailable,
      })
      if (error) throw error
      if (data !== true) throw new Error("RPC retornou falso")

      setMsg("Quadras disponíveis na rodada atualizadas.")
      await loadRounds(stageId!)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function addGroup() {
    setMsg(null); setErr(null)
    if (!roundId) { setErr("Selecione uma rodada primeiro."); return }
    if (newCatA === newCatB) { setErr("Categorias não podem ser iguais."); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_add_round_group", {
        p_round_id: roundId,
        p_cat_a: newCatA,
        p_cat_b: newCatB,
        p_label: (newCatA + "+" + newCatB),
        p_sort_order: null,
      })
      if (error) throw error
      if (!data) throw new Error("RPC não retornou id")

      setMsg("Grupo criado: " + newCatA + "+" + newCatB)
      await loadGroups(roundId)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function removeGroup(groupId: string) {
    setMsg(null); setErr(null)
    if (!roundId) return
    if (!confirm("Remover este grupo?")) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_delete_round_group", { p_group_id: groupId })
      if (error) throw error
      if (data !== true) throw new Error("RPC retornou falso")

      setMsg("Grupo removido.")
      await loadGroups(roundId)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveMatchScore(matchId: string) {
    setErr(null); setMsg(null)
    const d = scoreDraft[matchId]
    const s1 = d?.s1?.trim()
    const s2 = d?.s2?.trim()

    if (isStageFinished) { setErr("Etapa finalizada: não é possível alterar placar."); return }
    if (!s1 || !s2) { setErr("Informe o placar dos dois lados."); return }

    const n1 = Number(s1)
    const n2 = Number(s2)
    if (!Number.isFinite(n1) || !Number.isFinite(n2)) { setErr("Placar inválido (use números)."); return }

    setMatchesLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_upsert_match_result", {
        p_match_id: matchId,
        p_team1_score: n1,
        p_team2_score: n2,
      })
      if (error) throw error
      if (data !== true) throw new Error("RPC retornou falso")

      setMsg("Placar salvo.")
      await loadMatches(roundId)
      await loadPendingReports(roundId)
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setMatchesLoading(false)
    }
  }

  // ✅ NOVO: Reordenar jogos (determinístico) — sem mudar sua tela
  const [reordering, setReordering] = useState(false)
  async function reorderMatches() {
    if (!roundId) { setErr("Selecione uma rodada."); return }

    // ✅ proteção extra: mesmo que alguém tente chamar por outro caminho, bloqueia aqui
    if (resequenceLocked) {
      setErr("Reordenação bloqueada: já existe jogo com placar lançado nesta rodada.")
      return
    }

    if (!confirm("Reordenar os jogos desta rodada agora?")) return

    setReordering(true)
    setErr(null)
    setMsg(null)
    try {
      const gapMin = 2
      const consecutiveMax = 1

      const { data, error } = await supabase.rpc("admin_resequence_round_matches", {
        p_round_id: roundId,
        p_gap_min: gapMin,
        p_consecutive_max: consecutiveMax,
      })

      if (error) throw error

      setMsg(`Reordenado OK. ${Number(data ?? 0)} jogo(s) atualizados.`)
      await loadMatches(roundId)
    } catch (e: any) {
      setErr("Erro ao reordenar: " + (e?.message || String(e)))
    } finally {
      setReordering(false)
    }
  }

  // ✅ BLOQUEIO: não permitir reordenar se já existe jogo com placar lançado
  const resequenceLocked = useMemo(() => {
    if (!matches || matches.length === 0) return false

    return matches.some((m: any) => {
      const statusPlayed = String(m?.status ?? "").toLowerCase() === "played"

      const s: any = m?.score ?? null
      const hasScore =
        !!s && (
          s.winner_side != null ||
          s.games_team1 != null ||
          s.games_team2 != null ||
          s.team1 != null ||
          s.team2 != null ||
          s.team1_score != null ||
          s.team2_score != null
        )

      const legacyScore =
        m?.team1_score != null || m?.team2_score != null

      return statusPlayed || hasScore || legacyScore
    })
  }, [matches])

  const resequenceTooltip = resequenceLocked
    ? "Reordenação bloqueada: já existe jogo com placar lançado nesta rodada."
    : "Reordena slots para evitar sequência e dupla simultânea entre quadras"

  // ===== Derived =====
  const roundMode = useMemo(() => {
    const r = rounds.find(x => x.id === roundId)
    return r?.mode ?? null
  }, [rounds, roundId])

  const courtsLimit = useMemo(() => {
    if (courtsAvailable && courtsAvailable > 0) return courtsAvailable
    const st = stages.find(s => s.id === stageId) ?? null
    return st?.courts_used ?? null
  }, [courtsAvailable, stages, stageId])

  const matchesFiltered = useMemo(() => {
    if (!courtFilter) return matches
    return matches.filter(m => (m.court_no ?? 0) === courtFilter)
  }, [matches, courtFilter])

  const matchesByCourt = useMemo(() => {
    const map: Record<string, MatchRow[]> = {}
    for (const m of matchesFiltered) {
      const k = String(m.court_no ?? 0)
      if (!map[k]) map[k] = []
      map[k].push(m)
    }
    return map
  }, [matchesFiltered])

  const courtKeys = useMemo(() => {
    return Object.keys(matchesByCourt).map(Number).filter(n => n > 0).sort((a, b) => a - b)
  }, [matchesByCourt])

  // ===== Impressão (PDF oficial): sempre imprime TODOS os jogos (ignora filtro de quadra)
  const printMatchesByCourt = useMemo(() => {
    const map: Record<string, MatchRow[]> = {}
    for (const m of matches) {
      const k = String(m.court_no ?? 0)
      if (!map[k]) map[k] = []
      map[k].push(m)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.slot_no ?? 0) - (b.slot_no ?? 0))
    }
    return map
  }, [matches])

  const printCourtKeys = useMemo(() => {
    return Object.keys(printMatchesByCourt).map(Number).filter(n => n > 0).sort((a, b) => a - b)
  }, [printMatchesByCourt])

  const printCourtCatsMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const g of groups) {
      const from = g.court_from ?? null
      const to = g.court_to ?? null
      if (!from || !to || from < 1 || to < from) continue

      const a = (g.cat_a ?? "").trim()
      const b = (g.cat_b ?? "").trim()
      const cats = a && b ? `${a}+${b}` : ((g.label ?? "").trim() || "—")

      for (let c = from; c <= to; c++) {
        map[c] = cats
      }
    }
    return map
  }, [groups])

  const selectedSeason = useMemo(() => {
    return seasons.find(s => s.id === seasonId) ?? null
  }, [seasons, seasonId])

  const selectedStage = useMemo(() => {
    return stages.find(s => s.id === stageId) ?? null
  }, [stages, stageId])

  // ===== Render =====
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl md:text-3xl font-extrabold">Rodadas</div>
          <div className="text-sm text-slate-300">Configurar, gerar e operar jogos (modo on-line)</div>
        </div>

        <button className="btn-ghost" onClick={refreshAll} disabled={loading}>
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100">
          <div className="font-semibold">Erro</div>
          <div className="text-sm opacity-90">{err}</div>
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
          <div className="font-semibold">OK</div>
          <div className="text-sm opacity-90">{msg}</div>
        </div>
      )}

      <div className="card">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-slate-300 mb-1">Temporada</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              disabled={loading}
            >
              {seasons.length === 0 ? (
                <option value="">(sem temporadas)</option>
              ) : (
                seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name ?? s.id}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-300 mb-1">Etapa</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
              value={stageId ? String(stageId) : ""}
              onChange={(e) => setStageId(e.target.value ? Number(e.target.value) : null)}
              disabled={loading || stages.length === 0}
            >
              {stages.length === 0 ? (
                <option value="">(sem etapas)</option>
              ) : (
                stages.map((st) => (
                  <option key={st.id} value={String(st.id)}>{st.name ?? ("Etapa " + st.id)}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-300 mb-1">Rodada</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              disabled={loading || rounds.length === 0}
            >
              {rounds.length === 0 ? (
                <option value="">(sem rodadas)</option>
              ) : (
                rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.mode ?? "round") + " - " + r.id.slice(0, 8)}
                  </option>
                ))
              )}
            </select>

            <div className="mt-1 text-xs text-slate-400">Modo: {roundMode ?? "-"}</div>

            {rounds.length === 0 && stageId != null && (
              <div className="mt-3 rounded-xl border border-gripoOrange/30 bg-gripoOrange/10 p-4">
                <div className="text-sm font-extrabold text-white">Criar Rodada</div>
                <div className="mt-1 text-xs text-slate-200/80">
                  Ainda não existe rodada para esta etapa. Selecione o modo e crie para liberar Configuração / Geração / On-line.
                </div>

                <div className="mt-3 flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <div className="text-xs text-slate-300 mb-1">Modo</div>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
                      value={createRoundMode}
                      onChange={(e) => setCreateRoundMode(e.target.value as any)}
                      disabled={creatingRound || loading}
                    >
                      <option value="fixed_pairs">Duplas fixas</option>
                      <option value="americano">Americano</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-slate-300 mb-1">Nome</div>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
                      value={createRoundLabel}
                      onChange={(e) => setCreateRoundLabel(e.target.value)}
                      placeholder="ex: Rodada 1"
                      disabled={creatingRound || loading}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={createRound}
                    disabled={creatingRound || loading}
                    title="Cria a rodada para esta etapa"
                  >
                    {creatingRound ? "Criando..." : "Criar Rodada"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-slate-300">Quadras</div>
            <div className="mt-1 text-sm text-slate-200">
              Clube: <span className="font-semibold">{club?.name ?? "-"}</span>
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Total clube: <span className="font-semibold">{clubCourts ?? "-"}</span>
            </div>
            <div className="mt-1 text-sm text-slate-200">
              Disponíveis (rodada): <span className="font-semibold">{courtsAvailable ?? "-"}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Limite atual (grupos): {courtsLimit ?? "-"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "config"} onClick={() => setTab("config")} label="Configuração" />
        <TabButton active={tab === "gen"} onClick={() => setTab("gen")} label="Geração" />
        <TabButton active={tab === "online"} onClick={() => setTab("online")} label="On-line" />
      </div>

      {/* CONFIG */}
      {tab === "config" && (
        <div className="card space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 no-print">
              <div>
                <div className="font-extrabold">Quadras disponíveis (no dia)</div>
                <div className="text-xs text-slate-400">
                  Clube tem {clubCourts ?? "?"} quadras no total. Aqui você define quantas estarão liberadas.
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <div className="text-xs text-slate-300 mb-1">Disponíveis</div>
                  <input
                    className="w-[140px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                    value={courtsAvailable ?? ""}
                    onChange={(e) => setCourtsAvailable(e.target.value ? Number(e.target.value) : null)}
                    inputMode="numeric"
                    disabled={loading || !roundId}
                  />
                </div>

                <button className="btn-primary" onClick={saveCourtsAvailable} disabled={loading || !roundId}>
                  Salvar quadras
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <div className="font-extrabold">Adicionar Grupo</div>
                <div className="text-xs text-slate-400">Escolha o cruzamento (ex.: A+C / B+D)</div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <div className="text-xs text-slate-300 mb-1">Cat A</div>
                  <CatSelect value={newCatA} onChange={setNewCatA} disabled={loading || !roundId} />
                </div>

                <div>
                  <div className="text-xs text-slate-300 mb-1">Cat B</div>
                  <CatSelect value={newCatB} onChange={setNewCatB} disabled={loading || !roundId} />
                </div>

                <button className="btn-primary" onClick={addGroup} disabled={loading || !roundId}>
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              Nenhum grupo encontrado para esta rodada. Use "Adicionar Grupo".
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="font-extrabold">
                        {g.label ?? ((g.cat_a ?? "?") + "+" + (g.cat_b ?? "?"))}
                      </div>
                      <div className="text-xs text-slate-400">
                        sort_order: {g.sort_order ?? "-"} | group_id: <span className="font-mono">{g.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <div className="text-xs text-slate-300 mb-1">Quadra de</div>
                        <input
                          className="w-[120px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                          value={g.court_from ?? ""}
                          onChange={(e) => setGroupCourt(g.id, "court_from", e.target.value ? Number(e.target.value) : null)}
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <div className="text-xs text-slate-300 mb-1">até</div>
                        <input
                          className="w-[120px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                          value={g.court_to ?? ""}
                          onChange={(e) => setGroupCourt(g.id, "court_to", e.target.value ? Number(e.target.value) : null)}
                          inputMode="numeric"
                        />
                      </div>

                      <button
                        className="btn-primary"
                        onClick={async () => {
                          setLoading(true)
                          try { await saveGroupCourts(g) }
                          catch (e: any) { setErr(e?.message || String(e)) }
                          finally { setLoading(false) }
                        }}
                        disabled={loading}
                      >
                        Salvar
                      </button>

                      <button className="btn-ghost" onClick={() => removeGroup(g.id)} disabled={loading}>
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GEN */}
      {tab === "gen" && (
        <div className="card space-y-4">
          <div>
            <div className="text-lg font-extrabold">Geração</div>
            <div className="text-sm text-slate-300">
              Operar grupo a grupo. Defina Qtd duplas, use Autofill convidados se faltar gente, depois Sortear e por fim Gerar jogos.
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              Nenhum grupo encontrado. Vá na aba Configuração e crie os grupos.
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const qty = getPairsQty(g.id)
                const c = genCounts[g.id]
                const aCat = String(g.cat_a || "?").toUpperCase()
                const bCat = String(g.cat_b || "?").toUpperCase()
                const label = g.label ?? (aCat + "+" + bCat)

                const courtsTxt = (g.court_from && g.court_to) ? `${g.court_from}-${g.court_to}` : "-"

                const a = c?.a ?? 0
                const b = c?.b ?? 0
                const needA = c?.needA ?? Math.max(0, qty - a)
                const needB = c?.needB ?? Math.max(0, qty - b)
                const pairs = c?.pairs ?? 0

                return (
                  <div key={g.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="text-xl font-extrabold">{label}</div>
                        <div className="text-xs text-slate-400">
                          group_id: <span className="font-mono">{String(g.id).slice(0, 8)}</span>{" "}
                          | Courts: <span className="font-mono">{courtsTxt}</span>
                        </div>

                        <div className="mt-2 text-sm text-slate-200">
                          <span className="font-semibold">{aCat}</span>: {a} &nbsp;/&nbsp;
                          <span className="font-semibold">{bCat}</span>: {b} &nbsp;|&nbsp;
                          faltam: {needA + needB} ( {aCat}:{needA} / {bCat}:{needB} )
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          duplas existentes no grupo: <span className="font-semibold">{pairs}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 min-w-[320px]">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <div className="text-xs text-slate-300 mb-1">Qtd duplas</div>
                            <input
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                              value={qty}
                              onChange={(e) => setPairsQty(g.id, e.target.value ? Number(e.target.value) : 6)}
                              inputMode="numeric"
                              disabled={loading || !roundId}
                            />
                          </div>

                          <button
                            className="btn-ghost"
                            onClick={() => refreshGenCountsForGroup(g)}
                            disabled={loading || !roundId || !stageId}
                            title="Recalcular contadores"
                          >
                            Recalcular
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn-primary"
                            onClick={() => genAutofillGuestsForGroup(g)}
                            disabled={loading || !roundId || !stageId}
                          >
                            Autofill convidados
                          </button>

                          <button
                            className="btn-primary"
                            onClick={() => genDrawFixedPairsForGroup(g)}
                            disabled={loading || !roundId}
                            title="Sorteia duplas fixas (limpa duplas antigas do grupo)"
                          >
                            Sortear
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => loadPairsForGroup(g.id)}
                            disabled={loading || !roundId || pairsLoading[g.id]}
                            title="Carrega e mostra as duplas sorteadas do grupo"
                          >
                            {pairsLoading[g.id] ? "Carregando..." : "Ver duplas"}
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={async () => {
                              try {
                                setLoading(true)
                                setErr(null); setMsg(null)
                                await clearPairsForGroup(g.id)
                                await refreshGenCountsForGroup(g)
                                setMsg(`Duplas do grupo ${label} limpas.`)
                              } catch (e: any) {
                                setErr(e?.message || String(e))
                                alert("Erro ao limpar duplas do grupo: " + (e?.message || String(e)))
                              } finally {
                                setLoading(false)
                              }
                            }}
                            disabled={loading || !roundId}
                            title="Apaga apenas as duplas (round_pairs) deste grupo, mantendo roster e rodada."
                          >
                            Limpar duplas
                          </button>

                          <button
                            className="btn-ghost"
                            onClick={() => resetGroupGuestsToPairs(g)}
                            disabled={loading || !roundId || !stageId}
                            title="Limpa duplas do grupo e ajusta convidados excedentes para bater com a Qtd duplas (preserva atletas)."
                          >
                            Reset grupo
                          </button>

                          <button
                            className="btn-primary"
                            onClick={async () => {
                              try {
                                setLoading(true)
                                setErr(null)

                                const ok = await genCanGenerateGames(g.id)
                                if (!ok) {
                                  alert("Gere as duplas primeiro (mínimo 2 duplas no grupo).")
                                  return
                                }

                                await genGenerateMatchesForGroup(g.id)
                                alert("Jogos gerados OK.")
                              } catch (e: any) {
                                setErr(e?.message || String(e))
                                alert("Erro: " + (e?.message || String(e)))
                              } finally {
                                setLoading(false)
                              }
                            }}
                            disabled={loading || !roundId}
                            title="Gera jogos todas-vs-todas para as duplas do grupo"
                          >
                            Gerar jogos
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Nota: "Gerar jogos" usa RPC <span className="font-mono">admin_generate_round_robin_matches_for_group</span>.
                        </div>

                        {groupPairs[g.id] && groupPairs[g.id].length > 0 && (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="text-sm font-semibold mb-2">Duplas sorteadas</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {groupPairs[g.id].map((p, idx) => {
                                const left = p.a_name || (p.a_id ? p.a_id.slice(0, 8) : "—")
                                const right = p.b_name || (p.b_id ? p.b_id.slice(0, 8) : "—")
                                return (
                                  <div key={p.pair_id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                    <div className="text-xs text-slate-400">Dupla #{idx + 1}</div>
                                    <div className="font-semibold">{left} <span className="text-slate-400">+</span> {right}</div>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                              Se ficou errado, clique em <span className="font-semibold">Sortear</span> novamente para re-sortear (as duplas antigas do grupo serão limpas).
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ONLINE */}
      {tab === "online" && (
        <div className="card space-y-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold">Lançamento de Resultados (On-line)</div>
              <div className="text-sm text-slate-300">
                Informe o placar e clique em <span className="font-semibold">Salvar & Finalizar</span>.
                Se precisar corrigir, edite e salve novamente.
              </div>
            </div>

            {isStageFinished && (
              <div className="mb-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
                <b>Etapa finalizada.</b> Placar e status dos jogos estão bloqueados.
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <div className="text-xs text-slate-300 mb-1">Filtrar quadra</div>
                <input
                  className="w-[140px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                  value={courtFilter ?? ""}
                  onChange={(e) => setCourtFilter(e.target.value ? Number(e.target.value) : null)}
                  inputMode="numeric"
                  placeholder="ex: 1"
                />
              </div>

              <button className="btn-primary" onClick={() => loadMatches(roundId)} disabled={matchesLoading || !roundId}>
                {matchesLoading ? "Atualizando..." : "Atualizar jogos"}
              </button>

              <button
                type="button"
                className="btn no-print"
                onClick={handlePrint}
                disabled={matchesLoading || matches.length === 0}
                title="Imprimir folha para anotar na caneta"
              >
                🖨️ PDF oficial
              </button>

              {/* ✅ Botão novo (bloqueia se já existe placar lançado) */}
              <span className="no-print" title={resequenceTooltip}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={reorderMatches}
                  disabled={!roundId || matchesLoading || reordering || resequenceLocked}
                >
                  {reordering ? "Reordenando..." : "Reordenar jogos"}
                </button>
              </span>
            </div>
          </div>

          {/* Placar pendente (atletas) */}
          {pendingReports.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold">Placar pendente de confirmação</div>
                  <div className="text-sm text-slate-300">
                    Atletas podem lançar o placar. Use <b>Confirmar</b> para aplicar no jogo (útil quando há convidados).
                  </div>
                </div>
                <div className="text-xs text-slate-400">{pendingLoading ? "Atualizando..." : `${pendingReports.length} pendente(s)`}</div>
              </div>

              <div className="mt-3 space-y-2">
                {pendingReports.map((r: PendingScoreReport) => {
                  const s: any = r.score ?? {}
                  const t1 = typeof s?.team1 === "number" ? s.team1 : (typeof s?.games_team1 === "number" ? s.games_team1 : "")
                  const t2 = typeof s?.team2 === "number" ? s.team2 : (typeof s?.games_team2 === "number" ? s.games_team2 : "")
                  const placar = (t1 !== "" && t2 !== "") ? `${t1} x ${t2}` : "—"
                  const title = `${r.team1_label ?? "Time 1"} x ${r.team2_label ?? "Time 2"}`
                  return (
                    <div key={r.report_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="text-sm text-slate-400">
                            Quadra {r.court_no ?? "—"} • Slot {r.slot_no ?? "—"} • {new Date(r.created_at ?? Date.now()).toLocaleString("pt-BR")}
                          </div>
                          <div className="mt-1 font-extrabold">{title}</div>
                          <div className="mt-1 text-sm text-slate-200">
                            <span className="text-slate-400">Reportado por:</span> {r.reported_name ?? r.reported_by.slice(0, 8)} • <span className="text-slate-400">Placar:</span>{" "}
                            <span className="font-extrabold">{placar}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="btn-primary"
                            onClick={() => confirmPendingReport(r.report_id)}
                            disabled={pendingLoading || isStageFinished}
                            title={isStageFinished ? "Etapa finalizada (bloqueado)" : "Aplicar placar e finalizar"}
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PRINT (PDF oficial) */}
          <div className="print-area print-only">
            <div className="print-sheet">
              <div className="print-header">
                <div>
                  <div className="print-title">LPI35++ — Ficha Oficial de Jogos</div>
                </div>
                <div className="print-meta">
                  <div><strong>Temporada:</strong> {selectedSeason?.name ?? "—"}</div>
                  <div><strong>Etapa:</strong> {selectedStage?.name ?? "—"}</div>
                  <div><strong>Clube:</strong> {club?.name ?? "—"}</div>
                  <div><strong>Gerado:</strong> {new Date().toLocaleString("pt-BR")}</div>
                </div>
              </div>

              {printCourtKeys.length === 0 ? (
                <div className="print-muted">Nenhum jogo para imprimir.</div>
              ) : (
                printCourtKeys.map((courtNo, idx) => (
                  <div
                    key={courtNo}
                    className={"print-court " + (idx < printCourtKeys.length - 1 ? "print-pagebreak" : "")}
                  >
                    <div className="print-court-head">
                      <h2>Quadra {courtNo}{printCourtCatsMap[courtNo] ? ` — ${printCourtCatsMap[courtNo]}` : ""}</h2>
                    </div>

                    <table className="print-table">
                      <thead>
                        <tr>
                          <th style={{ width: 54, textAlign: "center" }}>Slot</th>
                          <th>Time 1</th>
                          <th>Time 2</th>
                          <th style={{ width: 200, textAlign: "center" }}>Placar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(printMatchesByCourt[String(courtNo)] ?? []).map((m) => (
                          <tr key={m.match_id}>
                            <td style={{ textAlign: "center" }}>{m.slot_no ?? ""}</td>
                            <td>{m.team1 ?? "—"}</td>
                            <td>{m.team2 ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className="font-extrabold">x</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              Nenhum jogo encontrado para esta rodada.
            </div>
          ) : (
            <div className="space-y-4">
              {courtKeys.map((courtNo) => (
                <div key={courtNo} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-extrabold">Quadra {courtNo}</div>
                    <div className="text-xs text-slate-400">
                      {matchesByCourt[String(courtNo)]?.length ?? 0} jogo(s)
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {(matchesByCourt[String(courtNo)] || []).map((m) => {
                      const draft = scoreDraft[m.match_id] || { s1: "", s2: "" }
                      const isPlayed = (m.status || "").toLowerCase() === "played"
                      return (
                        <div key={m.match_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                              <div className="text-sm text-slate-400">
                                Slot {m.slot_no ?? "-"} • Status: <span className="font-semibold">{m.status ?? "-"}</span>
                              </div>
                              <div className="mt-1 text-base font-extrabold">
                                {(m.team1 ?? "Time 1")} <span className="text-slate-400">x</span> {(m.team2 ?? "Time 2")}
                              </div>
                              {isPlayed && (
                                <div className="mt-1 text-xs text-emerald-200">
                                  (Pode editar o placar e salvar novamente)
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-end gap-2">
                              <div>
                                <div className="text-xs text-slate-300 mb-1">Time 1</div>
                                <input
                                  className="w-[90px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                                  value={draft.s1}
                                  onChange={(e) => setScoreDraft(prev => ({ ...prev, [m.match_id]: { s1: e.target.value, s2: draft.s2 } }))}
                                  inputMode="numeric"
                                  disabled={matchesLoading || isStageFinished}
                                />
                              </div>

                              <div>
                                <div className="text-xs text-slate-300 mb-1">Time 2</div>
                                <input
                                  className="w-[90px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                                  value={draft.s2}
                                  onChange={(e) => setScoreDraft(prev => ({ ...prev, [m.match_id]: { s1: draft.s1, s2: e.target.value } }))}
                                  inputMode="numeric"
                                  disabled={matchesLoading || isStageFinished}
                                />
                              </div>

                              <button
                                className="btn-primary"
                                onClick={() => saveMatchScore(m.match_id)}
                                disabled={matchesLoading || isStageFinished}
                              >
                                {isPlayed ? "Salvar (editar)" : "Salvar & Finalizar"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}