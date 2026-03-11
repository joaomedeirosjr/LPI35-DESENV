import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type Stage = {
  id: number
  name: string | null
  status: string | null
}

type RoundRow = {
  id: string
  stage_id: number
  mode: string | null
  created_at: string | null
}

type GroupRow = {
  id: string
  round_id: string
  label: string | null
  cat_a: string | null
  cat_b: string | null
  sort_order: number | null
}

type CatKey = "A" | "B" | "C" | "D"

type Guest = {
  id: string
  stage_id: number
  name: string | null
  birth_date: string | null
  is_pending: boolean
  created_at: string
  category: CatKey | null
}

type StageRosterRow = {
  id: string
  stage_id: number
  kind: "athlete" | "guest" | string
  athlete_id: string | null
  guest_id: string | null
  category: string | null
}

type ProfileRow = {
  id: string
  nome?: string | null
  name?: string | null
  full_name?: string | null
  category?: string | null
}

type PairRow = {
  pair_id: string
  a_roster_id: string
  b_roster_id: string
  a_label: string | null
  b_label: string | null
}

function pickProfileName(p: ProfileRow): string {
  const a = (p.nome ?? "").trim()
  if (a) return a
  const b = (p.name ?? "").trim()
  if (b) return b
  const c = (p.full_name ?? "").trim()
  if (c) return c
  return String(p.id).slice(0, 8)
}

function shortId(id: string | null | undefined) {
  if (!id) return "—"
  return String(id).slice(0, 8)
}

function asCat(v: any): CatKey | null {
  const c = String(v ?? "").toUpperCase().trim()
  return c === "A" || c === "B" || c === "C" || c === "D" ? c : null
}

async function fetchProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return []

  const candidates = [
    "id,nome,category",
    "id,name,category",
    "id,full_name,category",
    "id,nome,name,category",
    "id,nome,full_name,category",
    "id,name,full_name,category",
    "id,nome,name,full_name,category",
    "id",
  ]

  for (const sel of candidates) {
    const { data, error } = await supabase.from("profiles").select(sel).in("id", ids)
    if (!error) return (data || []) as any
    const msg = String(error?.message || "")
    if (!/column .* does not exist/i.test(msg)) {
      throw error
    }
  }

  return []
}

