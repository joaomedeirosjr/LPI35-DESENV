import { useEffect, useMemo, useState } from "react"
import { supabase } from "../../lib/supabase"

type StageRow = {
  id: any
  name: string
  stage_no: number | null
  status: string
  starts_on: string | null
  created_at: string

  // ✅ adicionados (existem no SELECT e são usados no filtro openStages)
  signup_open_at: string | null
  signup_close_at: string | null
}

type MyParticipation = {
  stage_id: any
  going: boolean
  responded_at: string
}

type MyProfileMini = {
  nome: string | null
  categoria?: string | null
  category?: string | null
}

function fmtDateBR(v: string | null) {
  if (!v) return "-"
  const d = new Date(v.length === 10 ? v + "T00:00:00" : v)
  if (isNaN(d.getTime())) return v
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function fmtTs(v: string | null) {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AthleteStages() {
  const [stages, setStages] = useState<StageRow[]>([])
  const [mine, setMine] = useState<Record<string, MyParticipation>>({})
  const [profile, setProfile] = useState<MyProfileMini | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notice, setNotice] = useState<string | null>(null)
  const [noticeKind, setNoticeKind] = useState<"ok" | "warn" | "err">("ok")

  const openStages = useMemo(() => {
    const nowMs = Date.now()
    return stages.filter((s) => {
      if (!s.signup_open_at || !s.signup_close_at) return false
      const openMs = Date.parse(s.signup_open_at)
      const closeMs = Date.parse(s.signup_close_at)
      if (Number.isNaN(openMs) || Number.isNaN(closeMs)) return false
      return nowMs >= openMs && nowMs <= closeMs
    })
  }, [stages])

  const myCategory = (profile as any)?.categoria ?? (profile as any)?.category ?? "-"

  function showNotice(kind: "ok" | "warn" | "err", msg: string) {
    setNoticeKind(kind)
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 4000)
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: stagesData, error: stagesErr } = await supabase
        .from("stages")
        .select("id,name,stage_no,status,starts_on,created_at,signup_open_at,signup_close_at")
        .order("created_at", { ascending: false })

      if (stagesErr) throw new Error(stagesErr.message)
      setStages(((stagesData as StageRow[]) ?? []) as StageRow[])

      const { data: myData, error: myErr } = await supabase
        .from("stage_participants")
        .select("stage_id, going, responded_at")

      if (myErr) throw new Error(myErr.message)

      const map: Record<string, MyParticipation> = {}
      for (const r of (myData as any[]) ?? []) {
        map[String(r.stage_id)] = {
          stage_id: r.stage_id,
          going: !!r.going,
          responded_at: r.responded_at,
        }
      }
      setMine(map)

      const { data: auth } = await supabase.auth.getUser()
      const uid = auth?.user?.id
      if (uid) {
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("nome,categoria,category")
          .eq("id", uid)
          .single()
        if (!pErr) setProfile((p as any) ?? null)
      }
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function pillFor(my?: MyParticipation) {
    if (!my)
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
          Sem resposta
        </span>
      )
    if (my.going)
      return (
        <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 border border-green-400/30">
          Confirmado
        </span>
      )
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-400/30">
        Recusado
      </span>
    )
  }

  async function setGoing(stageId: any, going: boolean) {
    const current = mine[String(stageId)]
    if (current && current.going === going) {
      showNotice(
        going ? "ok" : "warn",
        going
          ? "Você já confirmou presença nesta etapa."
          : "Você já marcou que não vai participar desta etapa."
      )
      return
    }

    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.rpc("set_stage_participation", {
        p_stage_id: stageId,
        p_going: going,
      })
      if (error) {
        const msg = (error.message || "").toLowerCase()
        if (msg.includes("signup_not_open_yet")) {
          throw new Error("Inscrições ainda não abriram para esta etapa.")
        }
        throw new Error(error.message)
      }

      await load()

      if (going) showNotice("ok", "Obrigado pela confirmação — você confirmou presença nesta etapa.")
      else showNotice("warn", "Obrigado pela confirmação — você recusou a inscrição desta etapa.")
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      setError(msg)
      showNotice("err", msg)
    } finally {
      setLoading(false)
    }
  }

  function btnClass(active: boolean) {
    return (
      "btn-ghost " +
      (active ? " ring-2 ring-gripoOrange/60 bg-gripoOrange/15 border border-gripoOrange/40" : "")
    )
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-lg font-bold">Etapas com inscrições abertas</div>
        <div className="text-xs text-slate-300">Marque sua participação (vou / não vou).</div>
        <div className="mt-2 text-sm">
          Sua categoria: <b>{myCategory}</b>
        </div>
      </div>

      {myCategory === "-" && (
        <div className="card border border-yellow-400/30 bg-yellow-500/10">
          Sua categoria ainda não foi definida. Peça para o admin definir na aprovação.
        </div>
      )}

      {notice && (
        <div
          className={
            "card border " +
            (noticeKind === "ok"
              ? "border-green-400/40 bg-green-500/10"
              : noticeKind === "warn"
              ? "border-yellow-400/40 bg-yellow-500/10"
              : "border-red-400/40 bg-red-500/10")
          }
        >
          {notice}
        </div>
      )}

      {error && (
        <div className="card border border-red-500/40 bg-red-500/10">
          <b>Erro:</b> {error}
        </div>
      )}

      {openStages.length === 0 && !loading && (
        <div className="card text-slate-300">Nenhuma etapa aberta no momento.</div>
      )}

      {openStages.map((s) => {
        const my = mine[String(s.id)]
        const myLabel = my ? (my.going ? "Vou" : "Não vou") : "Ainda não respondeu"
        const activeVou = !!my && my.going === true
        const activeNao = !!my && my.going === false

        return (
          <div key={s.id} className="card space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <span>
                    {s.stage_no ? `#${s.stage_no} ` : ""}
                    {s.name}
                  </span>
                  {pillFor(my)}
                </div>

                <div className="text-sm">
                  Data da etapa: <b>{fmtDateBR(s.starts_on)}</b>
                </div>

                <div className="text-sm">
                  Sua resposta: <b>{myLabel}</b>
                  {my?.responded_at ? (
                    <span className="text-xs text-slate-300"> — {fmtTs(my.responded_at)}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2 md:pt-1">
                <button
                  className={btnClass(activeVou)}
                  disabled={loading}
                  onClick={() => void setGoing(s.id, true)}
                  title="Confirmar presença"
                >
                  Vou
                </button>
                <button
                  className={btnClass(activeNao)}
                  disabled={loading}
                  onClick={() => void setGoing(s.id, false)}
                  title="Recusar inscrição"
                >
                  Não vou
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}