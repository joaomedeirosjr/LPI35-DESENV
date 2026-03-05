import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Profile = {
  id: string
  nome: string | null
  email: string | null
  categoria?: string | null
  category?: string | null
  approved?: boolean | null
}

export default function AthleteHome() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) {
          throw new Error("Sessão expirada. Faça login novamente.")
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, email, categoria, category, approved")
          .eq("id", user.id)
          .single()

        if (error) throw new Error(error.message)

        if (mounted) setProfile((data as any) ?? null)
      } catch (e: any) {
        if (mounted) setError(e?.message ?? String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [])

  const cat = (profile as any)?.categoria ?? (profile as any)?.category ?? "-"

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-lg font-bold">Início</div>
        <div className="text-xs text-slate-300">Sua área de atleta foi liberada pelo admin.</div>
      </div>

      {error && (
        <div className="card border border-red-500/40 bg-red-500/10">
          <b>Erro:</b> {error}
        </div>
      )}

      {loading && (
        <div className="card text-slate-200">Carregando...</div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card">
            <div className="text-xs text-slate-300">Atleta</div>
            <div className="text-lg font-bold">{profile?.nome ?? "-"}</div>
            <div className="text-xs text-slate-300">{profile?.email ?? "-"}</div>
          </div>

          <div className="card">
            <div className="text-xs text-slate-300">Categoria</div>
            <div className="text-lg font-bold">{cat}</div>
            <div className="text-xs text-slate-300">Definida na aprovação</div>
          </div>

          <div className="card">
            <div className="text-xs text-slate-300">Status</div>
            <div className="text-lg font-bold">{profile?.approved ? "Aprovado" : "Pendente"}</div>
            <div className="text-xs text-slate-300">{profile?.approved ? "Acesso liberado" : "Aguardando liberação"}</div>
          </div>
        </div>
      )}
    </div>
  )
}