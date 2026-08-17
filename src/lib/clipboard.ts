/**
 * Clipboard helper that also works on insecure origins.
 *
 * `navigator.clipboard` is only exposed in secure contexts (HTTPS, or localhost). A VPSGUI instance
 * served over plain HTTP — which is the default until an operator sets up TLS — therefore has no
 * async clipboard API at all, and callers that assumed it existed either threw a TypeError or told
 * the user to "copy manually" without showing them anything to copy.
 *
 * Falls back to the legacy `document.execCommand('copy')` path, which predates the secure-context
 * requirement and still works over HTTP in every current browser.
 */

export type CopyResult = 'copied' | 'failed';

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Keep it out of view and out of the layout, but still focusable — display:none or
  // visibility:hidden make the selection unusable and the copy silently fails.
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  const previousSelection = document.getSelection()?.rangeCount ? document.getSelection()!.getRangeAt(0) : null;

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch (e) {
    return false;
  } finally {
    document.body.removeChild(textarea);
    // Restore whatever the user had selected before we hijacked it.
    if (previousSelection) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(previousSelection);
    }
  }
}

/** Copy text to the clipboard, preferring the async API and falling back for insecure origins. */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch (e) {
      // Permission denied or a transient failure — the legacy path may still succeed.
    }
  }
  return legacyCopy(text) ? 'copied' : 'failed';
}
