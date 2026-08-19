import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

import { Button } from '../../components/ui/button';
import { SystemRisk } from '../../lib/systemPaths';

interface SystemFileConfirmProps {
  path: string;
  risk: SystemRisk;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Last gate before writing to a distribution-owned path.
 *
 * Deliberately not `window.confirm`: that gives one line of text with no room to
 * name the actual consequence, and on a `critical` path the consequence is
 * losing access to the host. For those, the confirm button stays disabled until
 * the acknowledgement is ticked — enough friction to stop a reflex click,
 * without blocking work the operator meant to do.
 */
export function SystemFileConfirm({ path, risk, onCancel, onConfirm }: SystemFileConfirmProps) {
  const critical = risk.severity === 'critical';
  const [acknowledged, setAcknowledged] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe action, not the destructive one, so a stray Enter cancels.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const Icon = critical ? ShieldAlert : AlertTriangle;
  const accent = critical ? 'text-rose-400' : 'text-amber-400';
  const ring = critical ? 'border-rose-500/40' : 'border-amber-500/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-file-confirm-title"
      onMouseDown={(e) => {
        // Only a click on the backdrop itself dismisses; dragging out of the
        // dialog should not.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={`w-full max-w-lg rounded-xl border ${ring} bg-card shadow-2xl`}>
        <div className="flex items-start gap-3 border-b border-border/70 p-5">
          <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${accent}`} />
          <div className="min-w-0 flex-1">
            <h2 id="system-file-confirm-title" className="text-sm font-bold text-foreground">
              {critical ? 'This file can take the host offline' : 'You are editing a system file'}
            </h2>
            <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{path}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 font-mono text-[0.6875rem] uppercase ${
                critical ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {risk.label}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{risk.consequence}</p>

          {critical && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 p-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-rose-500"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                I understand this change can make the host unreachable, and I have a way back in
                (console access, a rescue session, or a snapshot).
              </span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/70 p-4">
          <Button ref={cancelRef} size="sm" variant="outline" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={critical && !acknowledged}
            className={`text-xs ${critical ? 'bg-rose-600 hover:bg-rose-600/90' : 'bg-amber-600 hover:bg-amber-600/90'} text-white`}
          >
            Save anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
