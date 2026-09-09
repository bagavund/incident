/**
 * Пропускает только http/https-ссылки. Всё остальное (`javascript:`, `data:`,
 * относительные, мусор) → null, чтобы такой URL не попал в href.
 * Бэкенд уже валидирует `task_link` как url:http,https — это defense-in-depth
 * на случай старых записей и любых других внешних ссылок.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, window.location.origin);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
