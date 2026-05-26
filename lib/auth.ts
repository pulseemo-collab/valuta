import { supabase } from '@/lib/supabase';

export async function signIn(email: string, password: string) {
  if (__DEV__) console.log('[Auth] signIn attempt:', email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[Auth] signIn error:', JSON.stringify({ message: error.message, code: (error as any).code, status: (error as any).status }));
    throw error;
  }
  if (__DEV__) console.log('[Auth] signIn success, user:', data.user?.id);
  return data;
}

export async function signUp(email: string, password: string, displayName?: string) {
  if (__DEV__) console.log('[Auth] signUp attempt:', email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: displayName ? { data: { display_name: displayName } } : undefined,
  });
  if (error) {
    console.error('[Auth] signUp error:', JSON.stringify({ message: error.message, code: (error as any).code, status: (error as any).status }));
    throw error;
  }
  if (__DEV__) console.log('[Auth] signUp success, user:', data.user?.id, 'session:', !!data.session);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function toAlbanianError(message: string, code?: string): string {
  // Match by Supabase error code first — more reliable than message text
  switch (code) {
    case 'user_not_found':
      return 'Kjo llogari nuk ekziston. Regjistrohu fillimisht.';
    case 'invalid_credentials':
      return 'Email ose fjalëkalimi janë të gabuar.';
    case 'email_not_confirmed':
      return 'Kontrollo email-in për të konfirmuar llogarinë.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Ky email është tashmë i regjistruar.';
    case 'weak_password':
      return 'Fjalëkalimi duhet të jetë më i fortë (minimum 6 karaktere).';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Shumë tentativa. Provo përsëri pas pak minutash.';
    case 'signup_disabled':
      return 'Regjistrimi është çaktivizuar momentalisht.';
    case 'validation_failed':
      return 'Të dhënat janë të pavlefshme. Kontrollo fushat.';
    case 'bad_jwt':
    case 'invalid_jwt':
    case 'not_admin':
      return 'Gabim konfigurimi i serverit (JWT). Kontakto administratorin.';
  }

  // Fallback: match by message text (covers older GoTrue versions)
  if (message.includes('Invalid login credentials')) return 'Email ose fjalëkalimi janë të gabuar.';
  if (message.includes('Email not confirmed')) return 'Kontrollo email-in për të konfirmuar llogarinë.';
  if (message.includes('User already registered')) return 'Ky email është tashmë i regjistruar.';
  if (message.includes('Password should be at least')) return 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.';
  if (message.includes('Unable to validate email') || message.includes('invalid email')) return 'Formati i emailit është i pavlefshëm.';
  if (message.includes('Signups not allowed')) return 'Regjistrimi është çaktivizuar momentalisht.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Shumë tentativa. Provo përsëri pas pak minutash.';
  if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch')) return 'Nuk ka lidhje interneti. Provo përsëri.';
  if (
    message.includes('Invalid JWT') ||
    message.includes('invalid_jwt') ||
    message.includes('JWT') ||
    message.includes('API key') ||
    message.includes('apikey') ||
    message.includes('Unauthorized')
  ) {
    return 'Gabim konfigurimi i serverit (JWT/API key). Kontrollo variablat EXPO_PUBLIC_SUPABASE_*.';
  }

  // Log unmatched errors so they can be identified and mapped
  console.warn('[Auth] toAlbanianError: no match for', JSON.stringify({ message, code }));
  return `Gabim: ${message || 'I panjohur'}`;
}
