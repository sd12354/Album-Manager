-- ============================================================
-- Collection sharing: invite others to view/manage a collection
-- ============================================================

-- Who can access whose collection, and with what permission.
create table if not exists collection_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  owner_email text,
  member_id uuid not null references auth.users on delete cascade,
  member_email text,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  created_at timestamptz default now(),
  unique (owner_id, member_id)
);

alter table collection_members enable row level security;

-- Owner and member can both see the membership row.
create policy "View own memberships" on collection_members for select
  using (auth.uid() = owner_id or auth.uid() = member_id);

-- Owners manage their collaborators.
create policy "Owner manages members" on collection_members for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- A member can remove themselves (leave a shared collection).
create policy "Member can leave" on collection_members for delete
  using (auth.uid() = member_id);

-- Pending email invitations. Claimed into a membership when the invited
-- email signs in (or via an explicit accept).
create table if not exists collection_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  owner_email text,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid references auth.users,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  unique (owner_id, email)
);

alter table collection_invites enable row level security;

-- Owners manage invites they created.
create policy "Owner manages invites" on collection_invites for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- An invitee can see invites addressed to their email.
create policy "Invitee sees their invites" on collection_invites for select
  using (
    lower(email) = lower((select email from auth.users where id = auth.uid()))
  );

-- ------------------------------------------------------------
-- Helper: is the current user a member of owner's collection?
-- SECURITY DEFINER so it can be referenced from RLS policies on other
-- tables without recursion or needing direct select grants.
-- ------------------------------------------------------------
create or replace function is_collection_member(
  p_owner uuid,
  p_require_editor boolean default false
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from collection_members m
    where m.owner_id = p_owner
      and m.member_id = auth.uid()
      and (not p_require_editor or m.role = 'editor')
  );
$$;

-- ------------------------------------------------------------
-- Albums: allow shared read + editor write
-- ------------------------------------------------------------
drop policy if exists "Users own albums" on albums;

create policy "Read own or shared albums" on albums for select
  using (auth.uid() = user_id or is_collection_member(user_id));

create policy "Insert own or as editor" on albums for insert
  with check (auth.uid() = user_id or is_collection_member(user_id, true));

create policy "Update own or as editor" on albums for update
  using (auth.uid() = user_id or is_collection_member(user_id, true))
  with check (auth.uid() = user_id or is_collection_member(user_id, true));

create policy "Delete own or as editor" on albums for delete
  using (auth.uid() = user_id or is_collection_member(user_id, true));

-- ------------------------------------------------------------
-- Pricing cache: follow album access
-- ------------------------------------------------------------
drop policy if exists "Users own cache" on pricing_cache;

create policy "Read cache for accessible albums" on pricing_cache for select
  using (
    auth.uid() = (select user_id from albums where id = album_id)
    or is_collection_member((select user_id from albums where id = album_id))
  );

create policy "Write cache as owner or editor" on pricing_cache for all
  using (
    auth.uid() = (select user_id from albums where id = album_id)
    or is_collection_member((select user_id from albums where id = album_id), true)
  )
  with check (
    auth.uid() = (select user_id from albums where id = album_id)
    or is_collection_member((select user_id from albums where id = album_id), true)
  );

-- ------------------------------------------------------------
-- Storage: members can view shared photos, editors can upload/delete.
-- Photos live under "<owner_id>/<album_id>/<file>".
-- ------------------------------------------------------------
create policy "Members can view shared photos"
on storage.objects for select
using (
  bucket_id = 'album-photos'
  and is_collection_member(((storage.foldername(name))[1])::uuid)
);

create policy "Editors can upload shared photos"
on storage.objects for insert
with check (
  bucket_id = 'album-photos'
  and is_collection_member(((storage.foldername(name))[1])::uuid, true)
);

create policy "Editors can delete shared photos"
on storage.objects for delete
using (
  bucket_id = 'album-photos'
  and is_collection_member(((storage.foldername(name))[1])::uuid, true)
);
