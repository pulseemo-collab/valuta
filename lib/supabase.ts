import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ── Config status ─────────────────────────────────────────────────────────────
// Exported so auth screens can detect and surface a specific "config missing"
// message instead of a generic "Network request failed" error.
export const supabaseConfigMissing = !supabaseUrl || !supabaseAnonKey;

// ── Env var validation ────────────────────────────────────────────────────────

if (!supabaseUrl) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_URL is missing. Check your .env / EAS secrets.');
} else if (!supabaseUrl.startsWith('https://')) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_URL looks malformed:', supabaseUrl);
} else {
  // Log partial URL on native so devs can confirm the var was baked into the bundle
  // without exposing the full project ID in production logs.
  const projectHint = supabaseUrl.replace('https://', '').split('.')[0].slice(0, 8) + '…';
  console.log(`[Supabase] URL present — project hint: ${projectHint} (platform: ${Platform.OS})`);
}

if (!supabaseAnonKey) {
  console.error('[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Check your .env / EAS secrets.');
} else if (Platform.OS === 'web') {
  // atob() is a browser API — skip JWT validation on native to avoid any runtime issues
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
} else {
  // On native: confirm key is present without logging any part of it
  console.log(`[Supabase] Anon key present — length: ${supabaseAnonKey.length} chars`);
}

// ── Auth storage adapter ──────────────────────────────────────────────────────

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

// ── Safe client creation ──────────────────────────────────────────────────────

// createClient throws if supabaseUrl or supabaseAnonKey are empty strings.
// On Android, a module-level throw kills the entire JS bundle → immediate crash.
// We substitute offline placeholder values so the client is always constructable;
// API calls will fail gracefully and store.tsx handles those errors.
function createSafeClient() {
  const url = supabaseUrl || 'https://offline-placeholder.supabase.co';
  const key = supabaseAnonKey || 'offline-placeholder-key';
  try {
    return createClient<Database>(url, key, {
      auth: {
        storage: getAuthStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.error('[Supabase] createClient failed — falling back to offline mode:', err);
    // Last resort: bare client with no storage (auth calls will fail gracefully)
    return createClient<Database>(url, key, {
      auth: { storage: undefined, autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
}

export const supabase = createSafeClient();
