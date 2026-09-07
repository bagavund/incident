const TOKEN_KEY = 'ims.auth.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим/квота — молча игнорируем */
  }
}

/**
 * Реакция на 401: токен протух или отозван. Вешает AuthProvider, чтобы любой
 * запрос из любого экрана возвращал пользователя на форму входа, а не оставлял
 * его на вечном экране ошибки.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;

  constructor(status: number, message: string, errors: Record<string, string[]> | null = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** Единая точка входа во все запросы к Laravel API — прикладывает токен, парсит ошибки. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // Логин отвечает 422 на неверную пару email/пароль, поэтому 401 здесь —
    // всегда именно непригодный токен.
    if (res.status === 401) onUnauthorized?.();

    const message = body?.message ?? `Ошибка запроса (${res.status})`;
    throw new ApiError(res.status, message, body?.errors ?? null);
  }

  return body as T;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
export const apiPut = <T>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
