-- Prevent collaborators from moving albums out of a shared collection by
-- changing the owner column during an otherwise-authorized update.
create or replace function public.prevent_album_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'album ownership cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_album_owner_change on public.albums;

create trigger prevent_album_owner_change
before update of user_id on public.albums
for each row
execute function public.prevent_album_owner_change();

revoke all on function public.prevent_album_owner_change() from public;
