import React, { useMemo, useState } from 'react';

/**
 * Landing page for invitation / password-setup links sent through channels that
 * auto-fetch links to build a preview (WhatsApp, Slack, etc).
 *
 * The real Supabase one-time link is embedded in the `link` query param instead of
 * being the page URL itself. A preview-fetch bot only ever requests THIS page's
 * HTML -- it never executes JavaScript, so it can't trigger the button below and
 * can't consume the real one-time link. The real link is only opened when the
 * actual human clicks "Activate Account", which is exactly what keeps it valid.
 */
export const AcceptInviteView: React.FC = () => {
  const [isNavigating, setIsNavigating] = useState(false);

  const realLink = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('link');
    if (!raw) return '';
    try {
      const decoded = decodeURIComponent(raw);
      const parsed = new URL(decoded);
      // Only ever follow an https Supabase Auth link, never an arbitrary redirect.
      if (parsed.protocol !== 'https:') return '';
      return decoded;
    } catch {
      return '';
    }
  }, []);

  const handleActivate = () => {
    if (!realLink) return;
    setIsNavigating(true);
    window.location.href = realLink;
  };

  if (!realLink) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-amber-500/30 bg-slate-900 p-6 text-center shadow-xl">
          <h1 className="text-xl font-bold">Invalid invitation link</h1>
          <p className="text-sm text-slate-400">
            This link is missing or malformed. Ask your administrator to send a new setup link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-white">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-teal-500/30 bg-slate-900 p-6 text-center shadow-xl">
        <div>
          <h1 className="text-xl font-bold">Welcome to Kesraa</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tap below to activate your account and set your password.
          </p>
        </div>
        <button
          type="button"
          onClick={handleActivate}
          disabled={isNavigating}
          className="w-full rounded-xl bg-teal-600 py-3 font-semibold hover:bg-teal-500 disabled:opacity-60"
        >
          {isNavigating ? 'Opening...' : 'Activate Account'}
        </button>
        <p className="text-xs text-slate-500">
          This link works once. Only tap the button when you are ready to set your password.
        </p>
      </div>
    </div>
  );
};
