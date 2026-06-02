alter table albums
  add column if not exists tracking_number text,
  add column if not exists shipping_label_url text,
  add column if not exists shipping_carrier text,
  add column if not exists shipping_rate numeric(10,2),
  add column if not exists buyer_name text,
  add column if not exists buyer_address_raw text;
