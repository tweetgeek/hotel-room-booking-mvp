export interface ValidationDetail {
  field: string;
  code: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ValidationDetail[] = [],
    readonly attemptsLeft?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3100').replace(/\/$/, '');

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  accessToken?: string | null;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers['X-Reservation-Access'] = options.accessToken;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network request failed');
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  let payload: Partial<{ code: string; message: string; details: ValidationDetail[]; attemptsLeft: number }> =
    {};
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error body: keep the generic code below
  }
  const retryAfter = response.headers.get('Retry-After');
  throw new ApiError(
    response.status,
    payload.code ?? 'UNKNOWN_ERROR',
    payload.message ?? response.statusText,
    payload.details ?? [],
    payload.attemptsLeft,
    retryAfter ? Number(retryAfter) : undefined,
  );
}
