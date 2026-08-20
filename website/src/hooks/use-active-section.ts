import { useEffect, useState } from 'react';

/**
 * Tracks which section heading is currently at the top of the viewport, for the
 * docs sidebar.
 *
 * Uses a rootMargin that ignores everything below the upper third of the screen,
 * so the highlighted entry is the one you are reading rather than whichever
 * heading happens to be visible at the bottom.
 */
export function useActiveSection(ids: string[], offset = 96) {
  const [active, setActive] = useState<string>(ids[0] ?? '');

  useEffect(() => {
    if (ids.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActive(visible[0].target.id);
          return;
        }

        // Nothing in the band - fall back to the last heading scrolled past, so
        // the sidebar never blanks out mid-section.
        const passed = ids
          .map((id) => document.getElementById(id))
          .filter((el): el is HTMLElement => Boolean(el))
          .filter((el) => el.getBoundingClientRect().top < offset);

        const lastPassed = passed[passed.length - 1];
        if (lastPassed) setActive(lastPassed.id);
      },
      { rootMargin: `-${offset}px 0px -66% 0px`, threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ids, offset]);

  return active;
}
