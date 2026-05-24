export function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return Boolean(
    url &&
      key &&
      !url.includes('placeholder') &&
      !key.includes('placeholder') &&
      !url.includes('your-project') &&
      !key.includes('your-service-role'),
  );
}
