import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const SetPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const {
    hasPasswordSetupSession,
    isPasswordSetupFlow,
    passwordSetupError,
    finishPasswordSetup,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session || !hasPasswordSetupSession) {
      setError('This setup link is invalid or has expired. Please request a new link.');
      setIsSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError('Your password was saved, but the temporary session could not be closed. Please close this page and sign in again.');
      setIsSubmitting(false);
      return;
    }

    finishPasswordSetup();
    setIsComplete(true);
    setIsSubmitting(false);
  };

  if (isComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
        <div className="w-full max-w-md space-y-5 rounded-3xl border border-emerald-500/30 bg-slate-900 p-6 text-center shadow-xl">
          <h1 className="text-xl font-bold">Password saved successfully</h1>
          <p className="text-sm text-slate-300">You can now sign in with your email and new password.</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="w-full rounded-xl bg-teal-600 py-3 font-semibold hover:bg-teal-500"
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-3xl border border-teal-500/30 bg-slate-900 p-6 shadow-xl"
      >
        <div>
          <h1 className="text-xl font-bold">Create Your Password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Choose a private password for your Kesraa account.
          </p>
        </div>
        {(!isPasswordSetupFlow || !hasPasswordSetupSession) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {passwordSetupError ||
              'This setup link is invalid or has expired. Request a new invitation or password-reset link.'}
          </div>
        )}
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-teal-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-teal-500"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting || !isPasswordSetupFlow || !hasPasswordSetupSession}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold disabled:opacity-60"
        >
          {isSubmitting ? 'Saving...' : 'Save Password'}
        </button>
        <button
          type="button"
          onClick={() => {
            finishPasswordSetup();
            navigate('/login', { replace: true });
          }}
          disabled={isSubmitting}
          className="w-full text-sm font-semibold text-slate-400 hover:text-white disabled:opacity-50"
        >
          Back to Sign In
        </button>
      </form>
    </div>
  );
};
