import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, Lock, LockOpen, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const LoginView: React.FC = () => {
  const { login, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetRequestComplete, setResetRequestComplete] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    try {
      setError('');
      clearAuthError();
      setIsSubmitting(true);
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    clearAuthError();
    setIsSubmitting(true);
    try {
      const redirectTo = new URL('/auth/setup-password', window.location.origin).toString();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      );
      if (resetError) {
        throw new Error('The password-reset request could not be completed right now. Please try again later.');
      }
      setResetRequestComplete(true);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'The password-reset request could not be completed right now. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const showLoginForm = () => {
    setIsResetMode(false);
    setResetRequestComplete(false);
    setError('');
    clearAuthError();
  };

  return (
    <div 
      className="min-h-screen min-h-[100svh] w-full overflow-x-hidden overflow-y-auto bg-neutral-950 px-4 pb-8 pt-[clamp(3.5rem,9vh,7rem)] sm:px-6"
      style={{ 
        backgroundImage: 'linear-gradient(rgba(10, 13, 17, 0.85), rgba(10, 13, 17, 0.85)), url(/back.png)', 
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center">
        {/* Brand Header */}
        <div className="mb-[clamp(2.5rem,7vh,5.5rem)] w-full text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex flex-col items-center justify-center gap-3 min-[420px]:flex-row min-[420px]:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-2xl font-black text-[#241a05] shadow-lg shadow-amber-400/20 sm:h-14 sm:w-14 sm:text-3xl">
              K
            </div>
            <h1 className="max-w-full text-[clamp(1.65rem,6vw,2.5rem)] font-display font-black leading-tight text-white tracking-[0.03em] min-[420px]:whitespace-nowrap">
              Kesraa KPIs System
            </h1>
          </div>
        </div>

        <div
          className="relative w-full max-w-lg rounded-3xl border border-teal-500/30 p-5 shadow-[0_0_30px_rgba(20,184,166,0.1)] sm:p-8"
          style={{ background: 'rgba(15, 23, 42, 0.96)' }}
        >
          <div className="mb-6 text-center sm:mb-8">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10 shadow-[0_0_15px_rgba(20,184,166,0.15)] sm:h-16 sm:w-16">
              <ShieldCheck className="h-7 w-7 text-teal-400 sm:h-8 sm:w-8" />
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              {isResetMode ? 'Reset Password' : 'Sign In'}
            </h2>
          </div>

          <form onSubmit={isResetMode ? handleForgotPassword : handleLogin} className="space-y-5 sm:space-y-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-left text-sm font-bold text-white">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                      clearAuthError();
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white transition-all focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                    dir="ltr"
                    placeholder="name@kesraa.com"
                  />
                </div>
              </div>

              {!isResetMode && (
                <div>
                  <label className="mb-2 block text-left text-sm font-bold text-white">
                    Password
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <LockOpen className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </button>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                        clearAuthError();
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white transition-all focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}
            </div>

            {isResetMode && resetRequestComplete && (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs leading-5 text-emerald-200">
                If an account exists for this email, password-reset instructions can now be used to continue.
              </p>
            )}

            {(error || authError) && (
              <p className="mt-2 text-center text-xs text-rose-400">{error || authError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (isResetMode && resetRequestComplete)}
              className="mt-2 w-full rounded-xl bg-teal-600 py-3 font-semibold text-white shadow-lg shadow-teal-500/25 transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? isResetMode ? 'Sending...' : 'Signing In...'
                : isResetMode ? 'Send Reset Link' : 'Sign In'}
            </button>

            {isResetMode ? (
              <button
                type="button"
                onClick={showLoginForm}
                disabled={isSubmitting}
                className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-teal-300 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(true);
                  setResetRequestComplete(false);
                  setError('');
                  clearAuthError();
                }}
                disabled={isSubmitting}
                className="block w-full text-center text-sm font-semibold text-teal-300 hover:text-teal-200 disabled:opacity-50"
              >
                Forgot Password?
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
