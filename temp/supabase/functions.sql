create or replace function app.capabilities(scope_type text, scope uuid)
returns jsonb language plpgsql stable as $$
declare
  pid uuid := app.current_profile_id();
  caps jsonb := '{}'::jsonb;
begin
  if pid is null then return '{}'::jsonb; end if;

  if exists (
    select 1 from app.role_assignments ra
    where ra.user_id = pid and ra.scope_type = scope_type and ra.scope_id = scope
  ) then
    caps := caps || jsonb_build_object('member', true);
  end if;

  return caps;
end;
$$;

create or replace function app.consent_ok(p_client uuid, p_purpose text, p_scope_type text, p_scope_id uuid)
returns boolean language sql stable as $$
  select coalesce(
    (app.clients.consent ->> 'allowed_purposes')::jsonb ? p_purpose, false
  ) from app.clients where id = p_client
$$;

create or replace function app.match_clients(p_fingerprint text, p_tenant uuid, p_limit int default 5)
returns table (id uuid, initials text, approx_age int) language sql stable as $$
  select c.id,
         upper(substr(coalesce((c.pii_ref->>'first_name'),'X'),1,1) || substr(coalesce((c.pii_ref->>'last_name'),'X'),1,1)) as initials,
         null::int as approx_age
  from app.clients c
  where c.tenant_root_id = p_tenant
    and c.fingerprint = p_fingerprint
  limit p_limit
$$;

create or replace function app.find_available(p_pred jsonb, p_limit int default 50)
returns table (location_id uuid, available int) language sql stable as $$
  select a.location_id, a.available
  from app.availability a
  where a.available > 0 and a.attributes @> p_pred
  order by a.available desc
  limit p_limit
$$;
