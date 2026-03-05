import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Stage = {
  id: number
  name: string | null
  status: string | null
}

type Guest = {
  id: string
  stage_id: number
  name: string | null
  birth_date: string | null
  is_pending: boolean
  created_at: string
}

export default function AdminGuests() {
  const [stages, setStages] = useState<Stage[]>([])
  const [stageId, setStageId] = useState<number | null>(null)
  const [stageStatus, setStageStatus] = useState<string | null>(null)

  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)

  const [editing, setEditing] = useState<Guest | null>(null)
  const [name, setName] = useState("")
  const [birth, setBirth] = useState("")

  const isFinished = stageStatus === "finished"

  async function loadStages() {
    const { data } = await supabase
      .from("stages")
      .select("id,name,status")
      .order("id", { ascending: false })

    if (data) {
      setStages(data)
      if (data.length > 0 && stageId === null) {
        setStageId(data[0].id)
        setStageStatus(data[0].status)
      }
    }
  }

  async function loadGuests(stage: number) {
    setLoading(true)

    const { data } = await supabase
      .from("guests")
      .select("*")
      .eq("stage_id", stage)
      .order("is_pending", { ascending: false })

    if (data) setGuests(data)

    setLoading(false)
  }

  useEffect(() => {
    loadStages()
  }, [])

  useEffect(() => {
    if (!stageId) return
    const st = stages.find((s) => s.id === stageId)
    setStageStatus(st?.status ?? null)
    loadGuests(stageId)
  }, [stageId])

  function openEdit(g: Guest) {
    setEditing(g)
    setName(g.name ?? "")
    setBirth(g.birth_date ?? "")
  }

  function closeEdit() {
    setEditing(null)
    setName("")
    setBirth("")
  }

  async function saveGuest() {
    if (!editing) return
    if (!name || !birth) {
      alert("Nome e nascimento são obrigatórios.")
      return
    }

    await supabase
      .from("guests")
      .update({
        name,
        birth_date: birth,
        is_pending: false,
      })
      .eq("id", editing.id)

    closeEdit()
    if (stageId) loadGuests(stageId)
  }

  async function addGuest() {
    if (!stageId) return

    const { data } = await supabase
      .from("guests")
      .insert({
        stage_id: stageId,
        is_pending: true,
      })
      .select()
      .single()

    if (data) {
      openEdit(data)
      loadGuests(stageId)
    }
  }

  return (
    <div className="space-y-6">

      <div className="card">
        <div className="text-lg font-bold">Convidados por Etapa</div>

        <div className="mt-3 flex gap-4 items-end">

          <div>
            <div className="text-sm text-slate-300">Etapa</div>
            <select
              className="input"
              value={stageId ?? ""}
              onChange={(e) => setStageId(Number(e.target.value))}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={addGuest}
            disabled={isFinished}
          >
            + Novo convidado
          </button>

        </div>
      </div>

      <div className="card">
        <div className="text-lg font-bold mb-3">Lista</div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-300">
              <th>Pendente</th>
              <th>Nome</th>
              <th>Nascimento</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={4}>Carregando...</td>
              </tr>
            )}

            {guests.map((g) => (
              <tr key={g.id}>
                <td>{g.is_pending ? "SIM" : "NÃO"}</td>
                <td>{g.name ?? "(sem nome)"}</td>
                <td>{g.birth_date ?? "(sem data)"}</td>
                <td>
                  <button
                    className="btn-secondary"
                    onClick={() => openEdit(g)}
                    disabled={isFinished}
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card">
          <div className="text-lg font-bold mb-3">Editar convidado</div>

          <div className="space-y-3">

            <div>
              <div className="text-sm text-slate-300">Nome</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm text-slate-300">Nascimento</div>
              <input
                type="date"
                className="input"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button className="btn-primary" onClick={saveGuest}>
                Salvar
              </button>

              <button className="btn-ghost" onClick={closeEdit}>
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}