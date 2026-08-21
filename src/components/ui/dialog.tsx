import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    // Scrolls as a whole on the outside, rather than centering unconditionally: with `items-center`
    // alone, a panel taller than a short viewport (a landscape phone, or a browser with visible
    // chrome) got centered on content that doesn't exist and clipped equally top and bottom, with
    // no way to reach whatever fell off either edge. min-h-full lets flex still center panels that
    // fit while a panel that doesn't fit simply starts at the top of a scrollable page instead.
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className="relative z-50 flex min-h-full items-center justify-center p-4">
        {/* No max-width here. It used to carry `max-w-lg`, which silently capped every consumer:
            a DialogContent asking for max-w-xl or max-w-2xl still rendered at 512px, because a
            child cannot exceed its parent's content box. The default now lives on DialogContent,
            where twMerge lets a caller's own max-w-* replace it instead of being clamped by it. */}
        <div className="w-full animate-in fade-in zoom-in-95 duration-200">{children}</div>
      </div>
    </div>
  );
}

export function DialogContent({ className, children, onClose }: { className?: string; children: React.ReactNode; onClose?: () => void }) {
  return (
    // Capped independently of the outer page-level scroll added above: a panel that is merely
    // taller than a short viewport scrolls as a whole, but one whose own content keeps growing
    // (e.g. a form with a validation error appended below the fold) still gets its own scrollbar
    // rather than growing past the screen with the header long since out of view.
    <div
      className={cn(
        'relative mx-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl',
        className
      )}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
        >
          <X className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}>{children}</div>;
}

export function DialogTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}>{children}</h2>;
}

export function DialogDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn('text-sm text-muted-foreground mt-1', className)}>{children}</p>;
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex justify-end space-x-2 mt-6', className)}>{children}</div>;
}
