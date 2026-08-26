import { describe, it, expect } from 'vitest';
import { livePollDelay, isHaltingStatus, MAX_BACKOFF_MS } from '../src/lib/livePoll';

describe('livePollDelay', () => {
  it('polls at the base interval while the agent is healthy', () => {
    expect(livePollDelay(5000, 0)).toBe(5000);
  });

  it('treats a negative failure count as healthy rather than shrinking the interval', () => {
    // A delay below the base would poll the host faster the "better" things got.
    expect(livePollDelay(5000, -1)).toBe(5000);
  });

  it('backs off exponentially while the agent is failing', () => {
    expect(livePollDelay(5000, 1)).toBe(10000);
    expect(livePollDelay(5000, 2)).toBe(20000);
    expect(livePollDelay(5000, 3)).toBe(40000);
  });

  it('never exceeds the ceiling, however long the outage lasts', () => {
    expect(livePollDelay(5000, 4)).toBe(MAX_BACKOFF_MS);
    expect(livePollDelay(5000, 50)).toBe(MAX_BACKOFF_MS);
  });

  it('clamps instead of returning Infinity once 2**failures overflows', () => {
    // setTimeout(fn, Infinity) fires immediately, which would turn the backoff into a tight loop
    // against a host that is already struggling.
    const delay = livePollDelay(5000, 5000);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBe(MAX_BACKOFF_MS);
  });
});

describe('isHaltingStatus', () => {
  it('halts on the statuses that retrying cannot fix', () => {
    // Retrying these re-arms the agent's lockout instead of recovering from it.
    expect(isHaltingStatus(401)).toBe(true);
    expect(isHaltingStatus(403)).toBe(true);
    expect(isHaltingStatus(429)).toBe(true);
  });

  it('keeps retrying transient failures', () => {
    // A restarting agent answers 502/503; giving up would leave the page dead until a manual click.
    expect(isHaltingStatus(0)).toBe(false);
    expect(isHaltingStatus(500)).toBe(false);
    expect(isHaltingStatus(502)).toBe(false);
    expect(isHaltingStatus(503)).toBe(false);
    expect(isHaltingStatus(504)).toBe(false);
  });
});
