--
-- PostgreSQL database dump
--

\restrict kaMCtvN95AnjHf91VfEhg7xEG7IP9pRUWw3RhgznBp42ECz6Zmw9LUaMkVMerTl

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: club_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.club_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_type AS ENUM (
    'season',
    'stage'
);


--
-- Name: season_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.season_status AS ENUM (
    'draft',
    'open',
    'closed',
    'archived'
);


--
-- Name: stage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stage_status AS ENUM (
    'draft',
    'scheduled',
    'signup_open',
    'signup_closed',
    'running',
    'finished',
    'canceled'
);


--
-- Name: admin_approve_athlete(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_approve_athlete(p_user_id uuid, p_categoria text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_categoria is null or p_categoria not in ('A','B','C','D') then
    raise exception 'categoria inválida (use A/B/C/D)';
  end if;

  update public.profiles
  set
    approved = true,
    approved_at = now(),
    approved_by = auth.uid(),
    rejected = false,
    rejected_at = null,
    rejected_by = null,
    rejected_reason = null,
    categoria = p_categoria
  where id = p_user_id;

  return found;
end;
$$;


--
-- Name: admin_dashboard_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_dashboard_stats() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_invites_active int;
  v_pending int;
  v_approved int;
  v_rejected int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- Convites ativos: não expirado, não revogado, e ainda com usos disponíveis
  select count(*)
    into v_invites_active
  from public.invites i
  where i.expires_at > now()
    and coalesce(i.revoked, false) = false
    and i.revoked_at is null
    and coalesce(i.uses, 0) < coalesce(i.max_uses, 1);

  -- Perfis (somente atletas: exclui admins)
  select count(*) into v_pending
  from public.profiles p
  left join public.admins a on a.user_id = p.id
  where a.user_id is null
    and coalesce(p.approved, false) = false
    and coalesce(p.rejected, false) = false;

  select count(*) into v_approved
  from public.profiles p
  left join public.admins a on a.user_id = p.id
  where a.user_id is null
    and coalesce(p.approved, false) = true;

  select count(*) into v_rejected
  from public.profiles p
  left join public.admins a on a.user_id = p.id
  where a.user_id is null
    and coalesce(p.rejected, false) = true;

  return jsonb_build_object(
    'invites_active', v_invites_active,
    'pending', v_pending,
    'approved', v_approved,
    'rejected', v_rejected
  );
end;
$$;


--
-- Name: admin_generate_invite(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_generate_invite(p_days integer DEFAULT 1, p_max_uses integer DEFAULT 1) RETURNS TABLE(id bigint, token text, expires_at timestamp with time zone, max_uses integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_token text;
  v_expires timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_expires := now() + make_interval(days => greatest(coalesce(p_days,1), 1));
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.invites(token, expires_at, created_by, uses, max_uses, revoked, revoked_at)
  values (v_token, v_expires, auth.uid(), 0, greatest(coalesce(p_max_uses,1),1), false, null)
  returning invites.id, invites.token, invites.expires_at, invites.max_uses
  into id, token, expires_at, max_uses;

  return next;
end;
$$;


--
-- Name: admin_generate_invites(integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_generate_invites(p_count integer DEFAULT 10, p_days integer DEFAULT 1, p_max_uses integer DEFAULT 1) RETURNS TABLE(id bigint, token text, expires_at timestamp with time zone, max_uses integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  i int;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  for i in 1..greatest(1, least(coalesce(p_count,10), 200)) loop
    return query
      select * from public.admin_generate_invite(p_days, p_max_uses);
  end loop;
end;
$$;


--
-- Name: admin_list_invites(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_list_invites(p_limit integer DEFAULT 100) RETURNS TABLE(id bigint, token text, created_at timestamp with time zone, expires_at timestamp with time zone, uses integer, max_uses integer, revoked boolean, revoked_at timestamp with time zone, used_at timestamp with time zone, used_by uuid, used_by_nome text, used_by_email text, status text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    i.id,
    i.token,
    i.created_at,
    i.expires_at,
    coalesce(i.uses,0) as uses,
    coalesce(i.max_uses,1) as max_uses,
    coalesce(i.revoked,false) as revoked,
    i.revoked_at,
    i.used_at,
    i.used_by,
    p.nome as used_by_nome,
    p.email as used_by_email,
    case
      when coalesce(i.revoked,false) = true or i.revoked_at is not null then 'revogado'
      when i.expires_at <= now() then 'expirado'
      when coalesce(i.uses,0) >= coalesce(i.max_uses,1) then 'usado'
      else 'ativo'
    end as status
  from public.invites i
  left join public.profiles p on p.id = i.used_by
  order by i.created_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$$;


--
-- Name: admin_recent_activity(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_recent_activity(p_limit integer DEFAULT 20) RETURNS TABLE(action_type text, athlete_id uuid, athlete_nome text, athlete_email text, action_at timestamp with time zone, actor_nome text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with athletes as (
    select p.*
    from public.profiles p
    left join public.admins a on a.user_id = p.id
    where a.user_id is null
  ),
  created_ev as (
    select
      'cadastro'::text as action_type,
      a.id as athlete_id,
      a.nome as athlete_nome,
      a.email as athlete_email,
      a.created_at as action_at,
      null::uuid as actor_id
    from athletes a
    where a.created_at is not null
  ),
  approved_ev as (
    select
      'aprovado'::text as action_type,
      a.id as athlete_id,
      a.nome as athlete_nome,
      a.email as athlete_email,
      a.approved_at as action_at,
      a.approved_by as actor_id
    from athletes a
    where coalesce(a.approved, false) = true
      and a.approved_at is not null
  ),
  rejected_ev as (
    select
      'reprovado'::text as action_type,
      a.id as athlete_id,
      a.nome as athlete_nome,
      a.email as athlete_email,
      a.rejected_at as action_at,
      a.rejected_by as actor_id
    from athletes a
    where coalesce(a.rejected, false) = true
      and a.rejected_at is not null
  ),
  ev as (
    select * from created_ev
    union all
    select * from approved_ev
    union all
    select * from rejected_ev
  )
  select
    ev.action_type,
    ev.athlete_id,
    ev.athlete_nome,
    ev.athlete_email,
    ev.action_at,
    coalesce(actor.nome, null) as actor_nome
  from ev
  left join public.profiles actor on actor.id = ev.actor_id
  where ev.action_at is not null
  order by ev.action_at desc
  limit greatest(coalesce(p_limit, 20), 1);
$$;


--
-- Name: admin_record_payment(uuid, public.payment_type, numeric, integer, bigint, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_record_payment(p_user_id uuid, p_type public.payment_type, p_amount numeric, p_stage_no integer DEFAULT NULL::integer, p_season_id bigint DEFAULT NULL::bigint, p_method text DEFAULT NULL::text, p_notes text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if p_type = 'stage' and (p_stage_no is null or p_stage_no < 1) then
    raise exception 'invalid_stage_no';
  end if;

  insert into public.payments(user_id, type, amount, stage_no, season_id, method, notes, created_by)
  values (p_user_id, p_type, p_amount, p_stage_no, p_season_id, p_method, p_notes, auth.uid())
  returning id into v_id;

  return v_id;
end $$;


--
-- Name: admin_set_category(uuid, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_category(p_user_id uuid, p_category text, p_season_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  -- exige admin
  if not public.is_admin(auth.uid()) then
    raise exception 'not admin';
  end if;

  if p_category not in ('A','B','C','D') then
    raise exception 'invalid category';
  end if;

  -- atualiza estado atual
  update public.profiles
     set category = p_category,
         category_set_at = now(),
         category_set_by = auth.uid(),
         season_id = coalesce(p_season_id, season_id)
   where id = p_user_id;

  -- grava histórico
  insert into public.category_history(user_id, season_id, category, set_by, reason)
  values (p_user_id, p_season_id, p_category, auth.uid(), p_reason);
end;
$$;


--
-- Name: approve_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_user(p_user uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set approved = true,
      approved_by = auth.uid(),
      approved_at = now()
  where id = p_user;

  return found;
end;
$$;


--
-- Name: athlete_set_shirt_size(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.athlete_set_shirt_size(p_size text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles
     set shirt_size = nullif(trim(p_size), ''),
         shirt_size_updated_at = now()
   where id = auth.uid();
end $$;


--
-- Name: close_stage_signup(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_stage_signup(p_stage_id bigint) RETURNS TABLE(ok boolean, new_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select status::text into v_status from public.stages where id = p_stage_id;
  if v_status is null then raise exception 'stage_not_found'; end if;

  if v_status <> 'signup_open' then
    raise exception 'invalid_status_transition: current=%', v_status;
  end if;

  update public.stages
    set status = 'signup_closed',
        updated_at = now()
  where id = p_stage_id;

  return query select true, 'signup_closed'::text;
end;
$$;


--
-- Name: consume_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_invite(p_token text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Atualiza SOMENTE se estiver válido (atômico)
  update public.invites i
  set
    uses    = coalesce(i.uses,0) + 1,
    used_by = v_uid,
    used_at = now()
  where
    i.token = p_token
    and i.expires_at > now()
    and coalesce(i.revoked,false) = false
    and i.revoked_at is null
    and coalesce(i.uses,0) < coalesce(i.max_uses,1);

  if found then
    return true;
  end if;

  return false;
end;
$$;


--
-- Name: enforce_courts_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_courts_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_courts int;
begin
  select c.courts_count into v_courts
  from public.clubs c
  where c.id = new.club_id;

  if v_courts is null then
    raise exception 'Clube inválido.';
  end if;

  if new.courts_used > v_courts then
    raise exception 'courts_used (%) maior que courts_count do clube (%)', new.courts_used, v_courts;
  end if;

  return new;
end;
$$;


--
-- Name: enforce_single_open_stage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_single_open_stage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.status = 'open' then
    if exists (select 1 from public.stages s where s.status='open' and s.id <> coalesce(new.id,-1)) then
      raise exception 'Já existe uma etapa em status OPEN. Feche-a antes de abrir outra.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: finalize_stage(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_stage(p_stage_id bigint) RETURNS TABLE(ok boolean, new_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select status::text into v_status from public.stages where id = p_stage_id;
  if v_status is null then raise exception 'stage_not_found'; end if;

  if v_status <> 'running' then
    raise exception 'invalid_status_transition: current=%', v_status;
  end if;

  update public.stages
    set status = 'finished',
        updated_at = now()
  where id = p_stage_id;

  return query select true, 'finished'::text;
end;
$$;


--
-- Name: generate_invite(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- ✅ usar schema correto
  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.invites(token, expires_at)
  values (v_token, now() + interval '1 day');

  return v_token;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists(select 1 from public.admins a where a.user_id = auth.uid());
$$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select exists(select 1 from public.admins a where a.user_id = p_user_id);
$$;


--
-- Name: reject_user(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_user(p_user uuid, p_reason text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set rejected = true,
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejected_reason = nullif(trim(p_reason), ''),
      approved = false,
      approved_by = null,
      approved_at = null
  where id = p_user;

  return found;
end;
$$;


--
-- Name: revoke_invite(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_invite(p_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.invites
  set revoked = true,
      revoked_at = now()
  where id = p_id
    and coalesce(revoked, false) = false;

  return found;
end;
$$;


--
-- Name: set_stage_participation(bigint, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_stage_participation(p_stage_id bigint, p_going boolean) RETURNS TABLE(ok boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_status text;
  v_open timestamptz;
  v_close timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select status::text, signup_open_at, signup_close_at
    into v_status, v_open, v_close
  from public.stages
  where id = p_stage_id;

  if v_status is null then
    raise exception 'stage_not_found';
  end if;

  if v_status <> 'signup_open' then
    raise exception 'signup_not_open: current=%', v_status;
  end if;

  if v_open is not null and now() < v_open then
    raise exception 'signup_not_open_yet';
  end if;

  if v_close is not null and now() > v_close then
    raise exception 'signup_already_closed';
  end if;

  insert into public.stage_participants(stage_id, athlete_id, going, responded_at)
  values (p_stage_id, auth.uid(), p_going, now())
  on conflict (stage_id, athlete_id)
  do update set going = excluded.going, responded_at = now();

  return query select true;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


--
-- Name: start_stage(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_stage(p_stage_id bigint) RETURNS TABLE(ok boolean, new_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  select status::text into v_status from public.stages where id = p_stage_id;
  if v_status is null then raise exception 'stage_not_found'; end if;

  if v_status <> 'signup_closed' then
    raise exception 'invalid_status_transition: current=%', v_status;
  end if;

  update public.stages
    set status = 'running',
        updated_at = now()
  where id = p_stage_id;

  return query select true, 'running'::text;
end;
$$;


--
-- Name: upsert_profile(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_profile(p_nome text, p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.profiles(id, nome, email)
  values (auth.uid(), nullif(trim(p_nome), ''), nullif(trim(p_email), ''))
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email;

  return true;
end;
$$;


--
-- Name: validate_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_invite(p_token text) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.invites i
    where i.token = p_token
      and i.used = false
      and i.expires_at > now()
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text,
    approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejected boolean DEFAULT false NOT NULL,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    rejected_reason text,
    categoria text,
    category text,
    category_set_at timestamp with time zone,
    category_set_by uuid,
    season_id uuid,
    shirt_size text,
    shirt_size_updated_at timestamp with time zone,
    reject_reason text,
    birth_date date,
    CONSTRAINT profiles_categoria_chk CHECK (((categoria IS NULL) OR (categoria = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])))),    CONSTRAINT profiles_birth_date_sane CHECK (((birth_date IS NULL) OR ((birth_date <= CURRENT_DATE) AND (birth_date >= (CURRENT_DATE - '120 years'::interval))))),

    CONSTRAINT profiles_category_check CHECK ((category = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])))
);


--
-- Name: stage_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stage_participants (
    id bigint NOT NULL,
    stage_id bigint NOT NULL,
    athlete_id uuid NOT NULL,
    going boolean NOT NULL,
    responded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_stage_participants_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_stage_participants_view AS
 SELECT sp.stage_id,
    sp.athlete_id,
    sp.going,
    sp.responded_at,
    p.nome AS full_name,
    p.email,
    p.categoria AS category
   FROM (public.stage_participants sp
     JOIN public.profiles p ON ((p.id = sp.athlete_id)));


--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: category_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_history (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    season_id uuid,
    category text NOT NULL,
    set_by uuid,
    set_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    CONSTRAINT category_history_category_check CHECK ((category = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])))
);


--
-- Name: category_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_history_id_seq OWNED BY public.category_history.id;


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id uuid DEFAULT extensions.gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city text,
    courts_count integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.club_status DEFAULT 'active'::public.club_status NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT clubs_courts_count_check CHECK ((courts_count >= 1))
);


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id bigint NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    used_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    uses integer DEFAULT 0 NOT NULL,
    max_uses integer DEFAULT 1 NOT NULL,
    created_by uuid,
    used_at timestamp with time zone
);


--
-- Name: invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invites_id_seq OWNED BY public.invites.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    type public.payment_type NOT NULL,
    season_id bigint,
    stage_no integer,
    amount numeric(12,2) NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    method text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount >= (0)::numeric))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status public.season_status DEFAULT 'draft'::public.season_status NOT NULL,
    year integer,
    starts_on date,
    ends_on date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stage_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stage_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stage_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stage_participants_id_seq OWNED BY public.stage_participants.id;


--
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages (
    id bigint NOT NULL,
    season_id uuid NOT NULL,
    club_id uuid NOT NULL,
    name text NOT NULL,
    stage_date timestamp with time zone,
    courts_used integer DEFAULT 1 NOT NULL,
    signup_open_at timestamp with time zone,
    signup_close_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stage_no integer,
    starts_on date,
    ends_on date,
    CONSTRAINT stages_courts_used_check CHECK ((courts_used >= 1)),
    CONSTRAINT stages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'signup_open'::text, 'signup_closed'::text, 'running'::text, 'finished'::text, 'canceled'::text])))
);


--
-- Name: stages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stages_id_seq OWNED BY public.stages.id;


--
-- Name: v_athlete_finance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_athlete_finance AS
 SELECT p.id AS user_id,
    p.nome,
    p.email,
    p.approved,
    p.category,
    p.shirt_size,
    COALESCE(sum(
        CASE
            WHEN (pay.type = 'season'::public.payment_type) THEN pay.amount
            ELSE NULL::numeric
        END), (0)::numeric) AS season_paid_total,
    COALESCE(sum(
        CASE
            WHEN (pay.type = 'stage'::public.payment_type) THEN pay.amount
            ELSE NULL::numeric
        END), (0)::numeric) AS stage_paid_total,
    max(
        CASE
            WHEN (pay.type = 'season'::public.payment_type) THEN pay.paid_at
            ELSE NULL::timestamp with time zone
        END) AS last_season_paid_at,
    max(
        CASE
            WHEN (pay.type = 'stage'::public.payment_type) THEN pay.paid_at
            ELSE NULL::timestamp with time zone
        END) AS last_stage_paid_at
   FROM (public.profiles p
     LEFT JOIN public.payments pay ON ((pay.user_id = p.id)))
  GROUP BY p.id, p.nome, p.email, p.approved, p.category, p.shirt_size;


--
-- Name: v_stage_participants_grouped; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_stage_participants_grouped AS
 SELECT sp.stage_id,
    s.name AS stage_name,
    s.starts_on,
    sp.athlete_id AS profile_id,
    COALESCE(NULLIF((to_jsonb(p.*) ->> 'full_name'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'nome'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'name'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'email'::text), ''::text), 'Sem nome'::text) AS athlete_name,
    COALESCE(NULLIF((to_jsonb(p.*) ->> 'categoria'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'category'::text), ''::text), 'Sem categoria'::text) AS category,
    sp.responded_at
   FROM ((public.stage_participants sp
     JOIN public.stages s ON ((s.id = sp.stage_id)))
     JOIN public.profiles p ON ((p.id = sp.athlete_id)))
  WHERE (sp.going = true)
  ORDER BY s.starts_on DESC NULLS LAST, COALESCE(NULLIF((to_jsonb(p.*) ->> 'categoria'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'category'::text), ''::text), 'Sem categoria'::text), COALESCE(NULLIF((to_jsonb(p.*) ->> 'full_name'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'nome'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'name'::text), ''::text), NULLIF((to_jsonb(p.*) ->> 'email'::text), ''::text), 'Sem nome'::text);


--
-- Name: category_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_history ALTER COLUMN id SET DEFAULT nextval('public.category_history_id_seq'::regclass);


--
-- Name: invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites ALTER COLUMN id SET DEFAULT nextval('public.invites_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: stage_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_participants ALTER COLUMN id SET DEFAULT nextval('public.stage_participants_id_seq'::regclass);


--
-- Name: stages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages ALTER COLUMN id SET DEFAULT nextval('public.stages_id_seq'::regclass);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (user_id);


--
-- Name: category_history category_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_history
    ADD CONSTRAINT category_history_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: stage_participants stage_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_participants
    ADD CONSTRAINT stage_participants_pkey PRIMARY KEY (id);


--
-- Name: stage_participants stage_participants_stage_id_athlete_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_participants
    ADD CONSTRAINT stage_participants_stage_id_athlete_id_key UNIQUE (stage_id, athlete_id);


--
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);


--
-- Name: category_history_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX category_history_user_idx ON public.category_history USING btree (user_id, set_at DESC);


--
-- Name: payments_stage_no_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_stage_no_idx ON public.payments USING btree (stage_no);


--
-- Name: payments_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_type_idx ON public.payments USING btree (type);


--
-- Name: payments_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_user_id_idx ON public.payments USING btree (user_id);


--
-- Name: profiles_categoria_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_categoria_idx ON public.profiles USING btree (categoria);


--
-- Name: seasons_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX seasons_one_active ON public.seasons USING btree (is_active) WHERE (is_active = true);


--
-- Name: stage_participants_athlete_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stage_participants_athlete_id_idx ON public.stage_participants USING btree (athlete_id);


--
-- Name: stage_participants_stage_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stage_participants_stage_id_idx ON public.stage_participants USING btree (stage_id);


--
-- Name: stages_club_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_club_idx ON public.stages USING btree (club_id);


--
-- Name: stages_season_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_season_idx ON public.stages USING btree (season_id);


--
-- Name: stages_signup_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_signup_window_idx ON public.stages USING btree (signup_open_at, signup_close_at);


--
-- Name: stages_stage_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_stage_date_idx ON public.stages USING btree (stage_date);


--
-- Name: stages_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stages_status_idx ON public.stages USING btree (status);


--
-- Name: stage_participants trg_stage_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stage_participants_updated_at BEFORE UPDATE ON public.stage_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stages trg_stages_enforce_courts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stages_enforce_courts BEFORE INSERT OR UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.enforce_courts_used();


--
-- Name: stages trg_stages_single_open; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stages_single_open BEFORE INSERT OR UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.enforce_single_open_stage();


--
-- Name: stages trg_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stages_updated_at BEFORE UPDATE ON public.stages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admins admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: category_history category_history_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_history
    ADD CONSTRAINT category_history_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: category_history category_history_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_history
    ADD CONSTRAINT category_history_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: category_history category_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_history
    ADD CONSTRAINT category_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invites invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES auth.users(id);


--
-- Name: stage_participants stage_participants_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_participants
    ADD CONSTRAINT stage_participants_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: stage_participants stage_participants_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stage_participants
    ADD CONSTRAINT stage_participants_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE CASCADE;


--
-- Name: stages stages_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE RESTRICT;


--
-- Name: stages stages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: stages stages_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE RESTRICT;


--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs clubs_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_admin_all ON public.clubs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: clubs clubs_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_admin_write ON public.clubs TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: clubs clubs_athlete_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_athlete_read ON public.clubs FOR SELECT TO authenticated USING ((status = 'active'::public.club_status));


--
-- Name: clubs clubs_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_select_all ON public.clubs FOR SELECT TO authenticated USING (true);


--
-- Name: invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

--
-- Name: invites invites_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invites_admin_all ON public.invites TO authenticated USING (public.is_admin());


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_insert_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_insert_admin_only ON public.payments FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: payments payments_select_admin_or_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_admin_or_own ON public.payments FOR SELECT USING ((public.is_admin() OR (user_id = auth.uid())));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: profiles profiles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: seasons seasons_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seasons_admin_all ON public.seasons TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: seasons seasons_athlete_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seasons_athlete_read ON public.seasons FOR SELECT TO authenticated USING ((status = ANY (ARRAY['open'::public.season_status, 'closed'::public.season_status])));


--
-- Name: stage_participants sp_delete_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sp_delete_admin_only ON public.stage_participants FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: stage_participants sp_insert_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sp_insert_own_or_admin ON public.stage_participants FOR INSERT TO authenticated WITH CHECK (((athlete_id = auth.uid()) OR public.is_admin()));


--
-- Name: stage_participants sp_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sp_select_own_or_admin ON public.stage_participants FOR SELECT TO authenticated USING (((athlete_id = auth.uid()) OR public.is_admin()));


--
-- Name: stage_participants sp_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sp_update_own_or_admin ON public.stage_participants FOR UPDATE TO authenticated USING (((athlete_id = auth.uid()) OR public.is_admin())) WITH CHECK (((athlete_id = auth.uid()) OR public.is_admin()));


--
-- Name: stage_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stage_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

--
-- Name: stages stages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_admin_all ON public.stages TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stages stages_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_admin_write ON public.stages TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stages stages_athlete_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_athlete_read ON public.stages FOR SELECT TO authenticated USING (((status <> 'canceled'::text) AND (EXISTS ( SELECT 1
   FROM public.seasons s
  WHERE ((s.id = stages.season_id) AND (s.status = ANY (ARRAY['open'::public.season_status, 'closed'::public.season_status])))))));


--
-- Name: stages stages_select_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_select_admin_all ON public.stages FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: stages stages_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_select_all ON public.stages FOR SELECT TO authenticated USING (true);


--
-- Name: stages stages_select_signup_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stages_select_signup_open ON public.stages FOR SELECT TO authenticated USING (((status = 'signup_open'::text) AND ((signup_open_at IS NULL) OR (now() >= signup_open_at)) AND ((signup_close_at IS NULL) OR (now() <= signup_close_at))));


--
-- PostgreSQL database dump complete
--

\unrestrict kaMCtvN95AnjHf91VfEhg7xEG7IP9pRUWw3RhgznBp42ECz6Zmw9LUaMkVMerTl

