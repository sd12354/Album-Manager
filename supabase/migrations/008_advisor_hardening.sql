-- Address safe Supabase advisor findings without changing app-facing behavior.

-- Pin the trigger function search path so it cannot be affected by caller role
-- settings.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Public buckets do not need a broad storage.objects SELECT policy for direct
-- public URL access. Keeping this policy allowed clients to list every object in
-- the bucket.
drop policy if exists "Public can view album photos" on storage.objects;

-- Cover foreign keys used by joins, RLS checks, and cascades.
create index if not exists albums_user_id_idx
  on public.albums (user_id);

create index if not exists collection_members_member_id_idx
  on public.collection_members (member_id);

create index if not exists collection_invites_invited_by_idx
  on public.collection_invites (invited_by);
