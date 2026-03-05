import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as ReactDOM from "react-dom";

type SeasonRow = { id: string; name: string | null; created_at?: string | null };
type StageRow = { id: number; name: string | null; season_id: string | null };

type TabKey = "stage" | "season";
type Category = "A" | "B" | "C" | "D";

type StageRankingRow = {
  pos: number;
  profile_id: string;
  player_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  games_for: number;
  games_against: number;
  games_diff: number;
  stage_points: number;
  age_years: number | null;
};

type SeasonRankingRow = {
  pos: number;
  profile_id: string;
  player_name: string;
  total_points: number;
  stages_played: number;
};

type PlayerMatchRow = {
  match_id: string;
  round_id: string;
  group_id: string | null;
  court_no: number | null;
  slot_no: number | null;
  team_label: string;
  opp_label: string;
  games_for: number;
  games_against: number;
  result: "W" | "L" | "T";
  ended_at: string | null;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
      : tone === "warning"
      ? "bg-orange-500/15 text-orange-200 ring-orange-500/25"
      : "bg-white/10 text-white/80 ring-white/10";

  return (
    <span className={classNames("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", cls)}>
      {children}
    </span>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-full rounded bg-white/10" />
        </td>
      ))}
    </tr>
  );
}

function ResultPill({ r }: { r: "W" | "L" | "T" }) {
  const cls =
    r === "W"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
      : r === "L"
      ? "bg-orange-500/15 text-orange-200 ring-orange-500/25"
      : "bg-white/10 text-white/70 ring-white/10";
  const label = r === "W" ? "V" : r === "L" ? "D" : "E";
  return (
    <span className={classNames("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", cls)}>
      {label}
    </span>
  );
}

/**
 * Modal (Admin) — detalhes do atleta na etapa (jogos played)
 */
