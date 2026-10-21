-- ============================================================================
-- 011 — Guard owner-only marketplace, sale, and fulfillment fields
-- ============================================================================
-- Shared editors can update catalogue details through RLS, but marketplace
-- listings, sale state, and fulfillment details are owner-only workflows. This
-- trigger blocks direct client updates to those columns unless the authenticated
-- user owns the collection.
-- ============================================================================

create or replace function public.prevent_editor_marketplace_field_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if auth.uid() is distinct from old.user_id and (
    new.status is distinct from old.status
    or new.sold_price is distinct from old.sold_price
    or new.sold_at is distinct from old.sold_at
    or new.ebay_listing_id is distinct from old.ebay_listing_id
    or new.ebay_listing_url is distinct from old.ebay_listing_url
    or new.discogs_listing_id is distinct from old.discogs_listing_id
    or new.discogs_listing_url is distinct from old.discogs_listing_url
    or new.discogs_release_id is distinct from old.discogs_release_id
    or new.list_price is distinct from old.list_price
    or new.tracking_number is distinct from old.tracking_number
    or new.shipping_label_url is distinct from old.shipping_label_url
    or new.shipping_carrier is distinct from old.shipping_carrier
    or new.shipping_rate is distinct from old.shipping_rate
    or new.buyer_name is distinct from old.buyer_name
    or new.buyer_address_raw is distinct from old.buyer_address_raw
  ) then
    raise exception 'only the collection owner can update marketplace, sale, or fulfillment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_editor_marketplace_field_changes on public.albums;

create trigger prevent_editor_marketplace_field_changes
before update on public.albums
for each row
execute function public.prevent_editor_marketplace_field_changes();

revoke all on function public.prevent_editor_marketplace_field_changes() from public;
