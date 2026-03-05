import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminGenerateInvite() {
  const [token,setToken] = useState<string | null>(null)
  const [loading,setLoading] = useState(false)

  async function gerar() {
    setLoading(true)

    const { data, error } = await supabase.rpc('generate_invite')

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    setToken(data)
  }

  const link = token
    ? window.location.origin + '/signup?token=' + token
    : null

  async function copiar() {
    if (link) {
      await navigator.clipboard.writeText(link)
      alert('Link copiado!')
    }
  }

  return (
    <div className='space-y-4 text-white'>
      <h1 className='text-2xl font-bold'>Gerar Convite</h1>

      <button
        onClick={gerar}
        disabled={loading}
        className='px-4 py-2 rounded-xl bg-emerald-600'
      >
        {loading ? 'Gerando...' : 'Gerar convite'}
      </button>

      {link && (
        <div className='space-y-2'>
          <div className='text-sm text-slate-300'>Link do convite:</div>

          <div className='p-3 bg-slate-900 rounded-xl break-all'>
            {link}
          </div>

          <button
            onClick={copiar}
            className='px-3 py-2 rounded-lg bg-blue-600'
          >
            Copiar link
          </button>
        </div>
      )}
    </div>
  )
}
