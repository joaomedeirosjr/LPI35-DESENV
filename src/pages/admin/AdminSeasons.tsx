import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type SeasonStatus = 'draft' | 'open' | 'closed' | 'archived'

type SeasonRow = {
  id: string
  name: string
  year: number | null
  status: SeasonStatus
  starts_on: string | null
  ends_on: string | null
  created_at: string
  updated_at: string
}

const statusOptions: SeasonStatus[] = ['draft', 'open', 'closed', 'archived']

export default function AdminSeasons() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SeasonRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<SeasonRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    year: '',
    status: 'draft' as SeasonStatus,
    starts_on: '',
    ends_on: '',
  })

  const isEditing = useMemo(() => !!editing, [editing])

  async function load() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    setRows((data as SeasonRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function resetForm() {
    setEditing(null)
    setForm({ name: '', year: '', status: 'draft', starts_on: '', ends_on: '' })
  }

  function startEdit(r: SeasonRow) {
    setEditing(r)
    setForm({
      name: r.name ?? '',
      year: r.year?.toString() ?? '',
      status: r.status ?? 'draft',
      starts_on: r.starts_on ?? '',
      ends_on: r.ends_on ?? '',
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload: any = {
      name: form.name.trim(),
      year: form.year.trim() === '' ? null : parseInt(form.year, 10),
      status: form.status,
      starts_on: form.starts_on.trim() === '' ? null : form.starts_on,
      ends_on: form.ends_on.trim() === '' ? null : form.ends_on,
    }

    const res = editing
      ? await supabase.from('seasons').update(payload).eq('id', editing.id).select('*').single()
      : await supabase.from('seasons').insert(payload).select('*').single()

    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }

    await load()
    resetForm()
    setLoading(false)
  }

  async function remove(id: string) {
    if (!confirm('Remover esta temporada?')) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('seasons').delete().eq('id', id)
    if (error) setError(error.message)

    await load()
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-300">Cadastro</div>
          <div className="text-lg font-bold">Temporadas</div>
        </div>
        <button className="btn" onClick={resetForm} disabled={loading}>+ Nova temporada</button>
      </div>

      {error && (
        <div className="card border border-red-400/40 bg-red-500/10">
          <b>Erro:</b> {error}
        </div>
      )}

      <form onSubmit={save} className="card space-y-3">
        <div className="font-bold">{isEditing ? 'Editar temporada' : 'Criar temporada'}</div>

        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 md:col-span-2">
            <div className="text-xs text-slate-300">Nome</div>
            <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Ano</div>
            <input className="input w-full" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2026" />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Status</div>
            <select className="input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Início</div>
            <input className="input w-full" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Fim</div>
            <input className="input w-full" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
          </label>
        </div>

        <div className="flex gap-2">
          <button className="btn" type="submit" disabled={loading}>{isEditing ? 'Salvar' : 'Criar'}</button>
          {isEditing && <button className="btn-ghost" type="button" onClick={resetForm} disabled={loading}>Cancelar</button>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="text-left text-xs text-slate-300">
            <tr>
              <th className="py-2">Nome</th>
              <th className="py-2">Ano</th>
              <th className="py-2">Status</th>
              <th className="py-2">Início</th>
              <th className="py-2">Fim</th>
              <th className="py-2 w-[180px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="py-2">{r.name}</td>
                <td className="py-2">{r.year ?? '-'}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">{r.starts_on ?? '-'}</td>
                <td className="py-2">{r.ends_on ?? '-'}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => startEdit(r)} disabled={loading}>Editar</button>
                    <button className="btn-ghost" onClick={() => remove(r.id)} disabled={loading}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="py-3 text-slate-300">Nenhuma temporada cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}