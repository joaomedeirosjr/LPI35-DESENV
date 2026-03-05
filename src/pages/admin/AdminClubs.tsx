import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ClubStatus = 'active' | 'inactive'

type ClubRow = {
  id: string
  name: string
  city: string | null
  status: ClubStatus
  courts_count: number | null
  created_at: string
  updated_at: string
}

const statusOptions: ClubStatus[] = ['active', 'inactive']

export default function AdminClubs() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ClubRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<ClubRow | null>(null)
  const [form, setForm] = useState({ name: '', city: '', status: 'active' as ClubStatus, courts_count: 1 })

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('clubs').select('*').order('name', { ascending: true })
    if (error) setError(error.message)
    setRows((data as ClubRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  function reset() {
    setEditing(null)
    setForm({ name: '', city: '', status: 'active', courts_count: 1 })
  }

  function edit(r: ClubRow) {
    setEditing(r)
    setForm({ name: r.name ?? '', city: r.city ?? '', status: r.status ?? 'active', courts_count: (r as any).courts_count ?? 1 })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload: any = {
      name: form.name.trim(),
      city: form.city.trim() === '' ? null : form.city.trim(),
      status: form.status,
      courts_count: Number(form.courts_count) || 1,
    }

    const res = editing
      ? await supabase.from('clubs').update(payload).eq('id', editing.id).select('*').single()
      : await supabase.from('clubs').insert(payload).select('*').single()

    if (res.error) {
      setError(res.error.message)
      setLoading(false)
      return
    }

    await load()
    reset()
    setLoading(false)
  }

  async function remove(id: string) {
    if (!confirm('Remover este clube?')) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.from('clubs').delete().eq('id', id)
    if (error) setError(error.message)
    await load()
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-300">Cadastro</div>
          <div className="text-lg font-bold">Clubes</div>
        </div>
        <button className="btn" onClick={reset} disabled={loading}>+ Novo clube</button>
      </div>

      {error && (
        <div className="card border border-red-400/40 bg-red-500/10">
          <b>Erro:</b> {error}
        </div>
      )}

      <form onSubmit={save} className="card space-y-3">
        <div className="font-bold">{editing ? 'Editar clube' : 'Criar clube'}</div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <div className="text-xs text-slate-300">Nome</div>
            <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Cidade</div>
            <input className="input w-full" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ibirubá" />
          </label>



          <label className="space-y-1">
            <div className="text-xs text-slate-300">Quadras (total)</div>
            <input
              className="input w-full"
              type="number"
              min={1}
              step={1}
              value={(form as any).courts_count}
              onChange={(e) => setForm({ ...form, courts_count: Number(e.target.value) })}
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-300">Status</div>
            <select className="input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button className="btn" type="submit" disabled={loading}>{editing ? 'Salvar' : 'Criar'}</button>
          {editing && <button className="btn-ghost" type="button" onClick={reset} disabled={loading}>Cancelar</button>}
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="text-left text-xs text-slate-300">
            <tr>
              <th className="py-2">Nome</th>
              <th className="py-2">Cidade</th>
              <th className="py-2">Quadras</th>
              <th className="py-2">Status</th>
              <th className="py-2 w-[220px]">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="py-2">{r.name}</td>
                <td className="py-2">{r.city ?? '-'}</td>
                <td className="py-2">{(r as any).courts_count ?? 1}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={() => edit(r)} disabled={loading}>Editar</button>
                    <button className="btn-danger" onClick={() => remove(r.id)} disabled={loading}>Remover</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5} className="py-3 text-slate-300">Nenhum clube cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}