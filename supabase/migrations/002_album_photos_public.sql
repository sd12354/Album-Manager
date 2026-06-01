-- Make album-photos bucket public so image URLs (used by eBay and the in-app gallery) are accessible.
-- Files remain scoped under {user_id}/{album_id}/ paths. We also raise the per-file size limit
-- to 25MB and restrict to image MIME types eBay accepts.
update storage.buckets
set
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff'
  ]
where id = 'album-photos';

-- Public read policy so anyone (including eBay's image fetcher) can GET an album photo by URL.
-- Writes / deletes still require the owner via the policies from 001_initial.
drop policy if exists "Public can view album photos" on storage.objects;
create policy "Public can view album photos"
on storage.objects for select
to public
using (bucket_id = 'album-photos');
