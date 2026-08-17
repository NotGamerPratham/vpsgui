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

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
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
      throw new ApiError(detail, response.status, endpoint);
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

  /** True when an agent token has been saved; used to explain 401s to the user. */
  hasToken(): boolean {
    return Boolean(readToken());
  }
}

export const apiClient = new ApiClient();
