-- Prevent album rows from being reassigned to another collection owner.
-- Editors can update album details through RLS, but ownership is immutable
-- after insert so a compromised client cannot move records across users.
create or replace function public.prevent_album_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Album owner cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_album_owner_change on public.albums;
create trigger prevent_album_owner_change
before update on public.albums
for each row
execute function public.prevent_album_owner_change();
