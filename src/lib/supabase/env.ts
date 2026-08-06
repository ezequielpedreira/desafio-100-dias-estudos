const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const configuredSupabaseKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

export function isValidSupabaseConfig(url?: string, key?: string) {
  if (!url || !key) return false;

  const isSupportedUrl =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
  const isPublishableKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  const isLegacyAnonKey = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);

  return isSupportedUrl && (isPublishableKey || isLegacyAnonKey);
}

export const hasSupabaseEnv = isValidSupabaseConfig(
  configuredSupabaseUrl,
  configuredSupabaseKey,
);
export const supabaseUrl = hasSupabaseEnv ? configuredSupabaseUrl : undefined;
export const supabaseKey = hasSupabaseEnv ? configuredSupabaseKey : undefined;
