-- ============================================================================
-- 010 — Transfer collection ownership
-- ============================================================================
-- Adds a SECURITY DEFINER RPC the app can call to atomically hand a
-- collection over to an existing collaborator. Also relaxes the
-- prevent_album_owner_change trigger so the RPC can perform the move while
-- still blocking *every other* attempt to change albums.user_id.
-- ============================================================================


-- Trigger function update: bypass when the transfer RPC sets a session-local
-- flag. Every other UPDATE that changes user_id still raises.
create or replace function public.prevent_album_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    if coalesce(current_setting('vinylvault.allow_owner_transfer', true), '') = 'true' then
      return new;
    end if;
    raise exception 'album ownership cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;


-- The transfer itself. SECURITY DEFINER so it can update rows the caller
-- couldn't reach via RLS (notably collection_members rows pointing at the
-- new owner). Strict validation inside the function gates who can do what.
create or replace function public.transfer_collection_ownership(new_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  recipient_email text;
  affected_albums int := 0;
begin
  if caller_id is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if caller_id = new_owner_id then
    raise exception 'You cannot transfer the collection to yourself.'
      using errcode = '22023';
  end if;

  -- Recipient must already be a collaborator the caller has invited and that
  -- has accepted (i.e. exists in collection_members). This prevents handing
  -- the collection to a stranger and keeps the consent model intact.
  if not exists (
    select 1 from public.collection_members
    where owner_id = caller_id and member_id = new_owner_id
  ) then
    raise exception 'The recipient must already be a collaborator on this collection. Invite them as an editor first, wait for them to accept, then transfer.'
      using errcode = '42501';
  end if;

  select email into caller_email from auth.users where id = caller_id;
  select email into recipient_email from auth.users where id = new_owner_id;

  -- Open the trigger bypass for the rest of this transaction.
  perform set_config('vinylvault.allow_owner_transfer', 'true', true);

  -- Move every album the caller owns to the new owner.
  update public.albums
    set user_id = new_owner_id
    where user_id = caller_id;
  get diagnostics affected_albums = row_count;

  -- Remove the recipient's old "member of caller's collection" row so they
  -- don't end up as a member of themselves after the next step.
  delete from public.collection_members
    where owner_id = caller_id and member_id = new_owner_id;

  -- Reassign every remaining membership of the caller's collection to the
  -- new owner. Other collaborators X / Y / Z keep their access — they're
  -- now members of the new owner's collection automatically.
  update public.collection_members
    set owner_id = new_owner_id,
        owner_email = recipient_email
    where owner_id = caller_id;

  -- Add the previous owner as an editor of the new owner's collection so
  -- they retain full edit access (just not "owner" privileges like inviting
  -- collaborators or listing to marketplaces).
  insert into public.collection_members
    (owner_id, owner_email, member_id, member_email, role)
  values
    (new_owner_id, recipient_email, caller_id, caller_email, 'editor')
  on conflict (owner_id, member_id) do update
    set role = 'editor',
        member_email = excluded.member_email,
        owner_email = excluded.owner_email;

  -- Migrate any pending invites the caller had open. The new owner inherits
  -- them so invitees don't get a 404 on accept.
  update public.collection_invites
    set owner_id = new_owner_id,
        owner_email = recipient_email
    where owner_id = caller_id;

  return jsonb_build_object(
    'ok', true,
    'albumsTransferred', affected_albums,
    'previousOwnerId', caller_id,
    'newOwnerId', new_owner_id
  );
end;
$$;

-- Lock the function down: only authenticated users can invoke; the function
-- itself checks auth.uid() and the membership precondition.
revoke all on function public.transfer_collection_ownership(uuid) from public;
grant execute on function public.transfer_collection_ownership(uuid) to authenticated;


-- Refresh PostgREST so the RPC is callable immediately via the JS client.
notify pgrst, 'reload schema';
