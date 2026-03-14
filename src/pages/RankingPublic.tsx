import { useEffect, useMemo, useState } from "react";
import * as ReactDOM from "react-dom";
import { supabase } from "../lib/supabase";

type Category = "A" | "B" | "C" | "D";
type TabKey = "pairs" | "stage" | "season";

type SeasonRow = { id: string; name: string | null; created_at?: string | null };
type StageRow = { id: number; name: string | null; season_id: string | null; status: string | null };

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
  bonus_less_games: number;
  adjusted_matches_played: number;
  adjusted_games_diff: number;
  adjusted_games_for: number;
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

type PairRankingRow = {
  pos: number;
  pair_id: string;
  pair_label: string;
  player1_name: string;
  player2_name: string;
  matches_played: number;
  wins: number;
  losses: number;
  games_for: number;
  games_against: number;
  games_diff: number;
  age_sum: number | null;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function medalForPos(pos: number) {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return null;
}

function topRowTone(pos: number) {
  if (pos === 1) return "ring-emerald-400/30 bg-emerald-500/10";
  if (pos === 2) return "ring-slate-300/20 bg-white/5";
  if (pos === 3) return "ring-orange-400/25 bg-orange-500/10";
  return "ring-white/10";
}

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
    const gf = rows.reduce((a, x) => a + (x.games_for ?? 0), 0);
    const ga = rows.reduce((a, x) => a + (x.games_against ?? 0), 0);
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
                {(summary.winRate ?? 0).toFixed(1)}% • {summary.diff >= 0 ? "+" : ""}
                {summary.diff} saldo
              </div>
            </div>

            <button onClick={onClose} className="rounded-xl bg-[#1f2937] px-3 py-2 text-sm font-extrabold text-white hover:bg-[#374151]">
              Fechar
            </button>
          </div>

          <div className="px-5 py-4">
            {err && (
              <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{err}</div>
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
              * O detalhamento lista apenas jogos da <b>etapa selecionada</b> com status <b>played</b> e score no formato oficial{" "}
              {"{games_team1, games_team2, winner_side}"}.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function RankingPublic({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<TabKey>("pairs");

  const [category, setCategory] = useState<Category>("B");
  const [categoryAutoApplied, setCategoryAutoApplied] = useState(false);
  const [categoryTouchedByUser, setCategoryTouchedByUser] = useState(false);

  const [me, setMe] = useState<string | null>(null);

  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);

  const [seasonId, setSeasonId] = useState<string>("");
  const [stageId, setStageId] = useState<number>(0);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "error" | "off">("connecting");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ profile_id: string; player_name: string } | null>(null);

  const [stageRows, setStageRows] = useState<StageRankingRow[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonRankingRow[]>([]);
  const [pairRows, setPairRows] = useState<PairRankingRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data.user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setMe(session?.user?.id ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    if (categoryTouchedByUser) return;
    if (categoryAutoApplied) return;

    (async () => {
      try {
        const r1 = await supabase.from("profiles").select("category").eq("id", me).maybeSingle();
        if (!r1.error) {
          const c = (r1.data as any)?.category;
          if (c === "A" || c === "B" || c === "C" || c === "D") {
            setCategory(c);
            setCategoryAutoApplied(true);
            return;
          }
        }

        const r2 = await supabase.from("profiles").select("categoria").eq("id", me).maybeSingle();
        if (!r2.error) {
          const c = (r2.data as any)?.categoria;
          if (c === "A" || c === "B" || c === "C" || c === "D") {
            setCategory(c);
            setCategoryAutoApplied(true);
            return;
          }
        }

        setCategoryAutoApplied(true);
      } catch {
        setCategoryAutoApplied(true);
      }
    })();
  }, [me, categoryTouchedByUser, categoryAutoApplied]);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!seasonId) return;

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("stages")
          .select("id,name,season_id,status")
          .eq("season_id", seasonId)
          .order("id", { ascending: false });
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!me) throw new Error("Você precisa estar logado para ver seu ranking.");

      if (tab === "pairs") {
        if (!stageId) throw new Error("Selecione uma etapa.");

        const { data, error } = await supabase
          .from("v_ranking_stage_pairs")
          .select("stage_id,category,pair_id,pair_label,player1_name,player2_name,matches_played,wins,losses,games_for,games_against,games_diff,age_sum,position")
          .eq("stage_id", stageId)
          .eq("category", category)
          .order("position", { ascending: true });

        if (error) throw error;

        const rows: PairRankingRow[] = ((data ?? []) as any[]).map((r) => ({
          pos: Number(r.position ?? 0) || 0,
          pair_id: String(r.pair_id ?? ""),
          pair_label: String(r.pair_label ?? "—"),
          player1_name: String(r.player1_name ?? "—"),
          player2_name: String(r.player2_name ?? "—"),
          matches_played: Number(r.matches_played ?? 0) || 0,
          wins: Number(r.wins ?? 0) || 0,
          losses: Number(r.losses ?? 0) || 0,
          games_for: Number(r.games_for ?? 0) || 0,
          games_against: Number(r.games_against ?? 0) || 0,
          games_diff: Number(r.games_diff ?? 0) || 0,
          age_sum: r.age_sum == null ? null : Number(r.age_sum),
        }));

        setPairRows(rows);
        setStageRows([]);
        setSeasonRows([]);
      } else if (tab === "stage") {
        if (!stageId) throw new Error("Selecione uma etapa.");

        const { data, error } = await supabase
          .from("v_ranking_stage_players")
          .select("stage_id,category,profile_id,player_name,matches_played,wins,losses,games_for,games_against,games_diff,bonus_less_games,adjusted_matches_played,adjusted_games_diff,adjusted_games_for,age_years,position")
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
          bonus_less_games: Number(r.bonus_less_games ?? 0) || 0,
          adjusted_matches_played: Number(r.adjusted_matches_played ?? r.matches_played ?? 0) || 0,
          adjusted_games_diff: Number(r.adjusted_games_diff ?? r.games_diff ?? 0) || 0,
          adjusted_games_for: Number(r.adjusted_games_for ?? r.games_for ?? 0) || 0,
          age_years: r.age_years == null ? null : Number(r.age_years),
          stage_points: (Number(r.wins ?? 0) || 0) * 10,
        }));

        setStageRows(rows);
        setPairRows([]);
        setSeasonRows([]);
      } else {
        if (!seasonId) throw new Error("Selecione uma temporada.");

        const { data, error } = await supabase
          .from("v_ranking_season_players")
          .select("pos,profile_id,player_name,total_points,stages_played")
          .eq("season_id", seasonId)
          .eq("category", category)
          .order("pos", { ascending: true });

        if (error) throw error;

        const rows: SeasonRankingRow[] = ((data ?? []) as any[]).map((r) => ({
          pos: Number(r.pos ?? 0) || 0,
          profile_id: r.profile_id,
          player_name: r.player_name,
          total_points: Number(r.total_points ?? 0) || 0,
          stages_played: Number(r.stages_played ?? 0) || 0,
        }));

        setSeasonRows(rows);
        setPairRows([]);
        setStageRows([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar ranking.");
      setStageRows([]);
      setSeasonRows([]);
      setPairRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let t: any = null;

    const ch = supabase
      .channel(`rkLiveChannel:${tab}:${seasonId}:${stageId}:${category}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        if (document.visibilityState !== "visible") return;
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          load();
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
  }, [tab, seasonId, stageId, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!me) return;
    if (!seasonId) return;
    if ((tab === "stage" || tab === "pairs") && !stageId) return;
    load();
  }, [tab, category, seasonId, stageId, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSeason = useMemo(() => seasons.find((s) => s.id === seasonId), [seasons, seasonId]);
  const selectedStage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);

  const isStageFinished = useMemo(() => {
    return selectedStage?.status === "finished";
  }, [selectedStage]);

  const podiumPairs = useMemo(() => {
    if (tab !== "pairs") return { first: null, second: null, third: null };

    const first = pairRows.find((r) => r.pos === 1) ?? null;
    const second = pairRows.find((r) => r.pos === 2) ?? null;
    const third = pairRows.find((r) => r.pos === 3) ?? null;

    return { first, second, third };
  }, [tab, pairRows]);

  const titleLine = useMemo(() => {
    if (tab === "pairs") {
      return `${selectedSeason?.name ?? "Temporada"} • Etapa ${stageId}${selectedStage?.name ? ` — ${selectedStage.name}` : ""} • Categoria ${category}`;
    }
    if (tab === "stage") {
      return `${selectedSeason?.name ?? "Temporada"} • Etapa ${stageId}${selectedStage?.name ? ` — ${selectedStage.name}` : ""} • Categoria ${category}`;
    }
    return `${selectedSeason?.name ?? "Temporada"} • Categoria ${category}`;
  }, [tab, selectedSeason?.name, selectedStage?.name, stageId, category]);

  return (
    <div className={embedded ? "text-white" : "min-h-screen bg-[#0b1220] text-white"}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rk-fade { animation: fadeInUp 180ms ease-out both; }
      `}</style>

      <div className={embedded ? "" : "mx-auto max-w-6xl px-4 py-6"}>
        <div className={embedded ? "max-w-6xl" : ""}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold">Ranking</h1>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-500/25">
                  35++
                </span>
              </div>
              <div className="text-sm text-white/60">{titleLine}</div>
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

            <div className="inline-flex rounded-2xl bg-[#111827] p-1 ring-1 ring-white/10">
              <button
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-extrabold transition",
                  tab === "pairs" ? "bg-[#1f2937] text-white" : "text-white/70 hover:bg-white/5"
                )}
                onClick={() => setTab("pairs")}
              >
                Por Dupla
              </button>
              <button
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-extrabold transition",
                  tab === "stage" ? "bg-[#1f2937] text-white" : "text-white/70 hover:bg-white/5"
                )}
                onClick={() => setTab("stage")}
              >
                Por Etapa
              </button>
              <button
                className={classNames(
                  "rounded-2xl px-4 py-2 text-sm font-extrabold transition",
                  tab === "season" ? "bg-[#1f2937] text-white" : "text-white/70 hover:bg-white/5"
                )}
                onClick={() => setTab("season")}
              >
                Por Temporada
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[#111827] p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <div className="text-xs font-semibold text-white/60">Temporada</div>
                <select
                  value={seasonId}
                  onChange={(e) => setSeasonId(e.target.value)}
                  disabled={loadingMeta}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <div className="text-xs font-semibold text-white/60">Etapa</div>
                <select
                  value={stageId || ""}
                  onChange={(e) => setStageId(Number(e.target.value))}
                  disabled={loadingMeta || tab === "season"}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ? `${s.id} — ${s.name}` : `Etapa ${s.id}`}
                    </option>
                  ))}
                </select>
                {tab === "season" && <div className="mt-1 text-[11px] text-white/40">* Etapa usada apenas em “Por Dupla” e “Por Etapa”.</div>}
              </div>

              <div className="md:col-span-3">
                <div className="text-xs font-semibold text-white/60">Categoria</div>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {(["A", "B", "C", "D"] as Category[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCategoryTouchedByUser(true);
                        setCategory(c);
                      }}
                      className={classNames(
                        "rounded-xl px-3 py-2 text-sm font-extrabold ring-1 transition",
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

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-white/50">
                {tab === "pairs"
                  ? "Desempate: vitórias → saldo games → games pró → confronto direto (empate de 2) → soma das idades."
                  : "Desempate: saldo games → games pró → confronto direto (empate de 2) → idade."}
              </div>

              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl bg-[#1f2937] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#374151] disabled:opacity-60"
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            {error && <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#111827] overflow-hidden">
            {tab === "pairs" && !isStageFinished && (
              <div className="border-b border-white/10 px-4 py-3 text-sm text-white/60">
                O pódio oficial será exibido somente após finalizar a etapa.
              </div>
            )}

            {tab === "pairs" && isStageFinished && (podiumPairs.first || podiumPairs.second || podiumPairs.third) && (
              <div className="border-b border-white/10 px-4 py-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-200/80">🥇 Campeão</div>
                    <div className="mt-2 text-lg font-extrabold text-white">
                      {podiumPairs.first?.pair_label ?? "—"}
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      {podiumPairs.first
                        ? `${podiumPairs.first.wins}V • SG ${podiumPairs.first.games_diff >= 0 ? "+" : ""}${podiumPairs.first.games_diff} • GP ${podiumPairs.first.games_for}`
                        : ""}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-300/20 bg-white/5 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-white/70">🥈 Vice</div>
                    <div className="mt-2 text-lg font-extrabold text-white">
                      {podiumPairs.second?.pair_label ?? "—"}
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      {podiumPairs.second
                        ? `${podiumPairs.second.wins}V • SG ${podiumPairs.second.games_diff >= 0 ? "+" : ""}${podiumPairs.second.games_diff} • GP ${podiumPairs.second.games_for}`
                        : ""}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-400/25 bg-orange-500/10 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-orange-200/80">🥉 3º lugar</div>
                    <div className="mt-2 text-lg font-extrabold text-white">
                      {podiumPairs.third?.pair_label ?? "—"}
                    </div>
                    <div className="mt-2 text-xs text-white/60">
                      {podiumPairs.third
                        ? `${podiumPairs.third.wins}V • SG ${podiumPairs.third.games_diff >= 0 ? "+" : ""}${podiumPairs.third.games_diff} • GP ${podiumPairs.third.games_for}`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-white/10 px-4 py-3 text-sm font-extrabold">
              {tab === "pairs" ? "Classificação das Duplas da Etapa" : tab === "stage" ? "Tabela da Etapa" : "Ranking da Temporada"}
            </div>

            <div className="overflow-auto">
              {tab === "pairs" ? (
                <table className="min-w-[980px] w-full text-left">
                  <thead className="bg-[#0f172a] text-xs font-bold text-white/60">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3">POS</th>
                      <th className="px-4 py-3">DUPLA</th>
                      <th className="px-4 py-3">J</th>
                      <th className="px-4 py-3">V</th>
                      <th className="px-4 py-3">D</th>
                      <th className="px-4 py-3">GP</th>
                      <th className="px-4 py-3">GC</th>
                      <th className="px-4 py-3">SG</th>
                      <th className="px-4 py-3">IDADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && pairRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-white/60">
                          Sem dados de duplas (verifique etapa/categoria e jogos played).
                        </td>
                      </tr>
                    )}

                    {pairRows.map((r) => (
                      <tr
                        key={r.pair_id}
                        className={classNames("rk-fade", topRowTone(r.pos), "ring-1")}
                        style={{ animationDelay: `${Math.min(r.pos, 12) * 10}ms` }}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl bg-[#1f2937] px-2 text-sm font-extrabold text-white ring-1 ring-white/10">
                            {medalForPos(r.pos) && <span className="text-base leading-none">{medalForPos(r.pos)}</span>}
                            <span>{r.pos}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold">{r.pair_label}</td>
                        <td className="px-4 py-3 font-bold">{r.matches_played}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-200">{r.wins}</td>
                        <td className="px-4 py-3 font-extrabold text-orange-200">{r.losses}</td>
                        <td className="px-4 py-3 font-bold">{r.adjusted_games_for ?? r.games_for}</td>
                        <td className="px-4 py-3 font-bold">{r.games_against}</td>
                        <td className="px-4 py-3 font-extrabold">{r.games_diff >= 0 ? `+${r.games_diff}` : r.games_diff}</td>
                        <td className="px-4 py-3">{r.age_sum ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : tab === "stage" ? (
                <table className="min-w-[1120px] w-full text-left">
                  <thead className="bg-[#0f172a] text-xs font-bold text-white/60">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3">POS</th>
                      <th className="px-4 py-3">ATLETA</th>
                      <th className="px-4 py-3">J</th>
                      <th className="px-4 py-3">V</th>
                      <th className="px-4 py-3">D</th>
                      <th className="px-4 py-3">GP</th>
                      <th className="px-4 py-3">GC</th>
                      <th className="px-4 py-3">SALDO</th>
                      <th className="px-4 py-3">COMP.</th>
                      <th className="px-4 py-3">J. AJUST.</th>
                      <th className="px-4 py-3">IDADE</th>
                      <th className="px-4 py-3 whitespace-nowrap">PTS ETAPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && stageRows.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-sm text-white/60">
                          Sem dados (verifique etapa/categoria e jogos played).
                        </td>
                      </tr>
                    )}

                    {stageRows.map((r) => (
                      <tr
                        key={r.profile_id}
                        onClick={() => {
                          setSelectedPlayer({ profile_id: r.profile_id, player_name: r.player_name });
                          setDetailsOpen(true);
                        }}
                        className={classNames("rk-fade cursor-pointer hover:bg-white/5 transition-colors", topRowTone(r.pos), "ring-1")}
                        style={{ animationDelay: `${Math.min(r.pos, 12) * 10}ms` }}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl bg-[#1f2937] px-2 text-sm font-extrabold text-white ring-1 ring-white/10">
                            {medalForPos(r.pos) && <span className="text-base leading-none">{medalForPos(r.pos)}</span>}
                            <span>{r.pos}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold">
                          <button
                            onClick={() => {
                              setSelectedPlayer({ profile_id: r.profile_id, player_name: r.player_name });
                              setDetailsOpen(true);
                            }}
                            className="text-left hover:underline underline-offset-4"
                            title="Ver detalhes"
                          >
                            {r.player_name}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-bold">{r.matches_played}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-200">{r.wins}</td>
                        <td className="px-4 py-3 font-extrabold text-orange-200">{r.losses}</td>
                        <td className="px-4 py-3 font-bold">{r.games_for}</td>
                        <td className="px-4 py-3 font-bold">{r.games_against}</td>
                        <td className="px-4 py-3 font-extrabold">{(r.adjusted_games_diff ?? r.games_diff) >= 0 ? `+${r.adjusted_games_diff ?? r.games_diff}` : (r.adjusted_games_diff ?? r.games_diff)}</td>
                        <td className="px-4 py-3">
                          {r.bonus_less_games > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-extrabold text-sky-200 ring-1 ring-sky-500/25">
                              +{r.bonus_less_games}
                            </span>
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-extrabold">{r.adjusted_matches_played ?? r.matches_played}</td>
                        <td className="px-4 py-3">{r.age_years ?? "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-xl bg-orange-500 px-3 py-2 text-sm font-extrabold text-white">{r.stage_points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-[760px] w-full text-left">
                  <thead className="bg-[#0f172a] text-xs font-bold text-white/60">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3">POS</th>
                      <th className="px-4 py-3">ATLETA</th>
                      <th className="px-4 py-3">ETAPAS</th>
                      <th className="px-4 py-3">PONTOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && seasonRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-white/60">
                          Sem dados (tenha etapas com jogos played).
                        </td>
                      </tr>
                    )}

                    {seasonRows.map((r) => (
                      <tr
                        key={r.profile_id}
                        className={classNames("rk-fade", topRowTone(r.pos), "ring-1")}
                        style={{ animationDelay: `${Math.min(r.pos, 12) * 10}ms` }}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded-xl bg-[#1f2937] px-2 text-sm font-extrabold text-white ring-1 ring-white/10">
                            {medalForPos(r.pos) && <span className="text-base leading-none">{medalForPos(r.pos)}</span>}
                            <span>{r.pos}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-extrabold">{r.player_name}</td>
                        <td className="px-4 py-3 font-bold">{r.stages_played}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-xl bg-orange-500 px-3 py-2 text-sm font-extrabold text-white">{r.total_points}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-white/10 px-4 py-3 text-xs text-white/50">
              {tab === "pairs"
                ? <>* Ranking por dupla da etapa. Jogos considerados: status <b>played</b>.</>
                : <>* Ranking somente por atleta. Jogos considerados: status <b>played</b>.</>}
            </div>
          </div>

          <PlayerDetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} stageId={stageId} category={category} player={selectedPlayer} />
        </div>
      </div>
    </div>
  );
}