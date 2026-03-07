import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type InviteRow = {
  id: number
  token: string
  created_at: string
  expires_at: string
  uses: number
  max_uses: number
  revoked: boolean
  revoked_at: string | null
  used_at: string | null
  used_by: string | null
  used_by_nome: string | null
  used_by_email: string | null
  status: 'ativo' | 'usado' | 'expirado' | 'revogado' | string
}

function fmt(dt?: string | null) {
  if (!dt) return '-'
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return dt
  }
}

function shortToken(t: string) {
  if (!t) return ''
  if (t.length <= 12) return t
  return t.slice(0, 6) + '' + t.slice(-6)
}

function statusStyle(s: string) {
  if (s === 'ativo') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
  if (s === 'usado') return 'bg-slate-500/10 border-slate-500/30 text-slate-200'
  if (s === 'expirado') return 'bg-red-500/10 border-red-500/30 text-red-200'
  if (s === 'revogado') return 'bg-orange-500/10 border-orange-500/30 text-orange-200'
  return 'bg-white/5 border-white/10 text-slate-200'
}

export default function AdminInvite() {
  const origin = useMemo(() => window.location.origin, [])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<InviteRow[]>([])
  const [limit, setLimit] = useState(100)

  const [days, setDays] = useState(1)
  const [maxUses, setMaxUses] = useState(1)
  const [batchCount, setBatchCount] = useState(10)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_invites', { p_limit: limit })
    if (error) {
      setLoading(false)
      alert(error.message)
      return
    }
    setRows((data || []) as InviteRow[])
    setLoading(false)
  }

  async function gerarUm() {
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_generate_invite', {
      p_days: days,
      p_max_uses: maxUses,
    })
    setBusy(false)
    if (error) return alert(error.message)

    const created = Array.isArray(data) ? data[0] : data
    if (created?.token) {
      const link = origin + '/signup?token=' + created.token
      try {
        await navigator.clipboard.writeText(link)
      } catch {}
      alert('Convite gerado (link copiado):\n' + link)
    }
    load()
  }

  async function gerarLote() {
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_generate_invites', {
      p_count: batchCount,
      p_days: days,
      p_max_uses: maxUses,
    })
    setBusy(false)
    if (error) return alert(error.message)

    const list = (data || []) as any[]
    if (list.length > 0) {
      const links = list
        .filter((x) => x?.token)
        .map((x) => origin + '/signup?token=' + x.token)
        .join('\n')
      try {
        await navigator.clipboard.writeText(links)
      } catch {}
      alert('Lote gerado (links copiados). Total: ' + list.length)
    }
    load()
  }

  async function copiarLink(token: string) {
    const link = origin + '/signup?token=' + token
    try {
      await navigator.clipboard.writeText(link)
      alert('Link copiado:\n' + link)
    } catch {
      alert('Não foi possível copiar automaticamente.\n' + link)
    }
  }

  async function revogar(id: number, status: string) {
    if (status === 'revogado' || status === 'expirado' || status === 'usado') return
    const ok = confirm('Revogar este convite?')
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.rpc('revoke_invite', { p_id: id })
    setBusy(false)
    if (error) return alert(error.message)
    load()
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  return (
    <div className="w-full space-y-6 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Convites</h1>
          <p className="text-slate-300 text-sm">Geração e controle (padrão: 1 dia)</p>
        </div>

        <button className="btn-ghost w-full sm:w-auto" onClick={load} disabled={loading || busy}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card space-y-3 md:col-span-2 min-w-0">
          <div className="font-semibold">Gerar convites</div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 min-w-0">
              <label className="text-xs text-slate-300">Validade (dias)</label>
              <input
                type="number"
                min={1}
                max={30}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange"
                value={days}
                onChange={(e) => setDays(Number(e.target.value || 1))}
              />
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-xs text-slate-300">Usos máximos</label>
              <input
                type="number"
                min={1}
                max={50}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value || 1))}
              />
            </div>

            <div className="space-y-1 min-w-0">
              <label className="text-xs text-slate-300">Qtd. lote</label>
              <input
                type="number"
                min={1}
                max={200}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange"
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value || 10))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button className="btn-primary w-full sm:w-auto" onClick={gerarUm} disabled={busy}>
              {busy ? 'Gerando...' : 'Gerar 1 (copia link)'}
            </button>
            <button className="btn-ghost w-full sm:w-auto" onClick={gerarLote} disabled={busy}>
              {busy ? 'Gerando...' : 'Gerar em lote (copia lista)'}
            </button>
          </div>

          <div className="text-xs text-slate-400 break-words">
            Gerar em lote copia todos os links (um por linha) para colar no WhatsApp.
          </div>
        </div>

        <div className="card space-y-2 min-w-0">
          <div className="font-semibold">Lista</div>

          <div className="space-y-1 min-w-0">
            <label className="text-xs text-slate-300">Quantidade</label>
            <select
              className="w-full p-2 rounded-xl bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-gripoOrange"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">Mostrando: {rows.length} convites</div>
        </div>
      </div>

      <div className="space-y-2 min-w-0">
        <div className="text-sm font-semibold text-slate-200">últimos convites</div>

        {loading && <div className="card text-slate-300">Carregando convites...</div>}

        {!loading && rows.length === 0 && <div className="card text-slate-300">Nenhum convite ainda.</div>}

        {!loading && rows.length > 0 && (
          <div className="card overflow-hidden min-w-0">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 min-w-[110px]">Status</th>
                    <th className="text-left py-3 px-3 min-w-[170px]">Token</th>
                    <th className="text-left py-3 px-3 min-w-[180px]">Validade</th>
                    <th className="text-left py-3 px-3 min-w-[110px]">Uso</th>
                    <th className="text-left py-3 px-3 min-w-[220px]">Utilizado por</th>
                    <th className="text-right py-3 px-3 min-w-[180px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 align-top">
                      <td className="py-3 px-3">
                        <span
                          className={
                            'inline-flex items-center px-2 py-1 rounded-lg border text-xs whitespace-nowrap ' +
                            statusStyle(r.status)
                          }
                        >
                          {r.status}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold break-all">{shortToken(r.token)}</div>
                        <div className="text-xs text-slate-400">ID: {r.id}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-200 break-words">Expira: {fmt(r.expires_at)}</div>
                        <div className="text-xs text-slate-400 break-words">Criado: {fmt(r.created_at)}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-200">{r.uses}/{r.max_uses}</div>
                        {r.used_at ? (
                          <div className="text-xs text-slate-400 break-words">em {fmt(r.used_at)}</div>
                        ) : (
                          <div className="text-xs text-slate-400"></div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {r.used_by ? (
                          <div className="min-w-0">
                            <div className="text-slate-200 font-semibold break-words">
                              {r.used_by_nome && r.used_by_nome.trim() ? r.used_by_nome : '(sem nome)'}
                            </div>
                            <div className="text-xs text-slate-300 break-all">
                              {r.used_by_email || r.used_by}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400"></div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                          <button className="btn-ghost w-full sm:w-auto" onClick={() => copiarLink(r.token)} disabled={busy}>
                            Copiar link
                          </button>

                          <button
                            className="btn-ghost w-full sm:w-auto"
                            onClick={() => revogar(r.id, r.status)}
                            disabled={busy || r.status === 'revogado' || r.status === 'expirado' || r.status === 'usado'}
                          >
                            Revogar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-2 text-xs text-slate-400 border-t border-white/10 break-words">
              Revogar fica desabilitado quando o convite já foi usado/expirou/está revogado.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}