function PlayerDetailsModal({
  open,
  onClose,
  stageId,
  category,
  player,
}: {
  open: boolean;
  onClose: () => void;
  stageId: number;
  category: string;
  player: { profile_id: string; player_name: string } | null;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<PlayerMatchRow[]>([]);

  useEffect(() => {
    if (!open || !player) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase.rpc("get_player_stage_matches", {
          p_stage_id: stageId,
          p_profile_id: player.profile_id,
        });
        if (error) throw error;
        setRows((data ?? []) as PlayerMatchRow[]);
      } catch (e: any) {
        setErr(e?.message ?? "Falha ao carregar jogos do atleta.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, player, stageId]);

  const summary = useMemo(() => {
    const played = rows.length;
    const wins = rows.filter((x) => x.result === "W").length;
    const losses = rows.filter((x) => x.result === "L").length;
    const gf = rows.reduce((a, x) => a + (Number(x.games_for ?? 0) || 0), 0);
    const ga = rows.reduce((a, x) => a + (Number(x.games_against ?? 0) || 0), 0);
    const winRate = played > 0 ? (wins / played) * 100 : 0;
    return { played, wins, losses, gf, ga, diff: gf - ga, winRate };
  }, [rows]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(980px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-2xl border border-white/10 bg-[#111827] shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-lg font-extrabold text-white">{player?.player_name}</div>
              <div className="mt-0.5 text-xs text-white/60">
                Etapa {stageId} • Categoria {category} • {summary.played} jogos • {summary.wins}V {summary.losses}D • Taxa{" "}
                {summary.winRate.toFixed(1)}% • {summary.diff >= 0 ? "+" : ""}
                {summary.diff} saldo
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-extrabold text-white hover:bg-[#374151]"
            >
              Fechar
            </button>
          </div>

          <div className="px-5 py-4">
            {err && (
              <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {err}
              </div>
            )}

            <div className="overflow-auto rounded-xl border border-white/10">
              <table className="min-w-[920px] w-full text-left">
                <thead className="bg-[#0f172a] text-xs font-bold text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3">RES</th>
                    <th className="px-4 py-3">SCORE</th>
                    <th className="px-4 py-3">MINHA DUPLA</th>
                    <th className="px-4 py-3">ADVERSÁRIOS</th>
                    <th className="px-4 py-3">QUADRA</th>
                    <th className="px-4 py-3">SLOT</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/60">
                        Carregando...
                      </td>
                    </tr>
                  )}

                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/60">
                        Nenhum jogo encontrado (precisa estar com status played).
                      </td>
                    </tr>
                  )}

                  {rows.map((m) => (
                    <tr key={m.match_id} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <ResultPill r={m.result} />
                      </td>
                      <td className="px-4 py-3 font-extrabold">
                        {m.games_for} x {m.games_against}
                      </td>
                      <td className="px-4 py-3 font-bold">{m.team_label}</td>
                      <td className="px-4 py-3 font-bold text-white/90">{m.opp_label}</td>
                      <td className="px-4 py-3">{m.court_no ?? "-"}</td>
                      <td className="px-4 py-3">{m.slot_no ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-white/50">
              * Detalhes usam jogos da etapa com status <b>played</b> e score oficial <b>{"{games_team1, games_team2, winner_side}"}</b>.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminRanking() {
  const [tab, setTab] = useState<TabKey>("stage");
  const [category, setCategory] = useState<Category>("B");

  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);

  const [seasonId, setSeasonId] = useState<string>("");
  const [stageId, setStageId] = useState<number>(0);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "error" | "off">("connecting");

  const [stageRows, setStageRows] = useState<StageRankingRow[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRankingRow[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ profile_id: string; player_name: string } | null>(null);

  // ---------- meta: seasons ----------
  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { data, error } = await supabase.from("seasons").select("id,name,created_at").order("created_at", { ascending: false });
        if (error) throw error;

        const list = (data ?? []) as SeasonRow[];
        setSeasons(list);
        if (!seasonId && list.length) setSeasonId(list[0].id);
      } catch (e: any) {
        setError(e?.message ?? "Falha ao carregar temporadas.");
      } finally {
        setLoadingMeta(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- meta: stages for selected season ----------
  useEffect(() => {
    if (!seasonId) return;

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { data, error } = await supabase.from("stages").select("id,name,season_id").eq("season_id", seasonId).order("id", { ascending: false });
        if (error) throw error;

        const list = (data ?? []) as StageRow[];
        setStages(list);

        const ids = new Set(list.map((s) => s.id));
        if (!stageId || !ids.has(stageId)) {
          if (list.length) setStageId(list[0].id);
        }
      } catch (e: any) {
        setError(e?.message ?? "Falha ao carregar etapas.");
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [seasonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSeason = useMemo(() => seasons.find((s) => s.id === seasonId), [seasons, seasonId]);
  const selectedStage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);

  /**
   * IMPORTANTE:
   * - AdminRanking agora lê das MESMAS VIEWS do RankingPublic
   *   => v_ranking_stage_players / v_ranking_season_players
   * - Assim os valores batem (e convidados não entram se as views já filtram)
   */
  async function fetchRanking() {
    setLoadingData(true);
    setError(null);

    try {
      if (tab === "stage") {
        if (!stageId) throw new Error("Selecione uma etapa.");

        const { data, error } = await supabase
          .from("v_ranking_stage_players")
          .select("stage_id,category,profile_id,player_name,matches_played,wins,losses,games_for,games_against,games_diff,age_years,position")
          .eq("stage_id", stageId)
          .eq("category", category)
          .order("position", { ascending: true });

        if (error) throw error;

        const rows: StageRankingRow[] = ((data ?? []) as any[]).map((r) => ({
          pos: Number(r.position ?? 0) || 0,
          profile_id: r.profile_id,
          player_name: r.player_name,
          matches_played: Number(r.matches_played ?? 0) || 0,
          wins: Number(r.wins ?? 0) || 0,
          losses: Number(r.losses ?? 0) || 0,
          games_for: Number(r.games_for ?? 0) || 0,
          games_against: Number(r.games_against ?? 0) || 0,
          games_diff: Number(r.games_diff ?? 0) || 0,
          age_years: r.age_years == null ? null : Number(r.age_years),
          stage_points: (Number(r.wins ?? 0) || 0) * 10,
        }));

        setStageRows(rows);
        setSeasonRows([]);
      } else {
        if (!seasonId) throw new Error("Selecione uma temporada.");

        // View da temporada pode ter coluna "position" ou "pos" (você já viu esse erro no app)
        // Então fazemos fallback automático.
        const trySelect = async (col: "position" | "pos") => {
          return await supabase
            .from("v_ranking_season_players")
            .select(`season_id,category,profile_id,player_name,total_points,stages_played,${col}`)
            .eq("season_id", seasonId)
            .eq("category", category)
            .order(col, { ascending: true });
        };

        let data: any[] | null = null;

        // 1) tenta "position"
        const a = await trySelect("position");
        if (!a.error) {
          data = (a.data ?? []) as any[];
        } else {
          // 2) fallback "pos"
          const b = await trySelect("pos");
          if (b.error) throw b.error;
          data = (b.data ?? []) as any[];
        }

        const rows: SeasonRankingRow[] = (data ?? []).map((r: any) => ({
          pos: Number(r.position ?? r.pos ?? 0) || 0,
          profile_id: r.profile_id,
          player_name: r.player_name,
          total_points: Number(r.total_points ?? 0) || 0,
          stages_played: Number(r.stages_played ?? 0) || 0,
        }));

        setSeasonRows(rows);
        setStageRows([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar ranking.");
      setStageRows([]);
      setSeasonRows([]);
    } finally {
      setLoadingData(false);
    }
  }

  // Live ranking: atualiza automaticamente ao lançar placares (insert/update em matches)
  useEffect(() => {
    let t: any = null;

    const ch = supabase
      .channel(`rkLiveAdmin:${tab}:${seasonId}:${stageId}:${category}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        if (document.visibilityState !== "visible") return;
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          fetchRanking();
        }, 250);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLiveStatus("error");
        else if (status === "CLOSED") setLiveStatus("off");
        else setLiveStatus("connecting");
      });

    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, seasonId, stageId, category]);

  useEffect(() => {
    if (!seasonId) return;
    if (tab === "stage" && !stageId) return;
    fetchRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category, seasonId, stageId]);

  const topStats = useMemo(() => {
    if (tab === "stage") {
      if (!stageRows.length) return null;
      const totalMatches = stageRows.reduce((acc, r) => acc + (r.matches_played ?? 0), 0);
      const avgGamesDiff = stageRows.reduce((acc, r) => acc + (r.games_diff ?? 0), 0) / stageRows.length;
      return [
        { label: "Atletas ranqueados", value: stageRows.length },
        { label: "Jogos (somado por atleta)", value: totalMatches },
        { label: "Média saldo games", value: avgGamesDiff.toFixed(2) },
      ];
    } else {
      if (!seasonRows.length) return null;
      const totalPts = seasonRows.reduce((acc, r) => acc + (r.total_points ?? 0), 0);
      return [
        { label: "Atletas ranqueados", value: seasonRows.length },
        { label: "Pontos totais (categoria)", value: totalPts },
      ];
    }
  }, [tab, stageRows, seasonRows]);

  const contextLine = useMemo(() => {
    const seasonName = selectedSeason?.name ?? "Temporada";
    if (tab === "stage") {
      const stageLabel = selectedStage?.name ? `Etapa ${stageId} — ${selectedStage.name}` : `Etapa ${stageId}`;
      return `${seasonName} • ${stageLabel} • Categoria ${category}`;
    }
    return `${seasonName} • Geral da Temporada • Categoria ${category}`;
  }, [selectedSeason?.name, tab, selectedStage?.name, stageId, category]);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1220]/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">Ranking</h1>
                <Badge tone="success">35++</Badge>
              </div>
              <p className="text-sm text-white/60">
                {tab === "stage"
                  ? "Ranking por etapa (saldo games, games pró, confronto direto (empate de 2), idade)"
                  : "Ranking geral por temporada (soma pontos das etapas)"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={classNames(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ring-1",
                  liveStatus === "live"
                    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25"
                    : liveStatus === "connecting"
                    ? "bg-amber-500/15 text-amber-200 ring-amber-500/25"
                    : liveStatus === "error"
                    ? "bg-rose-500/15 text-rose-200 ring-rose-500/25"
                    : "bg-white/10 text-white/70 ring-white/10"
                )}
                title={
                  liveStatus === "live"
                    ? "Conectado (atualização automática ativa)"
                    : liveStatus === "connecting"
                    ? "Conectando…"
                    : liveStatus === "error"
                    ? "Falha no realtime (verifique Realtime habilitado para matches)"
                    : "Desconectado"
                }
              >
                <span
                  className={classNames(
                    "h-2 w-2 rounded-full",
                    liveStatus === "live"
                      ? "bg-emerald-400"
                      : liveStatus === "connecting"
                      ? "bg-amber-400"
                      : liveStatus === "error"
                      ? "bg-rose-400"
                      : "bg-white/40"
                  )}
                />
                {liveStatus === "live"
                  ? "Ao vivo"
                  : liveStatus === "connecting"
                  ? "Conectando"
                  : liveStatus === "error"
                  ? "Realtime erro"
                  : "Offline"}
              </span>
            </div>

            {/* Tabs */}
            <div className="inline-flex rounded-2xl bg-white/10 p-1 ring-1 ring-white/10">
              <button
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-bold transition",
                  tab === "stage" ? "bg-[#1f2937] text-white shadow-sm" : "text-white/80 hover:bg-white/10"
                )}
                onClick={() => setTab("stage")}
              >
                Por Etapa
              </button>
              <button
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-bold transition",
                  tab === "season" ? "bg-[#1f2937] text-white shadow-sm" : "text-white/80 hover:bg-white/10"
                )}
                onClick={() => setTab("season")}
              >
                Por Temporada
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-white/80">Temporada</label>
              <select
                className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm shadow-sm outline-none text-white focus:ring-2 focus:ring-white/10"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                disabled={loadingMeta}
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.id}
                  </option>
                ))}
              </select>
            </div>

            {tab === "stage" && (
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-white/80">Etapa</label>
                <select
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm shadow-sm outline-none text-white focus:ring-2 focus:ring-white/10"
                  value={stageId || ""}
                  onChange={(e) => setStageId(Number(e.target.value))}
                  disabled={loadingMeta}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.id} — ${s.name}` : `Etapa ${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-white/80">Categoria</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {(["A", "B", "C", "D"] as Category[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={classNames(
                      "rounded-2xl px-3 py-2 text-sm font-extrabold ring-1 transition",
                      category === c
                        ? "bg-orange-500 text-white ring-orange-500 shadow-sm"
                        : "bg-[#0f172a] text-white/80 ring-white/10 hover:bg-white/5"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Context line */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
            <span className="font-semibold text-white/80">{contextLine}</span>
          </div>

          {/* Top stats */}
          {topStats && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
              {topStats.map((s, idx) => (
                <div key={idx} className="md:col-span-4 rounded-3xl border border-white/10 bg-[#111827] p-4 shadow-sm">
                  <div className="text-xs font-semibold text-white/60">{s.label}</div>
                  <div className="mt-1 text-2xl font-extrabold text-white">{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-3xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
              <div className="font-extrabold">Erro</div>
              <div className="mt-1">{error}</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-[#111827] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-bold text-white">{tab === "stage" ? "Tabela da Etapa" : "Ranking da Temporada"}</div>
            <button
              onClick={fetchRanking}
              className="rounded-2xl bg-[#1f2937] px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-[#374151] disabled:opacity-60"
              disabled={loadingData}
            >
              {loadingData ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          <div className="overflow-auto">
            {tab === "stage" ? (
              <table className="min-w-[1040px] w-full text-left">
                <thead className="sticky top-0 z-10 bg-[#0f172a]">
                  <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wide text-white/60">
                    <th className="px-4 py-3">Pos</th>
                    <th className="px-4 py-3">Atleta</th>
                    <th className="px-4 py-3">Jogos</th>
                    <th className="px-4 py-3">Vitórias</th>
                    <th className="px-4 py-3">Derrotas</th>
                    <th className="px-4 py-3">Games Pró</th>
                    <th className="px-4 py-3">Games Contra</th>
                    <th className="px-4 py-3">Saldo</th>
                    <th className="px-4 py-3">Idade</th>
                    <th className="px-4 py-3">Pts Etapa</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {loadingData && stageRows.length === 0 && (
                    <>
                      <SkeletonRow cols={10} />
                      <SkeletonRow cols={10} />
                      <SkeletonRow cols={10} />
                    </>
                  )}

                  {!loadingData && stageRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-white/60">
                        Nenhum dado para esta categoria/etapa (verifique se há jogos <b>played</b>).
                      </td>
                    </tr>
                  )}

                  {stageRows.map((r) => (
                    <tr
                      key={r.profile_id}
                      className="hover:bg-white/5 cursor-pointer"
                      onClick={() => {
                        setSelectedPlayer({ profile_id: r.profile_id, player_name: r.player_name });
                        setDetailsOpen(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex h-8 w-10 items-center justify-center rounded-2xl bg-[#1f2937] text-sm font-extrabold text-white">
                          {r.pos}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-extrabold text-white">{r.player_name}</div>
                        <div className="mt-0.5 text-xs text-white/60">{r.profile_id}</div>
                      </td>

                      <td className="px-4 py-3 text-sm font-bold text-white/80">{r.matches_played}</td>

                      <td className="px-4 py-3">
                        <Badge tone="success">{r.wins}</Badge>
                      </td>

                      <td className="px-4 py-3">
                        <Badge tone="warning">{r.losses}</Badge>
                      </td>

                      <td className="px-4 py-3 text-sm font-bold text-white/80">{r.games_for}</td>
                      <td className="px-4 py-3 text-sm font-bold text-white/80">{r.games_against}</td>

                      <td className="px-4 py-3">
                        <span className="text-sm font-extrabold text-white/90">{r.games_diff}</span>
                      </td>

                      <td className="px-4 py-3 text-sm font-bold text-white/80">{r.age_years ?? "-"}</td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-2xl bg-orange-500 px-3 py-2 text-sm font-extrabold text-white shadow-sm">
                          {r.stage_points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-[860px] w-full text-left">
                <thead className="sticky top-0 z-10 bg-[#0f172a]">
                  <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wide text-white/60">
                    <th className="px-4 py-3">Pos</th>
                    <th className="px-4 py-3">Atleta</th>
                    <th className="px-4 py-3">Etapas</th>
                    <th className="px-4 py-3">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loadingData && seasonRows.length === 0 && (
                    <>
                      <SkeletonRow cols={4} />
                      <SkeletonRow cols={4} />
                    </>
                  )}

                  {!loadingData && seasonRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-white/60">
                        Nenhum dado para esta temporada/categoria (verifique se há etapas com jogos <b>played</b>).
                      </td>
                    </tr>
                  )}

                  {seasonRows.map((r) => (
                    <tr key={r.profile_id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="inline-flex h-8 w-10 items-center justify-center rounded-2xl bg-[#1f2937] text-sm font-extrabold text-white">
                          {r.pos}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-white">{r.player_name}</div>
                        <div className="mt-0.5 text-xs text-white/60">{r.profile_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{r.stages_played} etapas</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-2xl bg-orange-500 px-3 py-2 text-sm font-extrabold text-white shadow-sm">
                          {r.total_points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3 text-xs text-white/60">
            Dica: AdminRanking agora usa as mesmas views do atleta: <b>v_ranking_stage_players</b> / <b>v_ranking_season_players</b>. Jogos considerados:{" "}
            <b>played</b>. Pts etapa = <b>wins × 10</b>.
          </div>
        </div>
      </div>

      <PlayerDetailsModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        stageId={stageId}
        category={category}
        player={selectedPlayer}
      />
    </div>
  );
}