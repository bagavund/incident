import type { TimelineStep } from './types';

export const PERIODS = [
  { value: '7', label: 'Последние 7 дней' },
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
  { value: '180', label: 'Последние 180 дней' },
  { value: '365', label: 'Последний год' },
  { value: 'custom', label: 'Свой период' },
];

/* ------------------------------------------------------------------ */
/* Дата/время: общие форматы                                           */
/* "дисплей" = "30.06.2026 14:20", инпут <input type="datetime-local">  */
/* = "2026-06-30T14:20", время шага = "14:20"                          */
/* ------------------------------------------------------------------ */
export function parseDT(dt: string): Date {
  const [d, t] = dt.split(' ');
  const [dd, mm, yyyy] = d.split('.').map(Number);
  const [hh, min] = (t ?? '00:00').split(':').map(Number);
  return new Date(yyyy, mm - 1, dd, hh, min);
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDT = (x: Date) =>
  `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;

export function toInputDT(display: string): string {
  const [d, t] = display.split(' ');
  const [dd, mm, yyyy] = d.split('.');
  return `${yyyy}-${mm}-${dd}T${t ?? '00:00'}`;
}

export function fromInputDT(value: string): string {
  const [d, t] = value.split('T');
  const [yyyy, mm, dd] = d.split('-');
  return `${dd}.${mm}.${yyyy} ${t ?? '00:00'}`;
}

/** Заменяет время в "дисплей"-дате временем шага (тот же календарный день). */
export function withTime(display: string, time: string): string {
  const [d] = display.split(' ');
  return `${d} ${time}`;
}

export function defaultStartInput(): string {
  return toInputDT(fmtDT(new Date()));
}

/**
 * Порядок шагов и перенос через полночь разрешает сервер (TimelineSync):
 * время шага "HH:MM" он привязывает к дате начала инцидента и хранит
 * готовым timestamp. Клиенту проверять хронологию больше не нужно.
 */

/** Пустая хронология для новой формы: 4 обязательных шага без времени. */
export function emptyTimeline(): TimelineStep[] {
  return [
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Обнаружено' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Диагностика' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Проблема передана ответственным' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Решена' },
  ];
}

/* ------------------------------------------------------------------ */
/* Дашборд: аналитику считает сервер, клиент лишь строит из периода    */
/* диапазон дат для drill-down в список инцидентов.                    */
/* ------------------------------------------------------------------ */
export function periodRange(period: string, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = period === 'custom' && customTo ? new Date(`${customTo}T23:59:59`) : new Date();
  const from =
    period === 'custom' && customFrom
      ? new Date(`${customFrom}T00:00:00`)
      : new Date(to.getTime() - Number(period) * 86400000);
  return { from, to };
}

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
  delta: number;
  up: boolean;
  hint?: string;
}

export const HEATMAP_HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
export const HEATMAP_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
