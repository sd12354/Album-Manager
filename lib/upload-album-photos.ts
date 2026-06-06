import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EBAY_MAX_PHOTOS,
  getOriginalPublicUrl,
  sanitizeFilename,
} from "@/lib/photos";

export interface PhotoUploadInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export async function uploadPhotosToAlbum(
  supabase: SupabaseClient,
  params: {
    userId: string;
    albumId: string;
    existingUrls: string[];
    photos: PhotoUploadInput[];
  }
): Promise<{ urls: string[]; errors: string[] }> {
  const remaining = EBAY_MAX_PHOTOS - params.existingUrls.length;
  if (remaining <= 0) {
    return {
      urls: [],
      errors: [`Album already has ${EBAY_MAX_PHOTOS} photos (eBay limit).`],
    };
  }

  const toUpload = params.photos.slice(0, remaining);
  const uploadedUrls: string[] = [];
  const errors: string[] = [];

  for (const photo of toUpload) {
    const safeName = sanitizeFilename(photo.filename || "cover.jpg");
    const path = `${params.userId}/${params.albumId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("album-photos")
      .upload(path, photo.buffer, {
        contentType: photo.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadError) {
      errors.push(`${photo.filename}: ${uploadError.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from("album-photos")
      .getPublicUrl(path);

    uploadedUrls.push(getOriginalPublicUrl(urlData.publicUrl));
  }

  return { urls: uploadedUrls, errors };
}

export async function appendPhotosToAlbumRecord(
  supabase: SupabaseClient,
  albumId: string,
  existingUrls: string[],
  newUrls: string[]
): Promise<void> {
  if (newUrls.length === 0) return;

  const merged = [...existingUrls, ...newUrls].slice(0, EBAY_MAX_PHOTOS);
  const { error } = await supabase
    .from("albums")
    .update({ photo_urls: merged })
    .eq("id", albumId);

  if (error) throw new Error(error.message);
}
