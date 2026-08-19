import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Clipboard write with a visible confirmation. navigator.clipboard is undefined
 * on plain-HTTP origins, so the execCommand path is a real fallback rather than
 * legacy cruft — a reader on http://192.168.x.x would otherwise get a button
 * that silently does nothing.
 */
export function useCopy(resetAfterMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      const arm = (ok: boolean) => {
        setCopied(ok);
        setFailed(!ok);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          setCopied(false);
          setFailed(false);
        }, resetAfterMs);
      };

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          arm(true);
          return true;
        }
      } catch {
        // Permission denied or a non-secure context; try the fallback.
      }

      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        arm(ok);
        return ok;
      } catch {
        arm(false);
        return false;
      }
    },
    [resetAfterMs],
  );

  return { copy, copied, failed };
}
