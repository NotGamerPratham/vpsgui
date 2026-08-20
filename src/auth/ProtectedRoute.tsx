import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Gate for the authenticated routes.
 *
 * The session is verified by the agent, not here. This asks once on mount and
 * then trusts the cached answer for rendering - the agent still re-checks every
 * API call, so the worst a tampered client state can do is render an empty
 * shell that loads no data.
 *
 * The `checking` state matters: without it the first paint would redirect to
 * /login before /auth/me had answered, bouncing signed-in users out on every
 * refresh.
 */
export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { isAuthenticated, checking, refreshSession } = useAuthStore();

  useEffect(() => {
    if (checking) void refreshSession();
  }, [checking, refreshSession]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking session…
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children || <Outlet />}</>;
}
