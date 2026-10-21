-- Shared editors can help maintain catalogue details, photos, and pricing, but
-- marketplace connections, sale state, buyer details, and shipping metadata are
-- owned by the collection owner. Guard those fields at the database layer so a
-- client-side bug or direct API call cannot bypass the app's owner-only checks.

create or replace function public.prevent_editor_marketplace_field_updates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = old.user_id then
    return new;
  end if;

  if is_collection_member(old.user_id, true) then
    if new.ebay_listing_id is distinct from old.ebay_listing_id
      or new.ebay_listing_url is distinct from old.ebay_listing_url
      or new.discogs_listing_id is distinct from old.discogs_listing_id
      or new.discogs_listing_url is distinct from old.discogs_listing_url
      or new.list_price is distinct from old.list_price
      or new.sold_price is distinct from old.sold_price
      or new.sold_at is distinct from old.sold_at
      or new.buyer_name is distinct from old.buyer_name
      or new.buyer_address_raw is distinct from old.buyer_address_raw
      or new.tracking_number is distinct from old.tracking_number
      or new.shipping_label_url is distinct from old.shipping_label_url
      or new.shipping_carrier is distinct from old.shipping_carrier
      or new.shipping_rate is distinct from old.shipping_rate
    then
      raise exception 'Shared editors cannot update owner-only marketplace fields'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_editor_marketplace_fields on public.albums;

create trigger guard_editor_marketplace_fields
before update on public.albums
for each row
execute function public.prevent_editor_marketplace_field_updates();
