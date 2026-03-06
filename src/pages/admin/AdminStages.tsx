import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"
import { formatDateBR } from "../../utils/date"

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

type DeepDeleteResult = {
  deleted_stage_id: number
  deleted_match_teams: number
  deleted_matches: number
  deleted_round_pairs: number
  deleted_round_groups: number
  deleted_rounds: number
  deleted_stage_participants: number
  deleted_stage_roster: number
  deleted_guests: number
  deleted_stages: number
}

type GarbageCheckRow = {
  check_name: string
  qtd: number
}

function toIsoOrNull(v: string) {
  const s = (v ?? "").trim()
  if (!s) return null
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
  const [checkingGarbage, setCheckingGarbage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [rows, setRows] = useState<StageRow[]>([])
  const [garbageRows, setGarbageRows] = useState<GarbageCheckRow[]>([])

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

  const garbageTotal = useMemo(() => {
    return garbageRows.reduce((acc, row) => acc + Number(row.qtd || 0), 0)
  }, [garbageRows])

  const garbageHasIssues = useMemo(() => {
    return garbageRows.some((row) => Number(row.qtd || 0) > 0)
  }, [garbageRows])

  async function getNextStageNo(seasonId: string): Promise<number> {
    if (!seasonId) return 1

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
    setError(null)
    setSuccess(null)

    const defaultSeasonId = seasons[0]?.id ?? ""
    let nextNo = 1
    try {
      if (defaultSeasonId) nextNo = await getNextStageNo(defaultSeasonId)
    } catch (e: any) {
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
    setError(null)
    setSuccess(null)
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
    setForm((prev) => ({ ...prev, season_id: newSeasonId }))

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
    setSuccess(null)
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
        starts_on: form.starts_on.trim() === "" ? null : form.starts_on.trim()
      }

      const q = supabase.from("stages")
      if (editingId) {
        const { error: upErr } = await q.update(payload).eq("id", editingId)
        if (upErr) throw upErr
        setSuccess("Etapa atualizada com sucesso.")
      } else {
        const { error: insErr } = await q.insert(payload)
        if (insErr) throw insErr
        setSuccess("Etapa criada com sucesso.")
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
    setSuccess(null)
    try {
      const { error } = await supabase.from("stages").delete().eq("id", id)
      if (error) throw error
      setSuccess(`Etapa ${id} removida com sucesso.`)
      await loadAll()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  async function removeDeep(stage: StageRow) {
    setError(null)
    setSuccess(null)

    const typed = window.prompt(
      [
        `EXCLUSÃO DO BD — ETAPA ${stage.id}`,
        ``,
        `Etapa: ${stage.stage_no ? `${stage.stage_no} — ` : ""}${stage.name}`,
        `Status: ${statusLabel(stage.status)}`,
        ``,
        `Esta operação removerá completamente do banco de dados:`,
        `- rodadas`,
        `- jogos`,
        `- placares`,
        `- duplas`,
        `- participantes`,
        `- convidados`,
        `- ranking da etapa`,
        ``,
        `Esta ação NÃO pode ser desfeita.`,
        ``,
        `Digite exatamente: EXCLUIR ETAPA`
      ].join("\n")
    )

    if (typed === null) return

    if (typed.trim() !== "EXCLUIR ETAPA") {
      setError("Confirmação inválida. Digite exatamente EXCLUIR ETAPA.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("admin_delete_stage_deep", {
        p_stage_id: stage.id
      })

      if (error) throw error

      const result = Array.isArray(data) ? (data[0] as DeepDeleteResult | undefined) : undefined

      if (!result) {
        setSuccess(`Exclusão do BD da etapa ${stage.id} concluída.`)
      } else {
        setSuccess(
          [
            `Exclusão do BD concluída para a etapa ${result.deleted_stage_id}.`,
            `match_teams: ${result.deleted_match_teams}`,
            `matches: ${result.deleted_matches}`,
            `round_pairs: ${result.deleted_round_pairs}`,
            `round_groups: ${result.deleted_round_groups}`,
            `rounds: ${result.deleted_rounds}`,
            `stage_participants: ${result.deleted_stage_participants}`,
            `stage_roster: ${result.deleted_stage_roster}`,
            `guests: ${result.deleted_guests}`,
            `stages: ${result.deleted_stages}`
          ].join(" ")
        )
      }

      if (editingId === stage.id) {
        await startCreate()
      }

      await loadAll()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  async function checkStageGarbage() {
    setCheckingGarbage(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error } = await supabase.rpc("admin_check_stage_garbage")

      if (error) throw error

      const rows = (data ?? []) as GarbageCheckRow[]
      setGarbageRows(rows)

      const total = rows.reduce((acc, row) => acc + Number(row.qtd || 0), 0)

      if (total === 0) {
        setSuccess("Verificação concluída: nenhuma sujeira de etapas encontrada.")
      } else {
        setSuccess(`Verificação concluída: ${total} ocorrência(s) de sujeira encontrada(s).`)
      }
    } catch (e: any) {
      setError(e?.message ?? String(e))
      setGarbageRows([])
    } finally {
      setCheckingGarbage(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Admin • Etapas</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn btn-secondary"
            onClick={() => void checkStageGarbage()}
            disabled={loading || checkingGarbage}
          >
            {checkingGarbage ? "Verificando sujeira..." : "Verificar sujeira do BD"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void startCreate()}
            disabled={loading || checkingGarbage}
          >
            Nova etapa
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700 bg-red-950/40 p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-200 text-sm">
          {success}
        </div>
      )}

      {garbageRows.length > 0 && (
        <div
          className={`rounded-xl border p-4 ${
            garbageHasIssues
              ? "border-amber-700 bg-amber-950/30"
              : "border-emerald-700 bg-emerald-950/20"
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="font-semibold">
              Diagnóstico de sujeira de etapas
            </div>
            <div
              className={`text-sm font-medium ${
                garbageHasIssues ? "text-amber-200" : "text-emerald-200"
              }`}
            >
              Total de ocorrências: {garbageTotal}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead>
                <tr className="text-left text-slate-300">
                  <th className="py-2">Verificação</th>
                  <th className="py-2 text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {garbageRows.map((row) => {
                  const hasIssue = Number(row.qtd || 0) > 0
                  return (
                    <tr key={row.check_name} className="border-t border-white/10">
                      <td className="py-2">{row.check_name}</td>
                      <td
                        className={`py-2 text-right font-medium ${
                          hasIssue ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        {row.qtd}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
          <button className="btn btn-primary" onClick={save} disabled={loading || checkingGarbage}>
            {editingId ? "Salvar alterações" : "Criar etapa"}
          </button>
          {editingId && (
            <button
              className="btn btn-secondary"
              onClick={() => void startCreate()}
              disabled={loading || checkingGarbage}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
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
                  <td className="py-2">{formatDateBR(r.starts_on) || "—"}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        className="btn btn-secondary"
                        onClick={() => startEdit(r)}
                        disabled={loading || checkingGarbage}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => remove(r.id)}
                        disabled={loading || checkingGarbage}
                      >
                        Remover
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => void removeDeep(r)}
                        disabled={loading || checkingGarbage}
                      >
                        Exclusão do BD
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