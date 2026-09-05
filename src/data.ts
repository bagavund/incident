import type {
  EscalationAttempt,
  FullIncident,
  Metric,
  Metrics,
  SlaState,
  TimelineStep,
} from './types';

export const PERIODS = [
  { value: '7', label: 'Последние 7 дней' },
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
  { value: '180', label: 'Последние 180 дней' },
  { value: '365', label: 'Последний год' },
  { value: 'custom', label: 'Свой период' },
];

/**
 * SLA-пороги (минуты от начала до решения) по критичности. Критичность — это
 * редактируемый в админке справочник свободных строк, поэтому таблица — best-effort:
 * для значения, которого в ней нет, берётся DEFAULT_SLA_THRESHOLD_MINUTES.
 */
export const SLA_THRESHOLD_MINUTES: Record<string, number> = {
  Критичный: 60,
  Важный: 240,
  Второстепенный: 1440,
};
const DEFAULT_SLA_THRESHOLD_MINUTES = 240;

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
export const fmtT = (x: Date) => `${pad(x.getHours())}:${pad(x.getMinutes())}`;

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

export const humanMins = (m: number) =>
  m < 60 ? `${m}м` : m % 60 ? `${Math.floor(m / 60)}ч ${m % 60}м` : `${Math.floor(m / 60)}ч`;
const diffMin = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

function metric(minutes: number | null): Metric {
  return { minutes, human: minutes === null ? null : humanMins(minutes) };
}

/** Считает метрики по текущему состоянию инцидента (пересчитывается на лету). */
export function computeMetrics(inc: FullIncident): Metrics {
  const started = parseDT(inc.startedAt);
  const detected = parseDT(inc.detectedAt);
  const resolved = inc.resolvedAt ? parseDT(inc.resolvedAt) : null;

  const diagTime = inc.timeline.find((s) => s.kind === 'Диагностика')?.time;
  const handoffTime = inc.timeline.find((s) => s.kind === 'Проблема передана ответственным')?.time;
  const diag = diagTime ? parseDT(withTime(inc.startedAt, diagTime)) : null;
  const handoff = handoffTime ? parseDT(withTime(inc.startedAt, handoffTime)) : null;

  return {
    toDetect: metric(diffMin(started, detected)),
    toEscalate: handoff ? metric(diffMin(detected, handoff)) : metric(null),
    toDiagnose: diag && handoff ? metric(diffMin(diag, handoff)) : metric(null),
    toResolve: resolved ? metric(diffMin(started, resolved)) : metric(null),
  };
}

/**
 * SLA считается от факта: время от начала инцидента до решения сравнивается с
 * порогом по критичности. Пока инцидент не решён, вердикт выносить рано —
 * возвращаем «Соблюден» (он ещё не нарушен), а не гадаем.
 */
export function computeSla(criticality: string, startedAt: string, resolvedAt: string | null): SlaState {
  if (!resolvedAt) return 'Соблюден';
  const threshold = SLA_THRESHOLD_MINUTES[criticality] ?? DEFAULT_SLA_THRESHOLD_MINUTES;
  const minutes = diffMin(parseDT(startedAt), parseDT(resolvedAt));
  return minutes <= threshold ? 'Соблюден' : 'Нарушен';
}

/** Длительность показа заглушки (если она была установлена и снята). */
export function stubDuration(inc: FullIncident): Metric {
  if (!inc.stub || !inc.stub.on || !inc.stub.off || inc.stub.off === '—') return metric(null);
  const on = parseDT(withTime(inc.startedAt, inc.stub.on));
  const off = parseDT(withTime(inc.startedAt, inc.stub.off));
  return metric(diffMin(on, off));
}

export interface EscalationSummary {
  /** Суммарное количество звонков по всем попыткам (с учётом повторов). */
  totalCalls: number;
  /** Сколько времени заняли звонки ответственным — от первого до последнего. */
  responsibleSpan: Metric;
  /** Сколько времени заняло согласование — от первого до последнего. */
  approvalSpan: Metric;
}

function spanFor(inc: FullIncident, kind: EscalationAttempt['kind']): Metric {
  const times = inc.escalations
    .filter((e) => e.kind === kind && e.time)
    .map((e) => parseDT(withTime(inc.startedAt, e.time)))
    .sort((a, b) => a.getTime() - b.getTime());
  if (times.length < 2) return metric(null);
  return metric(diffMin(times[0], times[times.length - 1]));
}

/** Сколько всего звонков понадобилось и сколько времени ушло на ответственных / согласование отдельно. */
export function escalationSummary(inc: FullIncident): EscalationSummary {
  return {
    totalCalls: inc.escalations.reduce((sum, e) => sum + (e.attempts || 1), 0),
    responsibleSpan: spanFor(inc, 'Ответственный'),
    approvalSpan: spanFor(inc, 'Согласование'),
  };
}

function minutesOfDay(time: string): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/**
 * Проверяет, что время шагов хронологии идёт по возрастанию (в порядке шагов на экране).
 * Шаги хранят только время суток (без даты), поэтому один переход через полночь
 * (поздний час → ранний) считается не ошибкой, а сменой календарного дня —
 * иначе любой инцидент, начавшийся вечером и решённый ночью, ложно бракуется.
 * Возвращает текст ошибки для первого шага, где время реально «пошло назад», либо null.
 */
export function validateTimelineOrder(steps: TimelineStep[]): string | null {
  let lastAbsolute: number | null = null;
  let dayOffset = 0;
  let lastLabel = '';
  for (const step of steps) {
    const raw = minutesOfDay(step.time);
    if (raw === null) continue;

    let absolute = raw + dayOffset;
    if (lastAbsolute !== null && absolute < lastAbsolute) {
      const lastTimeOfDay = lastAbsolute % 1440;
      const crossesMidnight = dayOffset === 0 && lastTimeOfDay >= 20 * 60 && raw < 8 * 60;
      if (!crossesMidnight) {
        return `Время шага «${step.kind}» (${step.time}) раньше, чем у предыдущего шага «${lastLabel}» (${pad(Math.floor(lastTimeOfDay / 60))}:${pad(lastTimeOfDay % 60)}).`;
      }
      dayOffset += 1440;
      absolute = raw + dayOffset;
    }

    lastAbsolute = absolute;
    lastLabel = step.kind;
  }
  return null;
}

/** Пустая хронология для новой формы: 4 обязательных шага без времени. */
export function emptyTimeline(): TimelineStep[] {
  return [
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Обнаружено' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Диагностика' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Проблема передана ответственным' },
    { id: crypto.randomUUID(), time: '', action: '', kind: 'Решена' },
  ];
}

/** Следующий код вида INC-2026-00042 по текущему списку инцидентов. */
export function nextIncidentCode(existing: FullIncident[]): string {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;
  const nums = existing
    .filter((i) => i.id.startsWith(prefix))
    .map((i) => parseInt(i.id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(5, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Аналитика дашборда — считается из реального списка инцидентов       */
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
