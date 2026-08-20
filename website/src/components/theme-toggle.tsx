import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

/**
 * Which icon shows is decided by CSS, not by React state.
 *
 * The page is prerendered, so the server has no idea which theme the visitor
 * stored. Rendering the icon and label from state meant the server emitted
 * "Switch to light theme" while a light-mode visitor's client emitted the
 * opposite - a hydration mismatch that threw the whole root away. The inline
 * script in index.html has already put `.dark` on <html> before first paint, so
 * a `dark:` variant picks the right glyph with no JavaScript and no disagreement.
 */
export function ThemeToggle() {
  const { toggle } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
    >
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <Moon aria-hidden className="size-4 dark:hidden" />
    </Button>
  );
}
