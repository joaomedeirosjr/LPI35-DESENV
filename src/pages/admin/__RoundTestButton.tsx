import { supabase } from "../../lib/supabase"

const STAGE_ID = 5

// IDs atuais (ajuste se mudar)
const ROUND_ID = "12470d7b-326f-4c7d-9af1-4401fe27bb27"
const GROUP_ID = "eebf4321-7e3d-4bbb-9a8e-17474d08cccb"

// Match de teste (slot 1)
const TEST_MATCH_ID = "b6f639e4-c044-4aa0-9b2b-3bfb107ea9ce"

export default function RoundTestButton() {
  async function rpc(name: string, args: any) {
    const { data, error } = await supabase.rpc(name, args)
    console.log("RPC", name, { args, data, error })
    if (error) throw error
    return data
  }

  async function criarRodada() {
    try {
      const id = await rpc("admin_create_round", {
        p_stage_id: STAGE_ID,
        p_round_no: 99,
        p_name: "Rodada Teste",
        p_mode: "fixed_pairs",
        p_groups: [{ cat_a: "A", cat_b: "B", label: "A+B", sort_order: 1 }]
      })
      alert("Rodada criada! ID: " + id)
    } catch (e: any) {
      alert("Erro: " + (e?.message || String(e)))
    }
  }

  async function sortearDuplasAB() {
    try {
      const n = await rpc("admin_draw_fixed_pairs_for_group", {
        p_round_id: ROUND_ID,
        p_group_id: GROUP_ID,
        p_clear_existing: true
      })
      alert("Duplas criadas: " + n)
    } catch (e: any) {
      alert("Erro: " + (e?.message || String(e)))
    }
  }

  async function gerarJogos() {
    try {
      const n = await rpc("admin_generate_matches_fixed_pairs_round_robin", {
        p_round_id: ROUND_ID,
        p_clear_existing: true,
        p_max_consecutive: 2
      })
      alert("Jogos criados: " + n)
    } catch (e: any) {
      alert("Erro: " + (e?.message || String(e)))
    }
  }

  async function match1InProgress() {
    try {
      const ok = await rpc("admin_upsert_match_result", {
        p_match_id: TEST_MATCH_ID,
        p_status: "in_progress",
        p_team1_score: 0,
        p_team2_score: 0
      })
      alert("Match #1 - in_progress. OK=" + ok)
    } catch (e: any) {
      alert("Erro: " + (e?.message || String(e)))
    }
  }

  async function match1Played6x4() {
    try {
      const ok = await rpc("admin_upsert_match_result", {
        p_match_id: TEST_MATCH_ID,
        p_status: "played",
        p_team1_score: 6,
        p_team2_score: 4
      })
      alert("Match #1 - played (6x4). OK=" + ok)
    } catch (e: any) {
      alert("Erro: " + (e?.message || String(e)))
    }
  }

  return (
    <div className="card">
      <div className="text-sm text-slate-300">Teste Rodada (DEV)</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn" onClick={criarRodada}>Criar Rodada (teste)</button>
        <button className="btn" onClick={sortearDuplasAB}>Sortear Duplas A+B</button>
        <button className="btn" onClick={gerarJogos}>Gerar Jogos (todas vs todas)</button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn" onClick={match1InProgress}>Match #1 - in_progress</button>
        <button className="btn" onClick={match1Played6x4}>Match #1 - played (6x4)</button>
      </div>

      <div className="mt-3 text-xs text-slate-400 break-all">
        stage_id={STAGE_ID} | round_id={ROUND_ID} | group_id={GROUP_ID} | match_id={TEST_MATCH_ID}
      </div>
    </div>
  )
}