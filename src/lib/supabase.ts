import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface PasswordSetupCallbackState {
  isDetected: boolean;
  type: string | null;
  error: string;
}

const readPasswordSetupCallback = (): PasswordSetupCallbackState => {
  if (typeof window === 'undefined') {
    return { isDetected: false, type: null, error: '' };
  }

  // Capture the callback before createClient() can exchange/consume it and clean the URL.
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const getParam = (name: string) => hashParams.get(name) || searchParams.get(name);
  const type = getParam('type');
  const hasImplicitSession = hashParams.has('access_token') && hashParams.has('refresh_token');
  const hasAuthError = Boolean(
    getParam('error') || getParam('error_code') || getParam('error_description')
  );
  const isSetupType = type === 'invite' || type === 'recovery';
  const isSetupPath = window.location.pathname === '/auth/setup-password';
  const errorDescription = getParam('error_description');

  return {
    // Supabase invitation links can return to the configured Site URL root with
    // an implicit session fragment, so the pathname alone is not authoritative.
    isDetected: isSetupType || isSetupPath || hasImplicitSession || hasAuthError,
    type,
    error: hasAuthError
      ? errorDescription || 'This authentication link is invalid or has expired.'
      : '',
  };
};

export const initialPasswordSetupCallback = readPasswordSetupCallback();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
