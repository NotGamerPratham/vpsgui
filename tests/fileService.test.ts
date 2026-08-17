/**
 * FileService tests.
 *
 * Covers the contract that prevents the editor's data-loss bug: a file that could not be loaded in
 * full must come back flagged as truncated and non-editable, so the UI refuses to write a partial
 * copy back over the original.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fileService } from '../src/services/fileService';
import { fetchReturning, fetchFailing, bodyOf } from './helpers/fetchMock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fileService.fetchFiles', () => {
  it('separates a genuinely empty directory from a failure', async () => {
    vi.stubGlobal('fetch', fetchReturning([]));

    const ok = await fileService.fetchFiles('/etc');
    expect(ok.items).toEqual([]);
    expect(ok.error).toBeNull();

    vi.stubGlobal('fetch', fetchReturning({ error: 'Path is outside the configured agent file roots' }, { status: 403 }));

    const denied = await fileService.fetchFiles('/root');
    expect(denied.items).toEqual([]);
    expect(denied.error).toMatch(/outside the configured/i);
  });

  it('url-encodes the path so spaces and "#" survive the round trip', async () => {
    const fetchMock = fetchReturning([]);
    vi.stubGlobal('fetch', fetchMock);

    await fileService.fetchFiles('/var/www/my site#1');
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('/var/www/my site#1'));
  });

  it('explains a 401 as a missing agent token', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'Unauthorized' }, { status: 401 }));

    const result = await fileService.fetchFiles('/etc');
    expect(result.error).toMatch(/agent token/i);
  });
});

describe('fileService.readFile', () => {
  it('returns full content and marks it editable', async () => {
    vi.stubGlobal(
      'fetch',
      fetchReturning({ path: '/etc/hosts', content: '127.0.0.1 localhost', truncated: false, sizeBytes: 19, editable: true })
    );

    const result = await fileService.readFile('/etc/hosts');
    expect(result.content).toBe('127.0.0.1 localhost');
    expect(result.truncated).toBe(false);
    expect(result.editable).toBe(true);
  });

  it('marks an oversized file truncated and NOT editable', async () => {
    // The editor keys "can I save?" off this flag. Saving a truncated read is precisely how the
    // previous build destroyed the tail of every file larger than 5000 characters.
    vi.stubGlobal(
      'fetch',
      fetchReturning({ path: '/var/log/big', content: 'xx', truncated: true, sizeBytes: 999999, editable: false })
    );

    const result = await fileService.readFile('/var/log/big');
    expect(result.truncated).toBe(true);
    expect(result.editable).toBe(false);
  });

  it('propagates a read failure instead of returning empty content', async () => {
    // Returning '' here would look to the editor like a legitimately empty file, and saving it
    // would blank the real one.
    vi.stubGlobal('fetch', fetchFailing());
    await expect(fileService.readFile('/etc/hosts')).rejects.toThrow();
  });
});

describe('fileService.writeFile', () => {
  it('reports a failed write rather than reporting success', async () => {
    vi.stubGlobal('fetch', fetchReturning({ error: 'read-only file system' }, { status: 500 }));

    const result = await fileService.writeFile('/etc/hosts', 'data');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('sends the path and content unmodified', async () => {
    const fetchMock = fetchReturning({ success: true });
    vi.stubGlobal('fetch', fetchMock);

    const content = 'line one\nline two\n';
    await fileService.writeFile('/etc/motd', content);

    expect(bodyOf(fetchMock)).toEqual({ path: '/etc/motd', content });
  });
});
