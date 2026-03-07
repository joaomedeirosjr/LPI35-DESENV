import { useState } from "react"
import { supabase } from "../../lib/supabase"

type Profile = {
  id: string
  nome: string
  email: string
}

export default function AdminAthleteRegistry() {

  const [search,setSearch] = useState("")
  const [loading,setLoading] = useState(false)
  const [results,setResults] = useState<Profile[]>([])
  const [busy,setBusy] = useState(false)

  async function buscar() {

    if(!search){
      alert("Digite nome ou email")
      return
    }

    setLoading(true)

    const {data,error} = await supabase
      .from("profiles")
      .select("id,nome,email")
      .or(`nome.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(20)

    setLoading(false)

    if(error){
      alert(error.message)
      return
    }

    setResults(data || [])
  }

  async function excluir(userId:string,email:string){

    const ok = confirm(
      `Excluir cadastro do atleta?\n\n${email}\n\nEsta ação remove o usuário do sistema.`
    )

    if(!ok) return

    setBusy(true)

    const {data,error} = await supabase.rpc(
      "admin_delete_user",
      { p_user_id:userId }
    )

    setBusy(false)

    if(error){
      alert(error.message)
      return
    }

    alert("Usuário removido com sucesso")

    setResults(prev => prev.filter(x => x.id !== userId))
  }

  return (
    <div className="space-y-6">

      <div className="card space-y-3">

        <h1 className="text-xl font-bold">
          Excluir Cadastro de Atleta
        </h1>

        <p className="text-sm text-slate-300">
          Localize o atleta por nome ou email para remover o cadastro.
        </p>

        <div className="flex gap-2">

          <input
            className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10"
            placeholder="Nome ou email"
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />

          <button
            className="btn-primary"
            onClick={buscar}
          >
            Buscar
          </button>

        </div>

      </div>

      {loading && (
        <div className="card">
          Buscando...
        </div>
      )}

      {results.length > 0 && (

        <div className="card">

          <table className="w-full text-sm">

            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2">Nome</th>
                <th className="text-left py-2">Email</th>
                <th className="text-right py-2">Ação</th>
              </tr>
            </thead>

            <tbody>

              {results.map((p)=>(
                <tr
                  key={p.id}
                  className="border-b border-white/5"
                >

                  <td className="py-3">
                    {p.nome}
                  </td>

                  <td className="py-3 text-slate-300">
                    {p.email}
                  </td>

                  <td className="py-3 text-right">

                    <button
                      className="btn-danger"
                      disabled={busy}
                      onClick={()=>excluir(p.id,p.email)}
                    >
                      Excluir
                    </button>

                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>
  )
}