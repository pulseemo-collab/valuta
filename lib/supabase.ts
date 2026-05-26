import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Validate env vars at startup so misconfiguration is obvious immediately
if (!supabaseUrl) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_URL is missing. Check your .env file.');
} else if (!supabaseUrl.startsWith('https://')) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_URL looks malformed:', supabaseUrl);
}

if (!supabaseAnonKey) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Check your .env file.');
} else {
  // Decode JWT payload to verify the ref matches the URL project ID
  try {
    const payload = supabaseAnonKey.split('.')[1];
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { ref?: string };
    const urlProjectId = supabaseUrl.replace('https://', '').split('.')[0];
    if (decoded.ref && decoded.ref !== urlProjectId) {
      console.error(
        `[Supabase] MISMATCH: anon key is for project "${decoded.ref}" but URL points to "${urlProjectId}". ` +
        'Get the correct anon key from your Supabase dashboard → Settings → API.'
      );
    } else {
      console.log(`[Supabase] Config OK — project: ${decoded.ref ?? urlProjectId}`);
    }
  } catch {
    console.warn('[Supabase] Could not decode anon key JWT to verify project ID.');
  }
}

// Returns the appropriate auth storage adapter:
// - Native: AsyncStorage (loaded via require to avoid SSR module evaluation)
// - Web client: localStorage
// - Web SSR (window undefined): undefined — no session storage during static render
function getAuthStorage() {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage').default;
  }
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
