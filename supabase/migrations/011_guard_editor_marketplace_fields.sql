-- Shared editors can manage catalogue data, but marketplace, sale, and
-- fulfillment fields must remain owner-only even when using the browser client.
create or replace function guard_editor_marketplace_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id = auth.uid() then
    return new;
  end if;

  if old.status is distinct from new.status
    or old.ebay_listing_id is distinct from new.ebay_listing_id
    or old.ebay_listing_url is distinct from new.ebay_listing_url
    or old.discogs_listing_id is distinct from new.discogs_listing_id
    or old.discogs_listing_url is distinct from new.discogs_listing_url
    or old.sold_price is distinct from new.sold_price
    or old.sold_at is distinct from new.sold_at
    or old.tracking_number is distinct from new.tracking_number
    or old.shipping_label_url is distinct from new.shipping_label_url
    or old.shipping_carrier is distinct from new.shipping_carrier
    or old.shipping_rate is distinct from new.shipping_rate
    or old.buyer_name is distinct from new.buyer_name
    or old.buyer_address_raw is distinct from new.buyer_address_raw
  then
    raise exception 'Only the collection owner can update marketplace, sale, or fulfillment fields.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_editor_marketplace_fields on albums;
create trigger guard_editor_marketplace_fields
  before update on albums
  for each row
  execute function guard_editor_marketplace_fields();
