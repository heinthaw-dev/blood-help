-- Give the expansion job its own credential.
--
-- 20260925000000 had run_radius_expansion() present the project's service role key
-- to the edge function, which meant the key had to be copied into Vault by hand —
-- a setup step that is easy to skip and leaves ring alerts silently undelivered
-- until someone notices. Postgres can mint its own token instead: generated here,
-- never leaving the database, checked by the same database on the way back in.

-- ---------------------------------------------------------------------------
-- The token
-- ---------------------------------------------------------------------------
-- gen_random_bytes, not a literal: the value is created inside the database and is
-- never typed, logged, or pasted anywhere. Guarded so a re-run keeps the existing
-- token rather than minting a second one that the cron job would not be using.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'radius_job_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'radius_job_token',
      'Bearer token pg_cron presents to the expand-radius edge function.'
    );
  end if;
end;
$$;

-- Not a secret — the public API host, and the one value the database cannot derive
-- for itself (Postgres is told nothing about its own project ref). It is seeded into
-- Vault rather than baked into the job so a different project, or a preview branch,
-- is a one-row update instead of a migration:
--   select vault.update_secret(id, 'https://<ref>.supabase.co')
--   from vault.secrets where name = 'project_url';
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret(
      'https://dfrpqkutjsnfgkdmcadi.supabase.co',
      'project_url',
      'Base URL of this project''s API, used to reach edge functions.'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The claim, now authenticated
-- ---------------------------------------------------------------------------
-- The token check lives inside the claim rather than in the worker so there is no
-- path that drains the queue without presenting it: an unauthenticated caller that
-- somehow reaches the function still cannot move a single ring.
create or replace function public.claim_radius_expansion_events(
  p_token text,
  p_limit int default 50
)
returns table (
  event_id uuid,
  request_id uuid,
  inner_km int,
  outer_km int,
  blood_type public.blood_type,
  lat double precision,
  lng double precision,
  urgency public.urgency,
  current_address text,
  still_alerting boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'radius_job_token';
  -- Plain equality: the token is 256 bits of random hex behind a network round trip,
  -- so a timing oracle on the comparison is not a practical way in.
  if v_token is null or p_token is null or p_token <> v_token then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  with claimed as (
    update public.radius_expansion_events e
    set attempts = e.attempts + 1
    where e.id in (
      select e2.id
      from public.radius_expansion_events e2
      where e2.notified_at is null
        and e2.attempts < 5
      order by e2.created_at
      for update skip locked
      limit p_limit
    )
    returning e.id, e.request_id, e.inner_km, e.outer_km
  )
  select
    c.id,
    c.request_id,
    c.inner_km,
    c.outer_km,
    r.blood_type,
    r.lat,
    r.lng,
    r.urgency,
    r.current_address,
    (
      r.status = 'active'
      and not exists (
        select 1
        from public.request_responses rr
        where rr.request_id = r.id
          and rr.status = 'responding'
      )
    )
  from claimed c
  join public.blood_requests r on r.id = c.request_id;
end;
$function$;

comment on function public.claim_radius_expansion_events(text, int) is
  'Atomically claims pending ring alerts for the expand-radius worker. Rejects any caller that cannot present the radius_job_token held in Vault.';

-- The unauthenticated overload from 20260925000000 must not survive: leaving it in
-- place would keep an unprotected way to drain the queue.
drop function if exists public.claim_radius_expansion_events(int);

-- ---------------------------------------------------------------------------
-- The tick, now presenting the token
-- ---------------------------------------------------------------------------
create or replace function public.run_radius_expansion()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pending int;
  v_url     text;
  v_token   text;
begin
  -- Step 1 — move the radius. Always runs, never network-bound: the number on the
  -- requester's screen must not depend on FCM, the network, or the edge function.
  perform public.expand_request_radius();

  -- Step 2 — poke the delivery worker, but only if a ring is actually owed. An idle
  -- project must not make an HTTP call every minute for nothing.
  select count(*) into v_pending
  from public.radius_expansion_events
  where notified_at is null
    and attempts < 5;

  if v_pending = 0 then
    return;
  end if;

  select decrypted_secret into v_url   from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'radius_job_token';

  if v_url is null or v_token is null then
    raise warning '[radius] % ring alert(s) pending but vault secrets project_url/radius_job_token are unset — radius still widened', v_pending;
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/expand-radius',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

comment on function public.run_radius_expansion() is
  'Cron entry point: widens due requests, then asks the expand-radius edge function to deliver any owed ring alerts. Delivery failures never block widening.';

revoke all on function public.claim_radius_expansion_events(text, int) from public, anon, authenticated;
