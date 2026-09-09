import { useEffect, useState } from 'react';

/** Лёгкий роутер на History API — без внешней зависимости, т.к. экранов немного. */

function getPath() {
  return window.location.pathname;
}

const listeners = new Set<() => void>();

/** Пока установлен и возвращает false — программная навигация блокируется (несохранённые изменения в форме). */
let guard: (() => boolean) | null = null;

export function setNavigationGuard(fn: (() => boolean) | null) {
  guard = fn;
}

export function navigate(to: string) {
  if (getPath() === to) return;
  if (guard && !guard()) return;
  window.history.pushState({}, '', to);
  listeners.forEach((l) => l());
}

export function usePath() {
  const [path, setPath] = useState(getPath);
  useEffect(() => {
    const onChange = () => setPath(getPath());
    window.addEventListener('popstate', onChange);
    listeners.add(onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      listeners.delete(onChange);
    };
  }, []);
  return path;
}
