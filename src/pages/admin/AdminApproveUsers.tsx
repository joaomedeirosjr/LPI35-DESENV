import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Category = 'A' | 'B' | 'C' | 'D'

type ProfileRow = {
  id: string
  nome: string | null
  email: string | null
  created_at: string | null

  approved: boolean | null
  approved_at: string | null
  approved_by: string | null

  rejected_at: string | null
  rejected_by: string | null
  reject_reason: string | null

  category: Category | null
  birth_date: string | null

  play_side: 'right' | 'left' | null}

function fmtDT(s?: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString('pt-BR')
}



function formatIsoToBr(iso?: string | null) {
  if (!iso) return '(não informado)'
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso)
  if (!m) return '(não informado)'
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatPlaySide(v: 'right' | 'left' | null | undefined): string {
  if (!v) return '(não informado)'
  return v === 'right' ? 'Direito' : 'Esquerdo'
}


function parseBrToIso(br: string): { iso: string | null; error: string | null } {
  const raw = (br || '').trim()
  if (!raw) return { iso: null, error: 'Informe a data de nascimento.' }

  const m = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(raw)
  if (!m) return { iso: null, error: 'Formato inválido. Use dd/mm/aaaa.' }

  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])

  if (yyyy < 1900 || yyyy > 2100) return { iso: null, error: 'Ano inválido.' }
  if (mm < 1 || mm > 12) return { iso: null, error: 'Mês inválido.' }
  if (dd < 1 || dd > 31) return { iso: null, error: 'Dia inválido.' }

  const iso = `${String(yyyy).padStart(4,'0')}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`

  // valida data real (ex.: 31/02)
  const dt = new Date(iso + 'T00:00:00Z')
  const ok =
    dt.getUTCFullYear() === yyyy &&
    (dt.getUTCMonth() + 1) === mm &&
    dt.getUTCDate() === dd
  if (!ok) return { iso: null, error: 'Data inválida.' }

  // não permitir futuro
  const todayIso = new Date().toISOString().slice(0, 10)
  if (iso > todayIso) return { iso: null, error: 'Data não pode ser no futuro.' }

  return { iso, error: null }
}

function byName(a: ProfileRow, b: ProfileRow) {
  const an = String(a?.nome || '').trim()
  const bn = String(b?.nome || '').trim()
  return an.localeCompare(bn, 'pt-BR', { sensitivity: 'base' })
}

