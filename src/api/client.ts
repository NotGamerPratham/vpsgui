/**
 * REST API Client
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * Thin fetch wrapper around the vpsgui-agent REST API. Every request carries the agent token
 * (configured under Settings) and is bounded by a timeout so a hung agent cannot wedge the UI.
 */

const DEFAULT_TIMEOUT_MS = 15000;
export const AGENT_TOKEN_STORAGE_KEY = 'vpsgui_auth_token';

/** Error carrying the HTTP status and the agent's own message, so callers can react to 401 vs 500. */
export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  /**
   * The parsed error body, when the agent sent one.
   *
   * Several endpoints return context alongside `error` - a confinement failure
   * reports the configured `roots`, for instance - and that context is what
   * lets the UI explain how to fix the problem rather than just restating it.
   */
  readonly details: Record<string, unknown> | null;

  constructor(message: string, status: number, endpoint: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.details =
      details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
  }

  /** The agent token is missing, wrong, or temporarily locked out after repeated failures. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 429;
  }
}

const getBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  // Deployed on a VPS behind the bundled nginx config, the agent is proxied under the same origin.
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:46509/api/v1';
};

function readToken(): string | null {
  try {
    return localStorage.getItem(AGENT_TOKEN_STORAGE_KEY);
  } catch (e) {
    // Storage can throw in private-browsing or sandboxed contexts.
    return null;
  }
}

class ApiClient {
  private baseUrl = getBaseUrl();

  private getHeaders(hasBody: boolean): HeadersInit {
    const token = readToken();
    return {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: this.getHeaders(body !== undefined),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // Never let a stale service-worker or browser cache stand in for live host state.
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`Request timed out after ${timeoutMs}ms`, 0, endpoint);
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network request failed',
        0,
        endpoint
      );
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    let parsed: unknown = undefined;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        // Non-JSON body (e.g. an nginx error page); fall through to the status-based message.
      }
    }

    if (!response.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError(detail, response.status, endpoint, parsed);
    }

    return parsed as T;
  }

  get<T>(endpoint: string, timeoutMs?: number): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, timeoutMs);
  }

  post<T>(endpoint: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>('POST', endpoint, body, timeoutMs);
  }

  put<T>(endpoint: string, body: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>('PUT', endpoint, body, timeoutMs);
  }

  delete<T>(endpoint: string, timeoutMs?: number): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, timeoutMs);
  }

  /**
   * Send a file's raw bytes as the request body.
   *
   * `request()` cannot carry this: it JSON-stringifies whatever it is given, which would corrupt
   * anything that is not UTF-8 text, and base64 would inflate the payload by a third before it hit
   * the agent's JSON body cap. The bytes go up untouched instead.
   *
   * The timeout is generous and separate from the default, because a large file over a slow uplink
   * is not a hung request.
   */
  async upload<T>(endpoint: string, file: Blob, timeoutMs = 10 * 60 * 1000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const token = readToken();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`Upload timed out after ${timeoutMs}ms`, 0, endpoint);
      }
      throw new ApiError(error instanceof Error ? error.message : 'Upload failed', 0, endpoint);
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : undefined;
    } catch (e) {
      // Non-JSON body (an nginx 413 page, say); the status still carries the meaning.
    }

    if (!response.ok) {
      const detail =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError(detail, response.status, endpoint, parsed);
    }
    return parsed as T;
  }

  /**
   * Fetch a binary response as a Blob.
   *
   * A plain `<a href>` cannot be used for this: the agent requires the bearer token on every
   * request and a link carries no headers, so the download would 401. Fetching here keeps the
   * token attached and hands back bytes the caller can save.
   */
  async download(endpoint: string, timeoutMs = 10 * 60 * 1000): Promise<Blob> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const token = readToken();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`Download timed out after ${timeoutMs}ms`, 0, endpoint);
      }
      throw new ApiError(error instanceof Error ? error.message : 'Download failed', 0, endpoint);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // The failure path is JSON even though the success path is not, so read it as text and try.
      const raw = await response.text().catch(() => '');
      let detail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          detail = String((parsed as { error: unknown }).error);
        }
      } catch (e) {
        // Keep the status-based message.
      }
      throw new ApiError(detail, response.status, endpoint);
    }

    return response.blob();
  }

  /** True when an agent token has been saved; used to explain 401s to the user. */
  hasToken(): boolean {
    return Boolean(readToken());
  }
}

export const apiClient = new ApiClient();
