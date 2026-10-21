-- Keep shared-collection editors from mutating owner-only marketplace and
-- fulfillment state through direct browser Supabase updates. API routes
-- already enforce owner-only marketplace operations; this trigger closes the
-- matching RLS gap while preserving editor access for normal catalogue edits,
-- imports, pricing, and photo management.
create or replace function public.prevent_editor_marketplace_field_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  caller_id uuid := auth.uid();
begin
  -- Service-role maintenance and the collection owner can manage all fields.
  if request_role = 'service_role' then
    return new;
  end if;

  if caller_id is not null and caller_id = new.user_id then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('listed', 'sold')
      or new.ebay_listing_id is not null
      or new.ebay_listing_url is not null
      or new.discogs_listing_id is not null
      or new.discogs_listing_url is not null
      or new.sold_price is not null
      or new.sold_at is not null
      or new.buyer_name is not null
      or new.buyer_address_raw is not null
      or new.tracking_number is not null
      or new.shipping_label_url is not null
      or new.shipping_carrier is not null
      or new.shipping_rate is not null then
      raise exception 'only the collection owner can set marketplace or fulfillment fields'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if (new.status is distinct from old.status and (new.status in ('listed', 'sold') or old.status in ('listed', 'sold')))
    or new.ebay_listing_id is distinct from old.ebay_listing_id
    or new.ebay_listing_url is distinct from old.ebay_listing_url
    or new.discogs_listing_id is distinct from old.discogs_listing_id
    or new.discogs_listing_url is distinct from old.discogs_listing_url
    or new.sold_price is distinct from old.sold_price
    or new.sold_at is distinct from old.sold_at
    or new.buyer_name is distinct from old.buyer_name
    or new.buyer_address_raw is distinct from old.buyer_address_raw
    or new.tracking_number is distinct from old.tracking_number
    or new.shipping_label_url is distinct from old.shipping_label_url
    or new.shipping_carrier is distinct from old.shipping_carrier
    or new.shipping_rate is distinct from old.shipping_rate then
    raise exception 'only the collection owner can change marketplace or fulfillment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_editor_marketplace_field_change on public.albums;

create trigger prevent_editor_marketplace_field_change
before insert or update on public.albums
for each row
execute function public.prevent_editor_marketplace_field_change();

revoke all on function public.prevent_editor_marketplace_field_change() from public;
