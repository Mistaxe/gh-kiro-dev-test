alter table app.users_profile enable row level security;
alter table app.organizations enable row level security;
alter table app.service_locations enable row level security;
alter table app.clients enable row level security;
alter table app.client_cases enable row level security;
alter table app.notes enable row level security;
alter table app.referrals enable row level security;

create or replace function app.current_profile_id() returns uuid
language sql stable as $$
  select id from app.users_profile where auth_user_id = auth.uid()
$$;

-- Users can see their own profile
create policy users_self_select on app.users_profile
  for select using (id = app.current_profile_id());
create policy users_self_update on app.users_profile
  for update using (id = app.current_profile_id());

-- Organizations: only members can select
create policy orgs_member_select on app.organizations
  for select using (
    exists (
      select 1 from app.role_assignments ra
      join app.roles r on r.id = ra.role_id
      where ra.user_id = app.current_profile_id()
        and ra.scope_type = 'org'
        and ra.scope_id = organizations.id
    )
  );

-- Service Locations: visible if member of owning org or location-specific role
create policy loc_member_select on app.service_locations
  for select using (
    exists (
      select 1 from app.role_assignments ra
      where ra.user_id = app.current_profile_id()
        and (
          (ra.scope_type='org' and ra.scope_id = service_locations.org_id) or
          (ra.scope_type='location' and ra.scope_id = service_locations.id)
        )
    )
  );

-- Clients: tenant isolation
create policy clients_tenant_select on app.clients
  for select using (
    exists (
      select 1 from app.role_assignments ra
      join app.organizations o on o.id = ra.scope_id and ra.scope_type='org'
      where ra.user_id = app.current_profile_id()
        and clients.tenant_root_id = o.id
    )
  );

-- Notes/Referrals: tenant-bound (fine-grain enforced at service layer)
create policy notes_tenant_select on app.notes
  for select using (
    exists (
      select 1 from app.role_assignments ra
      join app.organizations o on o.id = ra.scope_id and ra.scope_type='org'
      where ra.user_id = app.current_profile_id()
    )
  );
