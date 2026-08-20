/**
 * Formatting for a node's geolocation.
 *
 * The agent reports `city` and `country` as null whenever it genuinely cannot
 * determine them - no ipinfo token configured, or the free country-level tier,
 * which returns no city at all. Rendering `{city}, {country}` directly then
 * produced a lone comma next to a globe icon, which reads as a broken UI rather
 * than as missing information.
 */

export interface NodeLocationLike {
  city: string | null;
  country: string | null;
}

/** What to show when nothing is known. Never a guess, and never an empty string. */
export const UNKNOWN_LOCATION = 'Unknown';

/**
 * A human-readable location, degrading a piece at a time.
 *
 * "Mumbai, India" when both are known, "India" when only the country is, and
 * `UNKNOWN_LOCATION` when neither is. Blank strings are treated as unknown too:
 * a provider returning `""` means the same thing as returning null, and joining
 * on it would reintroduce the stray comma.
 */
export function formatNodeLocation(location: NodeLocationLike | null | undefined): string {
  if (!location) return UNKNOWN_LOCATION;

  const parts = [location.city, location.country]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : UNKNOWN_LOCATION;
}

/** Whether the agent could determine anything at all, for styling the fallback. */
export function hasKnownLocation(location: NodeLocationLike | null | undefined): boolean {
  return formatNodeLocation(location) !== UNKNOWN_LOCATION;
}
