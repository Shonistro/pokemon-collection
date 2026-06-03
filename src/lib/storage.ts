import { supabase } from './supabase';

const BUCKET = 'card-images';

/**
 * Upload a custom card photo to Supabase Storage and return its public URL.
 * Files are namespaced by user id. The image URL is stored on the card row;
 * the file itself lives in Storage (not the DB), per spec.
 */
export async function uploadCardImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