export default function AdminGuests() {
  const [stages, setStages] = useState<Stage[]>([])
  const [stageId, setStageId] = useState<number | null>(null)
  const [stageStatus, setStageStatus] = useState<string | null>(null)

  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [roundId, setRoundId] = useState<string>("")
  const [groups, setGroups] = useState<GroupRow[]>([])

  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editing, setEditing] = useState<Guest | null>(null)
  const [name, setName] = useState("")
  const [birth, setBirth] = useState("")
  const [category, setCategory] = useState<CatKey>("A")

  const [guestPlayMap, setGuestPlayMap] = useState<
    Record<string, { partner: string; pairId: string; groupLabel: string }>
  >({})

  const [linkingGuest, setLinkingGuest] = useState<Guest | null>(null)
  const [linkGroupId, setLinkGroupId] = useState<string>("")
  const [linkAthleteId, setLinkAthleteId] = useState<string>("")
  const [athletes, setAthletes] = useState<Array<{ id: string; name: string; category: string }>>([])

  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([])

  const isFinished = stageStatus === "finished"

  async function ensureGuestStageRoster(pGuestId: string, pStageId: number, pCategory: CatKey) {
    const { data: existing, error: existingErr } = await supabase
      .from("stage_roster")
      .select("id,stage_id,kind,guest_id,category")
      .eq("stage_id", pStageId)
      .eq("kind", "guest")
      .eq("guest_id", pGuestId)
      .maybeSingle()

    if (existingErr) throw existingErr

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from("stage_roster")
        .update({ category: pCategory })
        .eq("id", existing.id)

      if (updErr) throw updErr
      return
    }

    const { error: insErr } = await supabase
      .from("stage_roster")
      .insert({
        stage_id: pStageId,
        kind: "guest",
        guest_id: pGuestId,
        category: pCategory,
      })

    if (insErr) throw insErr
  }

  async function loadStages() {
    const { data, error } = await supabase
      .from("stages")
      .select("id,name,status")
      .order("id", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const rows = (data || []) as Stage[]
    setStages(rows)

    if (rows.length > 0 && stageId === null) {
      setStageId(rows[0].id)
      setStageStatus(rows[0].status ?? null)
    }
  }

  async function loadRounds(pStageId: number) {
    const { data, error } = await supabase
      .from("rounds")
      .select("id,stage_id,mode,created_at")
      .eq("stage_id", pStageId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setRounds([])
      setRoundId("")
      return
    }

    const rows = (data || []) as RoundRow[]
    setRounds(rows)
    setRoundId(rows.length > 0 ? rows[0].id : "")
  }

  async function loadGroups(pRoundId: string) {
    if (!pRoundId) {
      setGroups([])
      return
    }

    const { data, error } = await supabase
      .from("round_groups")
      .select("id,round_id,label,cat_a,cat_b,sort_order")
      .eq("round_id", pRoundId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error(error)
      setGroups([])
      return
    }

    setGroups((data || []) as GroupRow[])
  }

  async function loadGuests(pStageId: number) {
    setLoading(true)
    try {
      const [{ data: guestsData, error: guestsErr }, { data: rosterData, error: rosterErr }] = await Promise.all([
        supabase
          .from("guests")
          .select("*")
          .eq("stage_id", pStageId)
          .order("is_pending", { ascending: false })
          .order("created_at", { ascending: true }),
        supabase
          .from("stage_roster")
          .select("id,stage_id,kind,athlete_id,guest_id,category")
          .eq("stage_id", pStageId)
          .eq("kind", "guest"),
      ])

      if (guestsErr) throw guestsErr
      if (rosterErr) throw rosterErr

      const rosterRows = (rosterData || []) as StageRosterRow[]
      const guestCatMap: Record<string, CatKey | null> = {}
      for (const r of rosterRows) {
        const gid = String(r.guest_id ?? "")
        if (!gid) continue
        guestCatMap[gid] = asCat(r.category)
      }

      const rows = ((guestsData || []) as any[]).map((g) => ({
        ...(g as Guest),
        category: guestCatMap[String(g.id)] ?? null,
      }))

      setGuests(rows)
    } catch (e: any) {
      console.error(e)
      alert("Erro ao carregar convidados: " + (e?.message || String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function loadAthletesForStage(pStageId: number) {
    try {
      const { data: roster, error: rErr } = await supabase
        .from("stage_roster")
        .select("id,stage_id,kind,athlete_id,guest_id,category")
        .eq("stage_id", pStageId)

      if (rErr) throw rErr

      const rosterRows = (roster || []) as any as StageRosterRow[]
      const athleteIds = rosterRows
        .filter((r) => String(r?.kind) === "athlete" && r?.athlete_id)
        .map((r) => String(r.athlete_id))

      if (athleteIds.length === 0) {
        setAthletes([])
        return
      }

      const prof = await fetchProfilesByIds(athleteIds)
      const byId: Record<string, ProfileRow> = {}
      for (const p of prof) byId[String(p.id)] = p

      const list = athleteIds
        .map((id) => {
          const p = byId[id] || ({ id } as ProfileRow)
          const cat = String(p.category ?? "").toUpperCase().trim() || "—"
          return { id, name: pickProfileName(p), category: cat }
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))

      setAthletes(list)
    } catch (e: any) {
      console.error(e)
      setAthletes([])
    }
  }

  async function buildGuestPlayMap(pStageId: number, pRoundId: string) {
    setGuestPlayMap({})
    if (!pStageId || !pRoundId) return

    try {
      const { data: roster, error: rErr } = await supabase
        .from("stage_roster")
        .select("id,stage_id,kind,athlete_id,guest_id,category")
        .eq("stage_id", pStageId)

      if (rErr) throw rErr
      const rosterRows = (roster || []) as any as StageRosterRow[]
      const rosterById: Record<string, StageRosterRow> = {}
      for (const r of rosterRows) rosterById[String(r.id)] = r

      const { data: grp, error: gErr } = await supabase
        .from("round_groups")
        .select("id,round_id,label,cat_a,cat_b,sort_order")
        .eq("round_id", pRoundId)
        .order("sort_order", { ascending: true })

      if (gErr) throw gErr
      const grpRows = (grp || []) as GroupRow[]

      const nextMap: Record<string, { partner: string; pairId: string; groupLabel: string }> = {}

      for (const g of grpRows) {
        const { data: pairs, error: pErr } = await supabase.rpc("admin_list_round_pairs", {
          p_round_id: pRoundId,
          p_group_id: g.id,
        })
        if (pErr) throw pErr

        const rows = (pairs || []) as any as PairRow[]
        const groupLabel =
          (g.label ?? "").trim() ||
          `${String(g.cat_a ?? "").toUpperCase()}+${String(g.cat_b ?? "").toUpperCase()}`

        for (const pr of rows) {
          const aRid = String(pr.a_roster_id)
          const bRid = String(pr.b_roster_id)

          const aRoster = rosterById[aRid]
          const bRoster = rosterById[bRid]

          const aIsGuest = aRoster && String(aRoster.kind) === "guest" && aRoster.guest_id
          const bIsGuest = bRoster && String(bRoster.kind) === "guest" && bRoster.guest_id

          if (aIsGuest) {
            const gid = String(aRoster.guest_id)
            const partner = (pr.b_label ?? "—").trim() || "—"
            nextMap[gid] = { partner, pairId: pr.pair_id, groupLabel }
          }
          if (bIsGuest) {
            const gid = String(bRoster.guest_id)
            const partner = (pr.a_label ?? "—").trim() || "—"
            nextMap[gid] = { partner, pairId: pr.pair_id, groupLabel }
          }
        }
      }

      setGuestPlayMap(nextMap)
    } catch (e: any) {
      console.warn("buildGuestPlayMap:", e?.message || e)
      setGuestPlayMap({})
    }
  }

  useEffect(() => {
    loadStages()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!stageId) return

      const st = stages.find((s) => s.id === stageId)
      setStageStatus(st?.status ?? null)

      await Promise.all([loadGuests(stageId), loadRounds(stageId), loadAthletesForStage(stageId)])
      setSelectedGuestIds([])
    })()
  }, [stageId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!stageId) return
    const st = stages.find((s) => s.id === stageId)
    setStageStatus(st?.status ?? null)
  }, [stages, stageId])

  useEffect(() => {
    ;(async () => {
      if (!roundId) {
        setGroups([])
        setGuestPlayMap({})
        return
      }
      await loadGroups(roundId)
      if (stageId) await buildGuestPlayMap(stageId, roundId)
    })()
  }, [roundId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(g: Guest) {
    setEditing(g)
    setName(g.name ?? "")
    setBirth(g.birth_date ?? "")
    setCategory(g.category ?? "A")
  }

  function closeEdit() {
    setEditing(null)
    setName("")
    setBirth("")
    setCategory("A")
  }

  async function saveGuest() {
    if (!editing) return
    if (!name || !birth) {
      alert("Nome e nascimento são obrigatórios.")
      return
    }
    if (!category) {
      alert("Categoria é obrigatória.")
      return
    }

    if (isFinished) {
      alert("Etapa finalizada: edição bloqueada.")
      return
    }

    try {
      const { error } = await supabase
        .from("guests")
        .update({
          name: name.trim(),
          birth_date: birth,
          is_pending: false,
        })
        .eq("id", editing.id)

      if (error) throw error

      await ensureGuestStageRoster(editing.id, editing.stage_id, category)

      closeEdit()
      if (stageId) {
        await loadGuests(stageId)
        if (roundId) await buildGuestPlayMap(stageId, roundId)
      }
    } catch (e: any) {
      alert("Erro ao salvar: " + (e?.message || String(e)))
    }
  }

  async function addGuest() {
    if (!stageId) return
    if (isFinished) {
      alert("Etapa finalizada: não é possível adicionar convidado.")
      return
    }

    const { data, error } = await supabase
      .from("guests")
      .insert({
        stage_id: stageId,
        is_pending: true,
      })
      .select()
      .single()

    if (error) {
      alert("Erro ao criar convidado: " + (error.message || String(error)))
      return
    }

    if (data) {
      openEdit({ ...(data as Guest), category: "A" })
      await loadGuests(stageId)
    }
  }

  function toggleGuestSelection(guestId: string) {
    setSelectedGuestIds((prev) =>
      prev.includes(guestId) ? prev.filter((id) => id !== guestId) : [...prev, guestId]
    )
  }

  function toggleSelectAllVisible() {
    const visibleIds = guests.map((g) => g.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedGuestIds.includes(id))

    if (allSelected) {
      setSelectedGuestIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedGuestIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  async function deleteSelectedGuests() {
    if (!stageId) return
    if (isFinished) {
      alert("Etapa finalizada: exclusão bloqueada.")
      return
    }
    if (selectedGuestIds.length === 0) {
      alert("Selecione pelo menos um convidado para excluir.")
      return
    }

    const count = selectedGuestIds.length
    if (!confirm(`Excluir ${count} convidado(s) selecionado(s) por completo?`)) {
      return
    }

    try {
      setDeleting(true)

      const { error: rosterErr } = await supabase
        .from("stage_roster")
        .delete()
        .eq("stage_id", stageId)
        .eq("kind", "guest")
        .in("guest_id", selectedGuestIds)

      if (rosterErr) throw rosterErr

      const { error } = await supabase
        .from("guests")
        .delete()
        .in("id", selectedGuestIds)

      if (error) throw error

      setSelectedGuestIds([])
      await loadGuests(stageId)
      if (roundId) await buildGuestPlayMap(stageId, roundId)

      alert(`Convidado(s) excluído(s): ${count}`)
    } catch (e: any) {
      alert("Erro ao excluir convidados:\n\n" + (e?.message || String(e)))
    } finally {
      setDeleting(false)
    }
  }

  function openLink(g: Guest) {
    setLinkingGuest(g)
    setLinkGroupId("")
    setLinkAthleteId("")
  }

  function closeLink() {
    setLinkingGuest(null)
    setLinkGroupId("")
    setLinkAthleteId("")
  }

  async function confirmLink() {
    if (!linkingGuest) return
    if (!stageId || !roundId) {
      alert("Selecione etapa e rodada.")
      return
    }
    if (!linkGroupId) {
      alert("Selecione o grupo.")
      return
    }
    if (!linkAthleteId) {
      alert("Selecione o atleta parceiro.")
      return
    }

    if (isFinished) {
      alert("Etapa finalizada: edição bloqueada.")
      return
    }

    const { error } = await supabase.rpc("admin_link_guest_to_athlete", {
      p_round_id: roundId,
      p_group_id: linkGroupId,
      p_guest_id: linkingGuest.id,
      p_athlete_profile_id: linkAthleteId,
    })

    if (error) {
      const msg = String(error.message || error)
      const guestLabel = (linkingGuest.name ?? "").trim() || `convidado ${shortId(linkingGuest.id)}`

      if (/Could not find the function/i.test(msg) || /schema cache/i.test(msg)) {
        alert(
          "A RPC admin_link_guest_to_athlete não foi encontrada no banco.\n\n" +
            msg +
            "\n\nRode o SQL da RPC no Supabase e tente novamente."
        )
      } else if (/stage_roster_unique_guest_per_stage/i.test(msg) || /duplicate key value violates unique constraint/i.test(msg)) {
        alert(
          `Este convidado já está em uso nesta etapa.\n\n` +
            `Convidado: ${guestLabel}\n\n` +
            `Ele já está vinculado a outra vaga/dupla da etapa. Para usar este convidado com outro atleta, primeiro mova/substitua o vínculo atual.`
        )
      } else if (/selected athlete pair has no guest slot to replace/i.test(msg)) {
        alert(
          "A dupla do atleta selecionado não possui uma vaga de convidado para substituir.\n\n" +
            "Escolha um atleta que já esteja em uma dupla com slot de convidado."
        )
      } else if (/athlete is not in any pair/i.test(msg)) {
        alert(
          "O atleta selecionado não está em nenhuma dupla deste grupo/rodada.\n\n" +
            "Verifique o grupo escolhido e se as duplas já foram sorteadas."
        )
      } else if (/guest not found in guests/i.test(msg)) {
        alert(
          "O convidado selecionado não foi encontrado na tabela guests.\n\n" +
            "Atualize a página e tente novamente. Se persistir, revise o cadastro do convidado."
        )
      } else if (/guest belongs to another stage/i.test(msg)) {
        alert(
          "Este convidado pertence a outra etapa.\n\n" +
            "Selecione um convidado da etapa atual."
        )
      } else {
        alert("Erro ao aplicar vínculo do convidado:\n\n" + msg)
      }
      return
    }

    closeLink()
    if (stageId) {
      await loadGuests(stageId)
      await buildGuestPlayMap(stageId, roundId)
    }
  }

  const stageLabel = useMemo(() => {
    if (!stageId) return "—"
    const st = stages.find((s) => s.id === stageId)
    return st ? `#${st.id} - ${st.name ?? "Etapa"}` : "—"
  }, [stageId, stages])

  const roundLabel = useMemo(() => {
    if (!roundId) return "(sem rodada)"
    const r = rounds.find((x) => x.id === roundId)
    if (!r) return roundId.slice(0, 8)
    return `${(r.mode ?? "round")} - ${r.id.slice(0, 8)}`
  }, [roundId, rounds])

  const allVisibleSelected =
    guests.length > 0 && guests.every((g) => selectedGuestIds.includes(g.id))

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="text-lg font-bold">Convidados por Etapa</div>

        <div className="mt-3 flex flex-col md:flex-row gap-4 items-end">
          <div>
            <div className="text-sm text-slate-300">Etapa</div>
            <select className="input" value={stageId ?? ""} onChange={(e) => setStageId(Number(e.target.value))}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} - {s.name ?? "Etapa"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm text-slate-300">Rodada (para mapear “Jogando com”)</div>
            <select className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)} disabled={rounds.length === 0}>
              {rounds.length === 0 ? (
                <option value="">(sem rodadas)</option>
              ) : (
                rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.mode ?? "round")} - {r.id.slice(0, 8)}
                  </option>
                ))
              )}
            </select>
          </div>

          <button className="btn-primary" onClick={addGuest} disabled={isFinished}>
            + Novo convidado
          </button>

          <button
            className="btn-ghost"
            onClick={deleteSelectedGuests}
            disabled={isFinished || deleting || selectedGuestIds.length === 0}
            title="Excluir por completo os convidados selecionados"
          >
            {deleting ? "Excluindo..." : `Excluir convidados${selectedGuestIds.length > 0 ? ` (${selectedGuestIds.length})` : ""}`}
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-400">
          Etapa selecionada: <b>{stageLabel}</b> • Rodada: <b>{roundLabel}</b>
          {isFinished ? " • (Etapa finalizada: edição bloqueada)" : ""}
        </div>
      </div>

      <div className="card">
        <div className="text-lg font-bold mb-3">Lista</div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-300">
              <th className="py-2 w-[44px]">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  disabled={guests.length === 0 || isFinished}
                />
              </th>
              <th className="py-2">Pendente</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Nascimento</th>
              <th>Jogando com (rodada)</th>
              <th>Grupo</th>
              <th>Dupla</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="py-3">
                  Carregando...
                </td>
              </tr>
            )}

            {!loading && guests.length === 0 && (
              <tr>
                <td colSpan={9} className="py-3 text-slate-300">
                  Nenhum convidado nesta etapa.
                </td>
              </tr>
            )}

            {guests.map((g) => {
              const play = guestPlayMap[g.id] ?? null
              const checked = selectedGuestIds.includes(g.id)

              return (
                <tr key={g.id} className="border-t border-white/10">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGuestSelection(g.id)}
                      disabled={isFinished}
                    />
                  </td>
                  <td className="py-2">{g.is_pending ? "SIM" : "NÃO"}</td>
                  <td>{g.name ?? "(sem nome)"}</td>
                  <td>{g.category ?? "—"}</td>
                  <td>{g.birth_date ?? "(sem data)"}</td>
                  <td>{play?.partner ?? "—"}</td>
                  <td>{play?.groupLabel ?? "—"}</td>
                  <td className="font-mono">{play ? shortId(play.pairId) : "—"}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button className="btn-secondary" onClick={() => openEdit(g)} disabled={isFinished}>
                        Editar
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => openLink(g)}
                        disabled={isFinished || !roundId}
                        title={!roundId ? "Selecione uma rodada para vincular" : "Vincular este convidado a um atleta na rodada"}
                      >
                        Vincular
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-3 text-xs text-slate-400">
          Observação: “Jogando com” é calculado a partir das duplas da <b>rodada selecionada</b>.
        </div>
      </div>

      {editing && (
        <div className="card">
          <div className="text-lg font-bold mb-3">Editar convidado</div>

          <div className="space-y-3">
            <div>
              <div className="text-sm text-slate-300">Nome</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={isFinished} />
            </div>

            <div>
              <div className="text-sm text-slate-300">Categoria</div>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as CatKey)}
                disabled={isFinished}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>

            <div>
              <div className="text-sm text-slate-300">Nascimento</div>
              <input type="date" className="input" value={birth} onChange={(e) => setBirth(e.target.value)} disabled={isFinished} />
            </div>

            <div className="flex gap-3">
              <button className="btn-primary" onClick={saveGuest} disabled={isFinished}>
                Salvar
              </button>
              <button className="btn-ghost" onClick={closeEdit}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {linkingGuest && (
        <div className="card">
          <div className="text-lg font-bold mb-2">Vincular convidado a atleta (rodada)</div>
          <div className="text-sm text-slate-300 mb-3">
            Convidado: <b>{linkingGuest.name ?? shortId(linkingGuest.id)}</b> • Etapa #{linkingGuest.stage_id}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-sm text-slate-300">Grupo</div>
              <select className="input" value={linkGroupId} onChange={(e) => setLinkGroupId(e.target.value)}>
                <option value="">(selecionar)</option>
                {groups.map((g) => {
                  const label =
                    (g.label ?? "").trim() ||
                    `${String(g.cat_a ?? "").toUpperCase()}+${String(g.cat_b ?? "").toUpperCase()}`
                  return (
                    <option key={g.id} value={g.id}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <div className="text-sm text-slate-300">Atleta parceiro</div>
              <select className="input" value={linkAthleteId} onChange={(e) => setLinkAthleteId(e.target.value)}>
                <option value="">(selecionar)</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button className="btn-primary" onClick={confirmLink} disabled={isFinished}>
              Aplicar vínculo
            </button>
            <button className="btn-ghost" onClick={closeLink}>
              Cancelar
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-400">
            O vínculo tenta colocar o convidado escolhido na vaga guest da dupla do atleta selecionado.
          </div>
        </div>
      )}
    </div>
  )
}