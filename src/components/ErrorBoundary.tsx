import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level "safety net" (شبكة الأمان) for the whole app. React does not render
 * anything at all under a component that throws during render — not even its
 * siblings, like the Navbar — unless something in the tree is designated to catch
 * that error. This is exactly what caused the earlier blank-page bug (the
 * RoleGuardedSection outlet-context regression) to look like total silence instead
 * of a visible problem: there was nothing here to catch it.
 *
 * This component is that catcher. React only recognizes a class component with
 * static getDerivedStateFromError/componentDidCatch as an error boundary — there is
 * no hook equivalent, so this has to be a class despite the rest of the app being
 * function components. It renders a plain, readable message with a reload button
 * instead of a blank screen, and logs the real error to the console so it still
 * shows up there for debugging (exactly like the one found manually earlier).
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public declare props: ErrorBoundaryProps;

  public state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-center text-white">
          <h1 className="text-xl font-bold">Something went wrong.</h1>
          <p className="max-w-md text-sm text-slate-400">
            An unexpected error stopped this page from loading. Reloading usually fixes it; if it
            keeps happening, please share what you were doing when it happened.
          </p>
          <pre className="max-w-xl overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-left text-xs text-rose-300">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
