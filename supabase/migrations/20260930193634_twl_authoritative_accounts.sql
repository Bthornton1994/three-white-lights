-- Additive Three White Lights authority. Browsers receive no table or RPC grants.
create table public.twl_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object' and state->'version' is not distinct from '1'::jsonb),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.twl_request_receipts (
  user_id uuid not null references public.twl_accounts(user_id) on delete cascade,
  request_id text not null check (length(request_id) between 1 and 200 and request_id ~ '^[A-Za-z0-9._:-]+$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, request_id)
);
alter table public.twl_accounts enable row level security;
alter table public.twl_request_receipts enable row level security;
revoke all on public.twl_accounts, public.twl_request_receipts from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.twl_accounts to service_role;
grant select, insert, delete on public.twl_request_receipts to service_role;

create function public.twl_read_account(p_user_id uuid, p_request_id text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.twl_accounts%rowtype;
  receipt public.twl_request_receipts%rowtype;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  select * into account from public.twl_accounts where user_id = p_user_id;
  if p_request_id is not null then
    select * into receipt from public.twl_request_receipts where user_id = p_user_id and request_id = p_request_id;
  end if;
  return jsonb_build_object('state', account.state, 'revision', coalesce(account.revision, 0), 'nowMs', now_ms,
    'receipt', case when receipt.request_id is null then null else jsonb_build_object('payloadHash', receipt.payload_hash, 'response', receipt.response) end);
end;
$$;

create function public.twl_initialize_account(p_user_id uuid, p_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if jsonb_typeof(p_state) is distinct from 'object'
    or p_state->'version' is distinct from '1'::jsonb
    or octet_length(p_state::text) > 8388608
    or jsonb_typeof(p_state->'gameSave') is distinct from 'string'
    or jsonb_typeof(p_state->'facilitySave') is distinct from 'string'
    or jsonb_typeof(p_state->'facilityAtMs') is distinct from 'number'
    or jsonb_typeof(p_state->'presenceAtMs') is distinct from 'number'
    then raise exception 'Invalid TWL account state';
  end if;
  if (p_state->>'facilityAtMs')::numeric < 0 or (p_state->>'presenceAtMs')::numeric < 0
    or trunc((p_state->>'facilityAtMs')::numeric) <> (p_state->>'facilityAtMs')::numeric
    or trunc((p_state->>'presenceAtMs')::numeric) <> (p_state->>'presenceAtMs')::numeric
    or (p_state->>'facilityAtMs')::numeric > now_ms or (p_state->>'presenceAtMs')::numeric > now_ms
    then raise exception 'Invalid TWL account clock';
  end if;
  insert into public.twl_accounts(user_id, state) values (p_user_id, p_state) on conflict (user_id) do nothing;
  return public.twl_read_account(p_user_id);
end;
$$;

create function public.twl_commit_account(p_user_id uuid, p_expected_revision bigint, p_request_id text, p_payload_hash text, p_state jsonb, p_response jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account public.twl_accounts%rowtype;
  receipt public.twl_request_receipts%rowtype;
  now_ms bigint;
  outcome text;
begin
  -- The account row lock orders both the revision decision and receipt insertion.
  select * into account from public.twl_accounts where user_id = p_user_id for update;
  if not found then raise exception 'TWL account does not exist'; end if;
  now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  select * into receipt from public.twl_request_receipts where user_id = p_user_id and request_id = p_request_id;
  if found then
    outcome := case when receipt.payload_hash = p_payload_hash then 'duplicate' else 'idempotency-conflict' end;
    return jsonb_build_object('kind', outcome, 'state', account.state, 'revision', account.revision, 'nowMs', now_ms, 'response', receipt.response);
  end if;
  if p_expected_revision is distinct from account.revision then
    return jsonb_build_object('kind', 'conflict', 'state', account.state, 'revision', account.revision, 'nowMs', now_ms);
  end if;
  if jsonb_typeof(p_state) is distinct from 'object'
    or p_state->'version' is distinct from '1'::jsonb
    or octet_length(p_state::text) > 8388608
    or jsonb_typeof(p_state->'gameSave') is distinct from 'string'
    or jsonb_typeof(p_state->'facilitySave') is distinct from 'string'
    or jsonb_typeof(p_state->'facilityAtMs') is distinct from 'number'
    or jsonb_typeof(p_state->'presenceAtMs') is distinct from 'number'
    then raise exception 'Invalid TWL account state';
  end if;
  if trunc((p_state->>'facilityAtMs')::numeric) <> (p_state->>'facilityAtMs')::numeric
    or trunc((p_state->>'presenceAtMs')::numeric) <> (p_state->>'presenceAtMs')::numeric
    or (p_state->>'facilityAtMs')::numeric > now_ms or (p_state->>'presenceAtMs')::numeric > now_ms
    or (p_state->>'facilityAtMs')::numeric < (account.state->>'facilityAtMs')::numeric
    or (p_state->>'presenceAtMs')::numeric < (account.state->>'presenceAtMs')::numeric
    then raise exception 'Invalid TWL account clock';
  end if;
  update public.twl_accounts set state = p_state, revision = revision + 1, updated_at = clock_timestamp() where user_id = p_user_id returning * into account;
  -- Any receipt constraint failure rolls back the preceding account update too.
  insert into public.twl_request_receipts(user_id, request_id, payload_hash, response) values (p_user_id, p_request_id, p_payload_hash, p_response);
  return jsonb_build_object('kind', 'saved', 'state', account.state, 'revision', account.revision, 'nowMs', now_ms, 'response', p_response);
end;
$$;

revoke all on function public.twl_read_account(uuid, text) from public, anon, authenticated;
revoke all on function public.twl_initialize_account(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.twl_commit_account(uuid, bigint, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.twl_read_account(uuid, text) to service_role;
grant execute on function public.twl_initialize_account(uuid, jsonb) to service_role;
grant execute on function public.twl_commit_account(uuid, bigint, text, text, jsonb, jsonb) to service_role;
