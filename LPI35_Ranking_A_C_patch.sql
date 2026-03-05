begin;

-- ============================================================
-- (A) DETALHE DO ATLETA (jogos da etapa) - RPC
-- ============================================================
-- Retorna a lista de jogos "played" de um atleta na etapa, já com
-- labels das duplas e score do ponto de vista do atleta.
create or replace function public.get_player_stage_matches(
  p_stage_id bigint,
  p_profile_id uuid
)
returns table (
  match_id uuid,
  round_id uuid,
  group_id uuid,
  court_no int,
  slot_no int,
  team_label text,
  opp_label text,
  games_for int,
  games_against int,
  result text,
  ended_at timestamptz
)
language sql
security definer
set search_path = public
as $$
with pm as (
  select
    m.id,
    m.round_id,
    m.group_id,
    m.court_no,
    m.slot_no,
    m.ended_at,
    m.team1_pair_id,
    m.team2_pair_id,
    (m.score->>'team1')::int as g1,
    (m.score->>'team2')::int as g2
  from public.matches m
  join public.rounds r on r.id = m.round_id
  where r.stage_id = p_stage_id
    and m.status = 'played'::public.match_status
    and m.score is not null
    and m.score <> '{}'::jsonb
    and (m.score ? 'team1') and (m.score ? 'team2')
),
pair_has_player as (
  select
    rp.id as pair_id
  from public.round_pairs rp
  join public.stage_roster sr
    on sr.id in (rp.player1_roster_id, rp.player2_roster_id)
  where sr.kind = 'athlete'
    and sr.athlete_id = p_profile_id
)
select
  pm.id as match_id,
  pm.round_id,
  pm.group_id,
  pm.court_no,
  pm.slot_no,

  -- labels
  public.pair_label(case
    when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.team1_pair_id
    else pm.team2_pair_id
  end) as team_label,

  public.pair_label(case
    when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.team2_pair_id
    else pm.team1_pair_id
  end) as opp_label,

  -- score from athlete perspective
  case
    when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g1
    else pm.g2
  end as games_for,

  case
    when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g2
    else pm.g1
  end as games_against,

  case
    when (
      case when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g1 else pm.g2 end
    ) > (
      case when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g2 else pm.g1 end
    ) then 'W'
    when (
      case when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g1 else pm.g2 end
    ) < (
      case when pm.team1_pair_id in (select pair_id from pair_has_player) then pm.g2 else pm.g1 end
    ) then 'L'
    else 'T'
  end as result,

  pm.ended_at
from pm
where pm.team1_pair_id in (select pair_id from pair_has_player)
   or pm.team2_pair_id in (select pair_id from pair_has_player)
order by pm.ended_at nulls last, pm.slot_no nulls last, pm.court_no nulls last;
$$;

revoke all on function public.get_player_stage_matches(bigint, uuid) from public;
grant execute on function public.get_player_stage_matches(bigint, uuid) to authenticated;

-- ============================================================
-- (C) PERFORMANCE: MATERIALIZED VIEWS + REFRESH AUTOMÁTICO
-- ============================================================

-- 1) Materialized view do ranking por etapa (mesma lógica da view final)
drop materialized view if exists public.mv_ranking_stage_players;
create materialized view public.mv_ranking_stage_players as
select * from public.v_ranking_stage_players;

-- Índice para refresh concurrent (opcional) e para filtros por etapa/categoria
create unique index if not exists mv_ranking_stage_players_uq
  on public.mv_ranking_stage_players(stage_id, category, profile_id);

-- 2) Materialized view dos pontos da etapa
drop materialized view if exists public.mv_stage_points_players;
create materialized view public.mv_stage_points_players as
select * from public.v_stage_points_players;

create unique index if not exists mv_stage_points_players_uq
  on public.mv_stage_points_players(stage_id, category, profile_id);

-- 3) Materialized view do ranking da temporada
drop materialized view if exists public.mv_ranking_season_players;
create materialized view public.mv_ranking_season_players as
select * from public.v_ranking_season_players;

create unique index if not exists mv_ranking_season_players_uq
  on public.mv_ranking_season_players(season_id, category, profile_id);

-- 4) Função para refresh (com lock para evitar concorrência)
create or replace function public.admin_refresh_rankings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- evita dois refresh simultâneos
  perform pg_advisory_lock(987654321);

  refresh materialized view public.mv_ranking_stage_players;
  refresh materialized view public.mv_stage_points_players;
  refresh materialized view public.mv_ranking_season_players;

  perform pg_advisory_unlock(987654321);
end $$;

revoke all on function public.admin_refresh_rankings() from public;
grant execute on function public.admin_refresh_rankings() to authenticated;

-- 5) Trigger: quando match vira "played" ou score muda em played, atualiza MVs
create or replace function public.trg_refresh_rankings_on_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só dispara quando o jogo está played e tem score válido.
  if (new.status = 'played'::public.match_status)
     and new.score is not null
     and new.score <> '{}'::jsonb
     and (new.score ? 'team1') and (new.score ? 'team2')
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.score is distinct from new.score
     )
  then
    perform public.admin_refresh_rankings();
  end if;

  return new;
end $$;

drop trigger if exists refresh_rankings_on_match on public.matches;
create trigger refresh_rankings_on_match
after insert or update of status, score on public.matches
for each row
execute function public.trg_refresh_rankings_on_match();

-- 6) Ajustar RPCs para ler das MATERIALIZED VIEWS (sem mudar assinatura)
create or replace function public.get_ranking_stage_players(
  p_stage_id bigint,
  p_category text
)
returns table (
  pos int,
  profile_id uuid,
  player_name text,
  matches_played bigint,
  wins bigint,
  losses bigint,
  games_for bigint,
  games_against bigint,
  games_diff bigint,
  stage_points int,
  age_years int
)
language sql
security definer
set search_path = public
as $$
  select
    r.position as pos,
    r.profile_id,
    r.player_name,
    r.matches_played,
    r.wins,
    r.losses,
    r.games_for,
    r.games_against,
    r.games_diff,
    sp.stage_points,
    r.age_years
  from public.mv_ranking_stage_players r
  join public.mv_stage_points_players sp
    on sp.stage_id = r.stage_id
   and sp.category = r.category
   and sp.profile_id = r.profile_id
  where r.stage_id = p_stage_id
    and r.category = p_category
  order by r.position asc;
$$;

revoke all on function public.get_ranking_stage_players(bigint, text) from public;
grant execute on function public.get_ranking_stage_players(bigint, text) to authenticated;

create or replace function public.get_ranking_season_players(
  p_season_id uuid,
  p_category text
)
returns table (
  pos int,
  profile_id uuid,
  player_name text,
  total_points bigint,
  stages_played bigint
)
language sql
security definer
set search_path = public
as $$
  with x as (
    select *
    from public.mv_ranking_season_players
    where season_id = p_season_id
      and category = p_category
  )
  select
    row_number() over (order by total_points desc, stages_played desc, player_name asc) as pos,
    profile_id,
    player_name,
    total_points,
    stages_played
  from x
  order by pos asc;
$$;

revoke all on function public.get_ranking_season_players(uuid, text) from public;
grant execute on function public.get_ranking_season_players(uuid, text) to authenticated;

commit;
