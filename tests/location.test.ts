import { describe, it, expect } from 'vitest';

import { formatNodeLocation, hasKnownLocation, UNKNOWN_LOCATION } from '../src/lib/location';

/**
 * The server card rendered `{city}, {country}` directly, so a host the agent
 * could not geolocate showed a globe icon followed by a bare comma. The agent
 * returns null for both on purpose - the free ipinfo tier is country-level and
 * returns no city - so this is the normal case, not an edge case.
 */

describe('formatNodeLocation', () => {
  it('joins city and country when both are known', () => {
    expect(formatNodeLocation({ city: 'Mumbai', country: 'India' })).toBe('Mumbai, India');
  });

  it('drops the separator when only the country is known', () => {
    // This is what the country-level ipinfo tier actually returns.
    expect(formatNodeLocation({ city: null, country: 'India' })).toBe('India');
  });

  it('handles a city with no country', () => {
    expect(formatNodeLocation({ city: 'Mumbai', country: null })).toBe('Mumbai');
  });

  it('never renders a lone comma when nothing is known', () => {
    const rendered = formatNodeLocation({ city: null, country: null });
    expect(rendered).toBe(UNKNOWN_LOCATION);
    expect(rendered).not.toContain(',');
  });

  it('treats blank strings as unknown, not as a value to join on', () => {
    // A provider returning "" means the same as returning null; joining on it
    // reintroduces the stray comma.
    expect(formatNodeLocation({ city: '', country: '' })).toBe(UNKNOWN_LOCATION);
    expect(formatNodeLocation({ city: '   ', country: 'India' })).toBe('India');
  });

  it('survives a missing location object entirely', () => {
    expect(formatNodeLocation(null)).toBe(UNKNOWN_LOCATION);
    expect(formatNodeLocation(undefined)).toBe(UNKNOWN_LOCATION);
  });

  it('does not invent a location', () => {
    // Whatever comes back must be either the real value or the explicit
    // unknown marker - never a plausible-looking default.
    for (const input of [
      { city: null, country: null },
      { city: '', country: null },
      null,
    ]) {
      expect(formatNodeLocation(input)).toBe(UNKNOWN_LOCATION);
    }
  });
});

describe('hasKnownLocation', () => {
  it('reports whether the agent determined anything', () => {
    expect(hasKnownLocation({ city: 'Mumbai', country: 'India' })).toBe(true);
    expect(hasKnownLocation({ city: null, country: 'India' })).toBe(true);
    expect(hasKnownLocation({ city: null, country: null })).toBe(false);
    expect(hasKnownLocation(null)).toBe(false);
  });
});