export default function AdminApproveUsers() {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [rows, setRows] = useState<ProfileRow[]>([])
  const [approverNames, setApproverNames] = useState<Record<string, string>>({})

  // modal categoria (aprovar/alterar)
  const [catOpen, setCatOpen] = useState(false)
  const [catUser, setCatUser] = useState<ProfileRow | null>(null)
  const [catValue, setCatValue] = useState<Category>('B')
  const [catReason, setCatReason] = useState('Definição inicial')


  // modal nascimento (admin)
  const [birthOpen, setBirthOpen] = useState(false)
  const [birthUser, setBirthUser] = useState<ProfileRow | null>(null)
  const [birthValue, setBirthValue] = useState('')

  const [sideOpen, setSideOpen] = useState(false)
  const [sideUser, setSideUser] = useState<UserRow | null>(null)
  const [sideValue, setSideValue] = useState<'right' | 'left' | ''>('')

  // modal reprovar
  const [rejOpen, setRejOpen] = useState(false)
  const [rejUser, setRejUser] = useState<ProfileRow | null>(null)
  const [rejReason, setRejReason] = useState('spam')

  // FILTROS (UI)
  const [filterText, setFilterText] = useState('')
  const [filterCategory, setFilterCategory] = useState<'A' | 'B' | 'C' | 'D' | ''>('')
  const [onlyMissing, setOnlyMissing] = useState(false)

  function openSetCategory(u: ProfileRow) {
    setCatUser(u)
    setCatValue((u.category || 'B') as Category)
    setCatReason(u.approved ? 'Ajuste de categoria' : 'Definição inicial')
    setCatOpen(true)
  }


  function openBirth(u: ProfileRow) {
    setBirthUser(u)
    setBirthValue(formatIsoToBr(u.birth_date))
    setBirthOpen(true)
  }

  function openReject(u: ProfileRow) {
    setRejUser(u)
    setRejReason('spam')
    setRejOpen(true)
  }

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id,nome,email,created_at,approved,approved_at,approved_by,category,birth_date,play_side,rejected_at,rejected_by,reject_reason'
        )
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error
      const list = (data || []) as ProfileRow[]
      setRows(list)

      // resolve nomes de quem aprovou/reprovou (pelo id)
      const ids = Array.from(
        new Set(
          list
            .flatMap((r) => [r.approved_by, r.rejected_by])
            .filter((x): x is string => !!x)
        )
      )

      if (ids.length) {
        const { data: who, error: e2 } = await supabase
          .from('profiles')
          .select('id,nome,play_side')
          .in('id', ids)

        if (!e2 && who) {
          const map: Record<string, string> = {}
          for (const p of who as any[]) map[p.id] = p.nome || '(sem nome)'
          setApproverNames(map)
        }
      }
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendentes = useMemo(
    () =>
      rows
        .filter((r) => !r.rejected_at && !r.approved)
        .slice()
        .sort(byName),
    [rows]
  )

  const aprovados = useMemo(
    () =>
      rows
        .filter((r) => !r.rejected_at && !!r.approved)
        .slice()
        .sort(byName),
    [rows]
  )

  const reprovados = useMemo(
    () =>
      rows
        .filter((r) => !!r.rejected_at)
        .slice()
        .sort(byName),
    [rows]
  )

  function norm(s: string) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

    function matchesFilters(u: ProfileRow) {
    if (filterCategory && (u.category || '') !== filterCategory) return false

    if (onlyMissing) {
      const missingBirth = !u.birth_date
      const missingSide = !u.play_side
      if (!(missingBirth || missingSide)) return false
    }

    const q = norm(filterText)
    if (!q) return true
    const hay = norm(`${u.nome || ''} ${u.email || ''}`)
  }


  const pendentesF = pendentes.filter(matchesFilters)
  const aprovadosF = aprovados.filter(matchesFilters)
  const reprovadosF = reprovados.filter(matchesFilters)
  async function approveWithCategory() {
    if (!catUser) return
    setLoading(true)
    setErr(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Sessão inválida (sem usuário logado).')

      const patch: any = {
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: uid,
        rejected_at: null,
        rejected_by: null,
        reject_reason: null,
        category: catValue,
      }

      const { error } = await supabase.from('profiles').update(patch).eq('id', catUser.id)
      if (error) throw error

      setCatOpen(false)
      setCatUser(null)
      await load()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function rejectUser() {
    if (!rejUser) return
    setLoading(true)
    setErr(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess?.session?.user?.id
      if (!uid) throw new Error('Sessão inválida (sem usuário logado).')

      const patch: any = {
        approved: false,
        rejected_at: new Date().toISOString(),
        rejected_by: uid,
        reject_reason: String(rejReason || 'reprovado'),
      }

      const { error } = await supabase.from('profiles').update(patch).eq('id', rejUser.id)
      if (error) throw error

      setRejOpen(false)
      setRejUser(null)
      await load()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }


  async function saveBirthDate() {
    if (!birthUser) return
    setLoading(true)
    setErr(null)
    try {
      const { iso, error: vErr } = parseBrToIso(birthValue)
      if (vErr) throw new Error(vErr)

      // RPC admin (deve existir no banco): public.admin_set_birth_date(p_user_id uuid, p_birth_date date)
      const { data, error } = await supabase.rpc('admin_set_birth_date', {
        p_user_id: birthUser.id,
        p_birth_date: iso,
      })

      if (error) throw error
      if (data !== true) throw new Error('Não foi possível atualizar a data (nenhuma linha afetada).')

      setBirthOpen(false)
      setBirthUser(null)
      await load()
    } catch (e: any) {
      setErr(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  function openSideModal(u: UserRow) {
    setSideUser(u)
    setSideValue((u.play_side || '') as any)
    setSideOpen(true)
  }

  async function saveSide() {
    if (!sideUser) return
    if (!sideValue) return setErr('Selecione o lado de jogo.')
    setLoading(true)
    setErr(null)

    // RPC admin (deve existir no banco):
    // public.admin_set_play_side(p_user_id uuid, p_play_side text)
    const { data, error } = await supabase.rpc('admin_set_play_side', {
      p_user_id: sideUser.id,
      p_play_side: sideValue,
    })

    if (error) {
      setErr(error.message || 'Falha ao salvar lado de jogo.')
      setLoading(false)
      return
    }

    // fecha e atualiza listagem
    setSideOpen(false)
    setSideUser(null)
    setSideValue('')
    await refresh()
    setLoading(false)
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <div className='text-2xl md:text-3xl font-extrabold'>Aprovar Atletas</div>
          <p className='text-slate-300 text-sm'>
            Pendentes: {pendentes.length} Aprovados: {aprovados.length} Reprovados: {reprovados.length}
          </p>
        </div>

        <button className='btn btn-ghost' onClick={load} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {err && (
        <div className='rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-100'>
          <div className='font-semibold'>Erro</div>
          <div className='text-sm opacity-90'>{err}</div>
        </div>
      )}

      {/* PENDENTES */}
      <section className='space-y-3'>
        <div className='card p-4 mb-3'>
        <div className='text-sm font-semibold mb-3'>Filtros</div>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          <div>
            <div className='text-xs text-slate-300 mb-1'>Buscar (nome/email)</div>
            <input
              className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder='Ex.: Romeu, joao@...'
            />
          </div>

          <div>
            <div className='text-xs text-slate-300 mb-1'>Categoria</div>
            <select
              className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
            >
              <option value=''>Todas</option>
              <option value='A'>A</option>
              <option value='B'>B</option>
              <option value='C'>C</option>
              <option value='D'>D</option>
            </select>
          </div>

          <div className='flex items-end'>
            <label className='flex items-center gap-2 text-sm text-slate-200 select-none'>
              <input
                type='checkbox'
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              Somente faltando dados (Nascimento ou Lado)
            </label>
          </div>
        </div>
      </div>
<div className='text-lg font-bold'>Pendentes</div>
        {pendentesF.length === 0 ? (
          <div className='card text-slate-200'>Nenhum atleta pendente.</div>
        ) : (
          <div className='space-y-3'>
            {pendentesF.map((u) => (
              <div key={u.id} className='card p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <div className='font-semibold whitespace-normal break-normal'>{u.nome || '(sem nome)'}</div>
                    <div className='text-xs text-slate-300 mt-1'>Categoria: {u.category || ''}</div>
                    <div className='text-xs text-slate-300 mt-1'>Nascimento: {formatIsoToBr(u.birth_date)}</div>
                    <div className='text-xs text-slate-300 mt-1'>Lado: {formatPlaySide(u.play_side)}</div>
                    <div className='text-xs text-slate-400 mt-2'>
                      {u.approved_at ? (
                        <>
                          Aprovado em: {fmtDT(u.approved_at)} por:{' '}
                          {u.approved_by ? (approverNames[u.approved_by] || u.approved_by) : '(desconhecido)'}
                        </>
                      ) : (
                        'Aprovado'
                      )}
                    </div>
                  </div>

                  <div className='flex flex-wrap items-center justify-end gap-2'>
                    <button className='btn' onClick={() => openSetCategory(u)} disabled={loading}>
                      Aprovar
                    </button>
                    <button className='btn btn-ghost' onClick={() => openBirth(u)} disabled={loading}>
                      Editar nascimento
                    </button>
                    <button className='btn btn-ghost' onClick={() => openReject(u)} disabled={loading}>
                      Reprovar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* APROVADOS (cards são com nome + categoria) */}
      <section className='space-y-3'>
        <div className='text-lg font-bold'>Aprovados</div>

        {aprovadosF.length === 0 ? (
          <div className='card text-slate-200'>Nenhum atleta aprovado.</div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
            {aprovadosF.map((u) => (
              <div key={u.id} className='card p-4'>
                <div className='flex items-start gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='font-semibold whitespace-nowrap'>{u.nome || '(sem nome)'}</div>
                    <div className='text-xs text-slate-300 mt-1'>Categoria: {u.category || ''}</div>
                    <div className='text-xs text-slate-300 mt-1'>Nascimento: {formatIsoToBr(u.birth_date)}</div>
                    <div className='text-xs text-slate-300 mt-1'>Lado: {formatPlaySide(u.play_side)}</div>
                    <div className='text-xs text-slate-400 mt-2'>
                      {u.approved_at ? (
                        <>
                          Aprovado em: {fmtDT(u.approved_at)} por:{' '}
                          {u.approved_by ? (approverNames[u.approved_by] || u.approved_by) : '(desconhecido)'}
                        </>
                      ) : (
                        'Aprovado'
                      )}
                    </div>
                  </div>

                  <div className='shrink-0 flex flex-col items-end gap-2'>
<button className='btn' onClick={() => openSetCategory(u)} disabled={loading}>Alterar Cat</button>
                    <button className='btn btn-ghost' onClick={() => openBirth(u)} disabled={loading}>
                      Editar nascimento
                    </button>
                    <button className='btn btn-ghost whitespace-nowrap !py-2 !px-4' onClick={() => openSideModal(u)} disabled={loading}>
                      Editar lado
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* REPROVADOS */}
      <section className='space-y-3'>
        <div className='text-lg font-bold'>Reprovados</div>
        {reprovadosF.length === 0 ? (
          <div className='card text-slate-200'>Nenhum atleta reprovado.</div>
        ) : (
          <div className='space-y-3'>
            {reprovadosF.map((u) => (
              <div key={u.id} className='card p-4'>
                <div className='flex items-start gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='font-semibold whitespace-nowrap'>{u.nome || '(sem nome)'}</div>
                    <div className='text-xs text-slate-400'>
                      Reprovado em: {fmtDT(u.rejected_at)} por:{' '}
                      {u.rejected_by ? (approverNames[u.rejected_by] || u.rejected_by) : '(desconhecido)'}
                      {u.reject_reason ? <> motivo: {u.reject_reason}</> : null}
                    </div>
                  </div>

                  <span className='px-2 py-1 rounded-lg text-xs border border-red-500/30 bg-red-500/10 text-red-100'>
                    Reprovado
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>


      {/* MODAL: EDITAR NASCIMENTO (ADMIN) */}
      {birthOpen && birthUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='w-full max-w-xl card'>
            <div className='text-xl font-extrabold'>Editar nascimento</div>
            <div className='text-sm text-slate-300'>
              {(birthUser.nome || '(sem nome)')}{' '}
              {birthUser.email ? <span className='opacity-80'>({birthUser.email})</span> : null}
            </div>

            <div className='mt-4'>
              <div className='text-xs text-slate-300 mb-1'>Data de nascimento (dd/mm/aaaa)</div>
              <input
                className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
                value={birthValue}
                onChange={(e) => setBirthValue(e.target.value)}
                placeholder='dd/mm/aaaa'
                inputMode='numeric'
              />
            </div>

            {err && (
              <div className='mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100 text-sm'>
                {err}
              </div>
            )}

            <div className='mt-5 flex items-center justify-end gap-3'>
              <button
                className='btn btn-ghost'
                onClick={() => {
                  setBirthOpen(false)
                  setBirthUser(null)
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button className='btn' onClick={saveBirthDate} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DEFINIR/ALTERAR CATEGORIA (aprovar também) */}
      {catOpen && catUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='w-full max-w-xl card'>
            <div className='text-xl font-extrabold'>Definir categoria</div>
            <div className='text-sm text-slate-300'>
              {(catUser.nome || '(sem nome)')}{' '}
              {catUser.email ? <span className='opacity-80'>({catUser.email})</span> : null}
            </div>

            <div className='mt-4 grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div>
                <div className='text-xs text-slate-300 mb-1'>Categoria</div>
                <select
                  className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
                  value={catValue}
                  onChange={(e) => setCatValue(e.target.value as Category)}
                >
                  <option value='A'>A</option>
                  <option value='B'>B</option>
                  <option value='C'>C</option>
                  <option value='D'>D</option>
                </select>
              </div>

              <div>
                <div className='text-xs text-slate-300 mb-1'>Motivo</div>
                <input
                  className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
                  value={catReason}
                  onChange={(e) => setCatReason(e.target.value)}
                  placeholder='Ex.: Definição inicial'
                />
              </div>
            </div>

            {err && (
              <div className='mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100 text-sm'>
                {err}
              </div>
            )}

            <div className='mt-5 flex items-center justify-end gap-3'>
              <button
                className='btn btn-ghost'
                onClick={() => {
                  setCatOpen(false)
                  setCatUser(null)
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button className='btn' onClick={approveWithCategory} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REPROVAR */}
      {rejOpen && rejUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='w-full max-w-xl card'>
            <div className='text-xl font-extrabold'>Reprovar atleta</div>
            <div className='text-sm text-slate-300'>{rejUser.nome || '(sem nome)'}</div>

            <div className='mt-4'>
              <div className='text-xs text-slate-300 mb-1'>Motivo</div>
              <input
                className='w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2'
                value={rejReason}
                onChange={(e) => setRejReason(e.target.value)}
                placeholder='Ex.: spam'
              />
            </div>

            {err && (
              <div className='mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100 text-sm'>
                {err}
              </div>
            )}

            <div className='mt-5 flex items-center justify-end gap-3'>
              <button
                className='btn btn-ghost'
                onClick={() => {
                  setRejOpen(false)
                  setRejUser(null)
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button className='btn' onClick={rejectUser} disabled={loading}>
                {loading ? 'Salvando...' : 'Reprovar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR LADO DE JOGO (ADMIN) */}
      {sideOpen && sideUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
          <div className='w-full max-w-xl card p-4'>
            <div className='text-xl font-extrabold'>Editar lado de jogo</div>
            <div className='text-sm text-slate-300 mt-1'>
              {(sideUser.nome || '(sem nome)')}{' '}
              {sideUser.email ? <span className='opacity-80'>({sideUser.email})</span> : null}
            </div>

            <div className='mt-4'>
              <label className='text-slate-300 text-xs'>Lado de jogo</label>
              <select
                className='input w-full'
                value={sideValue}
                onChange={(e) => setSideValue(e.target.value as any)}
              >
                <option value=''>Selecione...</option>
                <option value='right'>Direito</option>
                <option value='left'>Esquerdo</option>
              </select>
            </div>

            {err && (
              <div className='mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-100 text-sm'>
                {err}
              </div>
            )}

            <div className='mt-5 flex items-center justify-end gap-3'>
              <button
                className='btn btn-ghost'
                onClick={() => {
                  setSideOpen(false)
                  setSideUser(null)
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button className='btn' onClick={saveSide} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}