import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type SeasonRow = { id: string; name: string; year: number }
type ClubRow = { id: string; name: string }

type StageStatus =
  | "draft"
  | "scheduled"
  | "signup_open"
  | "signup_closed"
  | "running"
  | "finished"
  | "canceled"

type StageRow = {
  id: number
  season_id: string
  club_id: string | null
  name: string
  stage_no: number | null
  status: StageStatus
  signup_open_at: string | null
  signup_close_at: string | null
  starts_on: string | null
  created_at?: string | null
  updated_at?: string | null
}

function toIsoOrNull(v: string) {
  const s = (v ?? "").trim()
  if (!s) return null
  // input type="datetime-local" -> "YYYY-MM-DDTHH:mm"
  // Supabase aceita ISO (UTC ou local). Mantemos como está para não quebrar.
  return s.length === 16 ? `${s}:00` : s
}

function fmtTs(v: string | null | undefined) {
  if (!v) return "—"
  try {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return v
  }
}

export default function AdminStages() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [rows, setRows] = useState<StageRow[]>([])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    season_id: "",
    club_id: "",
    name: "",
    stage_no: "1",
    status: "draft" as StageStatus,
    signup_open_at: "",
    signup_close_at: "",
    starts_on: ""
  })

  const seasonName = useMemo(() => {
    const map = new Map(seasons.map((s) => [s.id, `${s.name} (${s.year})`]))
    return (id: string) => map.get(id) ?? id
  }, [seasons])

  const clubName = useMemo(() => {
    const map = new Map(clubs.map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? map.get(id) ?? id : "—")
  }, [clubs])

  const statusLabel = useMemo(() => {
    const map: Record<StageStatus, string> = {
      draft: "Rascunho",
      scheduled: "Agendada",
      signup_open: "Inscrições abertas",
      signup_closed: "Inscrições encerradas",
      running: "Em andamento",
      finished: "Finalizada",
      canceled: "Cancelada"
    }
    return (s: StageStatus) => map[s] ?? s
  }, [])

  async function getNextStageNo(seasonId: string): Promise<number> {
    if (!seasonId) return 1

    // Busca o maior stage_no da temporada (ignorando nulls) e retorna +1
    const { data, error } = await supabase
      .from("stages")
      .select("stage_no")
      .eq("season_id", seasonId)
      .order("stage_no", { ascending: false })
      .limit(1)

    if (error) throw error

    const maxNo = (data?.[0]?.stage_no ?? 0) as number
    return (maxNo || 0) + 1
  }

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const { data: seasonsData, error: seasonsErr } = await supabase
        .from("seasons")
        .select("id,name,year")
        .order("year", { ascending: false })

      if (seasonsErr) throw seasonsErr
      setSeasons((seasonsData ?? []) as SeasonRow[])

      const { data: clubsData, error: clubsErr } = await supabase
        .from("clubs")
        .select("id,name")
        .order("name", { ascending: true })

      if (clubsErr) throw clubsErr
      setClubs((clubsData ?? []) as ClubRow[])

      const { data: stagesData, error: stagesErr } = await supabase
        .from("stages")
        .select("id,season_id,club_id,name,stage_no,status,signup_open_at,signup_close_at,starts_on,created_at,updated_at")
        .order("id", { ascending: false })

      if (stagesErr) throw stagesErr
      setRows((stagesData ?? []) as StageRow[])
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCreate() {
    setEditingId(null)

    const defaultSeasonId = seasons[0]?.id ?? ""
    let nextNo = 1
    try {
      if (defaultSeasonId) nextNo = await getNextStageNo(defaultSeasonId)
    } catch (e: any) {
      // Se der erro, não bloqueia o formulário — só mantém "1"
      console.warn("Falha ao calcular próximo Nº da etapa:", e?.message ?? e)
    }

    setForm({
      season_id: defaultSeasonId,
      club_id: "",
      name: "",
      stage_no: String(nextNo),
      status: "draft",
      signup_open_at: "",
      signup_close_at: "",
      starts_on: ""
    })
  }

  function startEdit(r: StageRow) {
    setEditingId(r.id)
    setForm({
      season_id: r.season_id ?? "",
      club_id: r.club_id ?? "",
      name: r.name ?? "",
      stage_no: r.stage_no ? String(r.stage_no) : "",
      status: r.status,
      signup_open_at: r.signup_open_at ? r.signup_open_at.slice(0, 16) : "",
      signup_close_at: r.signup_close_at ? r.signup_close_at.slice(0, 16) : "",
      starts_on: r.starts_on ?? ""
    })
  }

  async function onChangeSeasonId(newSeasonId: string) {
    // Atualiza season_id sempre
    setForm((prev) => ({ ...prev, season_id: newSeasonId }))

    // Só auto-sequencia em modo "criar" (não editando)
    if (editingId) return

    try {
      const nextNo = await getNextStageNo(newSeasonId)
      setForm((prev) => ({ ...prev, stage_no: String(nextNo) }))
    } catch (e: any) {
      console.warn("Falha ao calcular próximo Nº da etapa:", e?.message ?? e)
    }
  }

  async function save() {
    setLoading(true)
    setError(null)
    try {
      if (!form.season_id) throw new Error("Selecione a temporada.")
      if (!form.name.trim()) throw new Error("Informe o nome da etapa.")

      const payload: any = {
        season_id: form.season_id,
        club_id: form.club_id.trim() === "" ? null : form.club_id,
        name: form.name.trim(),
        stage_no: form.stage_no.trim() === "" ? null : Number(form.stage_no),
        status: form.status,
        signup_open_at: toIsoOrNull(form.signup_open_at),
        signup_close_at: toIsoOrNull(form.signup_close_at),
        starts_on: form.starts_on.trim() === "" ? null : form.starts_on.trim() // YYYY-MM-DD
      }

      let q = supabase.from("stages")
      if (editingId) {
        const { error: upErr } = await q.update(payload).eq("id", editingId)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await q.insert(payload)
        if (insErr) throw insErr
      }

      await loadAll()
      await startCreate()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: number) {
    if (!confirm("Remover esta etapa?")) return
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.from("stages").delete().eq("id", id)
      if (error) throw error
      await loadAll()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin • Etapas</h1>
        <button className="btn btn-secondary" onClick={() => void startCreate()} disabled={loading}>
          Nova etapa
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700 bg-red-950/40 p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <label className="space-y-1 md:col-span-4">
            <div className="text-xs text-slate-300">Temporada</div>
            <select
              className="input w-full"
              value={form.season_id}
              onChange={(e) => void onChangeSeasonId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.year})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 md:col-span-4">
            <div className="text-xs text-slate-300">Clube (opcional)</div>
            <select
              className="input w-full"
              value={form.club_id}
              onChange={(e) => setForm({ ...form, club_id: e.target.value })}
            >
              <option value="">—</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-slate-300">Nº</div>
            <input
              className="input w-full"
              value={form.stage_no}
              onChange={(e) => setForm({ ...form, stage_no: e.target.value })}
              placeholder="1"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-slate-300">Status</div>
            <select
              className="input w-full"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as StageStatus })}
            >
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="signup_open">Inscrições abertas</option>
              <option value="signup_closed">Inscrições encerradas</option>
              <option value="running">Em andamento</option>
              <option value="finished">Finalizada</option>
              <option value="canceled">Cancelada</option>
            </select>
          </label>

          <label className="space-y-1 md:col-span-6">
            <div className="text-xs text-slate-300">Nome da etapa</div>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Arena Ibirubá - Etapa 1"
            />
          </label>

          <label className="space-y-1 md:col-span-3">
            <div className="text-xs text-slate-300">Inscrições abrem</div>
            <input
              type="datetime-local"
              className="input w-full"
              value={form.signup_open_at}
              onChange={(e) => setForm({ ...form, signup_open_at: e.target.value })}
            />
          </label>

          <label className="space-y-1 md:col-span-3">
            <div className="text-xs text-slate-300">Inscrições fecham</div>
            <input
              type="datetime-local"
              className="input w-full"
              value={form.signup_close_at}
              onChange={(e) => setForm({ ...form, signup_close_at: e.target.value })}
            />
          </label>

          <label className="space-y-1 md:col-span-3">
            <div className="text-xs text-slate-300">Início</div>
            <input
              type="date"
              className="input w-full"
              value={form.starts_on}
              onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save} disabled={loading}>
            {editingId ? "Salvar alterações" : "Criar etapa"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={() => void startCreate()} disabled={loading}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="py-2">ID</th>
                <th className="py-2">Temporada</th>
                <th className="py-2">Clube</th>
                <th className="py-2">Etapa</th>
                <th className="py-2">Status</th>
                <th className="py-2">Abre</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Início</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="py-2">{r.id}</td>
                  <td className="py-2">{seasonName(r.season_id)}</td>
                  <td className="py-2">{clubName(r.club_id)}</td>
                  <td className="py-2">
                    {r.stage_no ? `${r.stage_no} — ` : ""}
                    {r.name}
                  </td>
                  <td className="py-2">{statusLabel(r.status)}</td>
                  <td className="py-2">{fmtTs(r.signup_open_at)}</td>
                  <td className="py-2">{fmtTs(r.signup_close_at)}</td>
                  <td className="py-2">{r.starts_on ?? "—"}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => startEdit(r)} disabled={loading}>
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => remove(r.id)} disabled={loading}>
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-300" colSpan={9}>
                    Nenhuma etapa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}