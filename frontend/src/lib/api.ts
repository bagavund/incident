const TOKEN_KEY = 'ims.auth.token';

/**
 * По умолчанию API доступен по тому же origin через `/api` — в проде это
 * проксирует nginx (см. frontend/nginx.conf.template), локально — vite proxy.
 * `VITE_API_BASE_URL` нужен, только если фронт и API реально на разных хостах.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

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
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

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

/**
 * Скачивание бинарного файла (PDF и т.п.) — обычная ссылка не пройдёт JWT
 * в заголовке, поэтому грузим blob сами и сохраняем через временный <a>.
 */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(res.status, `Не удалось скачать файл (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
export const apiPut = <T>(path: string, data?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined });
export const apiDelete = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });
