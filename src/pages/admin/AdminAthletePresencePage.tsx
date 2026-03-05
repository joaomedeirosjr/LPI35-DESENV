import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type SeasonRow = { id: string; name: string | null; created_at?: string | null }
type StageRow = {
  id: number
  season_id: string
  name: string | null
  status: string | null
  stage_date: string | null
  club_id: string | null
}
type ClubRow = { id: string; name: string | null }

type PresenceRow = {
  id: number
  stage_id: number
  athlete_id: string
  going: boolean | null
  responded_at: string | null
  updated_at: string | null
}

function fmtDate(s: string | null) {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString("pt-BR")
  } catch {
    return s
  }
}

export default function AdminAthletePresencePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [uid, setUid] = useState<string | null>(null)

  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [seasonId, setSeasonId] = useState<string>("")

  const [stages, setStages] = useState<StageRow[]>([])
  const [clubsById, setClubsById] = useState<Map<string, ClubRow>>(new Map())

  const [presenceByStage, setPresenceByStage] = useState<Map<number, PresenceRow>>(new Map())

  async function loadSeasonStagesAndPresence(pSeasonId: string, pUid: string) {
    // ✅ se seasonId estiver vazio, NÃO CONSULTA (evita uuid "")
    if (!pSeasonId) {
      setStages([])
      setClubsById(new Map())
      setPresenceByStage(new Map())
      return
    }

    // etapas da temporada
    const stRes = await supabase
      .from("stages")
      .select("id,season_id,name,status,stage_date,club_id")
      .eq("season_id", pSeasonId)
      .order("id", { ascending: false })

    if (stRes.error) throw stRes.error

    const stRows = (stRes.data ?? []) as StageRow[]
    setStages(stRows)

    // clubes
    const clubIds = Array.from(new Set(stRows.map((x) => x.club_id).filter(Boolean) as string[]))
    if (clubIds.length) {
      const cRes = await supabase.from("clubs").select("id,name").in("id", clubIds)
      if (!cRes.error) {
        const m = new Map<string, ClubRow>()
        for (const c of (cRes.data ?? []) as any[]) {
          m.set(String(c.id), { id: String(c.id), name: c.name ?? null })
        }
        setClubsById(m)
      } else {
        setClubsById(new Map())
      }
    } else {
      setClubsById(new Map())
    }

    // presenças (stage_participants) para o usuário logado
    const stageIds = stRows.map((x) => x.id)
    if (!stageIds.length) {
      setPresenceByStage(new Map())
      return
    }

    const pRes = await supabase
      .from("stage_participants")
      .select("id,stage_id,athlete_id,going,responded_at,updated_at")
      .eq("athlete_id", pUid)
      .in("stage_id", stageIds)

    if (pRes.error) throw pRes.error

    const pMap = new Map<number, PresenceRow>()
    for (const r of (pRes.data ?? []) as any[]) {
      pMap.set(Number(r.stage_id), {
        id: Number(r.id),
        stage_id: Number(r.stage_id),
        athlete_id: String(r.athlete_id),
        going: r.going ?? null,
        responded_at: r.responded_at ?? null,
        updated_at: r.updated_at ?? null,
      })
    }
    setPresenceByStage(pMap)
  }

  async function loadAll() {
    setLoading(true)
    setErr(null)

    try {
      const u = await supabase.auth.getUser()
      const id = u.data.user?.id ?? null
      if (!id) {
        setUid(null)
        setErr("not authenticated")
        setLoading(false)
        return
      }
      setUid(id)

      // temporadas
      const sRes = await supabase
        .from("seasons")
        .select("id,name,created_at")
        .order("created_at", { ascending: false })

      if (sRes.error) throw sRes.error

      const sRows = (sRes.data ?? []) as SeasonRow[]
      setSeasons(sRows)

      const chosenSeasonId = seasonId || (sRows[0]?.id ?? "")
      setSeasonId(chosenSeasonId)

      if (!chosenSeasonId) {
        setStages([])
        setClubsById(new Map())
        setPresenceByStage(new Map())
        setLoading(false)
        return
      }

      await loadSeasonStagesAndPresence(chosenSeasonId, id)
      setLoading(false)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setStages([])
      setClubsById(new Map())
      setPresenceByStage(new Map())
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // quando troca temporada manualmente (ou quando seasonId/uid mudam)
  useEffect(() => {
    if (!uid) return
    if (!seasonId) return // ✅ evita query com uuid ""
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        await loadSeasonStagesAndPresence(seasonId, uid)
      } catch (e: any) {
        setErr(e?.message ?? String(e))
        setStages([])
        setClubsById(new Map())
        setPresenceByStage(new Map())
      } finally {
        setLoading(false)
      }
    })()
  }, [seasonId, uid])

  const stagesSorted = useMemo(() => {
    const arr = [...stages]
    arr.sort((a, b) => {
      const ad = a.stage_date ? Date.parse(a.stage_date) : 0
      const bd = b.stage_date ? Date.parse(b.stage_date) : 0
      if (bd !== ad) return bd - ad
      return (b.id ?? 0) - (a.id ?? 0)
    })
    return arr
  }, [stages])

  async function setGoing(stageId: number, going: boolean) {
    if (!uid) return
    setSaving(true)
    setErr(null)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from("stage_participants")
        .upsert(
          {
            stage_id: stageId,
            athlete_id: uid,
            going,
            responded_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "stage_id,athlete_id" }
        )

      if (error) throw error

      // atualiza local
      setPresenceByStage((prev) => {
        const next = new Map(prev)
        next.set(stageId, {
          id: prev.get(stageId)?.id ?? 0,
          stage_id: stageId,
          athlete_id: uid,
          going,
          responded_at: nowIso,
          updated_at: nowIso,
        })
        return next
      })
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4">Carregando...</div>
  if (err) return <div className="card p-4 text-red-200">Erro: {err}</div>

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="text-sm text-slate-300">Área do atleta</div>
        <div className="text-2xl font-extrabold tracking-tight">Presença na Etapa</div>
        <div className="text-xs text-slate-300 mt-1">
          Marque <b>VOU</b> / <b>NÃO VOU</b> por etapa. Isso vale para você (admin) também, porque seu profile está <b>approved=true</b>.
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs text-slate-300 mb-1">Temporada</div>
        <select
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-white/20"
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
        >
          {seasons.length === 0 ? (
            <option value="">(sem temporadas)</option>
          ) : (
            seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.id}
              </option>
            ))
          )}
        </select>
      </div>

      {stagesSorted.length === 0 ? (
        <div className="card p-4 text-slate-200">Nenhuma etapa nessa temporada.</div>
      ) : (
        <div className="space-y-3">
          {stagesSorted.map((st) => {
            const pres = presenceByStage.get(st.id)
            const going = pres?.going ?? null
            const club = st.club_id ? clubsById.get(st.club_id) : null
            const status = (st.status ?? "").toLowerCase()

            return (
              <div key={st.id} className="card p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold">
                      {st.name ?? `Etapa ${st.id}`}{" "}
                      <span className="text-xs text-slate-400 font-normal">
                        • {club?.name ?? "—"} • {fmtDate(st.stage_date)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Status: <b>{status || "—"}</b>
                      {pres?.responded_at ? (
                        <span className="text-slate-400">
                          {" "}
                          • Respondido em {new Date(pres.responded_at).toLocaleString("pt-BR")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className={"btn-primary " + (going === true ? "ring-2 ring-emerald-300/40" : "")}
                      type="button"
                      onClick={() => setGoing(st.id, true)}
                      disabled={saving}
                      title="Confirmar presença"
                    >
                      VOU
                    </button>
                    <button
                      className={"btn-ghost " + (going === false ? "ring-2 ring-rose-300/30" : "")}
                      type="button"
                      onClick={() => setGoing(st.id, false)}
                      disabled={saving}
                      title="Recusar presença"
                    >
                      NÃO VOU
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-sm">
                  Presença atual:{" "}
                  <b className={going === true ? "text-emerald-300" : going === false ? "text-rose-300" : "text-slate-300"}>
                    {going === true ? "VOU" : going === false ? "NÃO VOU" : "NÃO RESPONDI"}
                  </b>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}