import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence against a render crash.
 *
 * Without this, a single component throwing during render unmounts the entire
 * tree and leaves a blank white page - no message, no navigation, nothing to act
 * on. For a console whose whole job is telling an operator what is happening on
 * their host, silently going blank is the worst possible failure: it looks
 * identical to the server being down.
 *
 * The agent is the likeliest trigger. It returns real host data, so an
 * unexpected shape - a field that is null on one distro, an empty array where an
 * object was expected - reaches render as a TypeError. That should cost one
 * page, not the session.
 *
 * Deliberately a class: `componentDidCatch` has no hook equivalent.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep the component stack in the console: the message alone rarely
    // identifies which page threw.
    console.error('[VPSGUI] Render error:', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg rounded-xl border border-rose-500/40 bg-card p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-foreground">This page failed to render</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The rest of the console is unaffected. This is a bug in VPSGUI, not a problem with
                your server - the host itself is untouched by a rendering failure.
              </p>
            </div>
          </div>

          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-rose-300">
            {error.message || String(error)}
          </pre>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/dashboard')}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
