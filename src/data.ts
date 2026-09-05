import type {
  EscalationAttempt,
  FullIncident,
  IncidentType,
  Metric,
  Metrics,
  SlaState,
  TimelineStep,
} from './types';
import { COMMUNICATION_CHANNELS } from './types';

export const PERIODS = [
  { value: '7', label: 'Последние 7 дней' },
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
  { value: '180', label: 'Последние 180 дней' },
  { value: '365', label: 'Последний год' },
  { value: 'custom', label: 'Свой период' },
];

export const INITIAL_INCIDENT_TYPES: IncidentType[] = [
  'Проблема на нашей стороне',
  'Внешняя проблема',
  'Сервис с проблемой',
  'Установлена заглушка',
];

export const INITIAL_SERVICES = [
  'API Gateway', 'Мобильное приложение', 'Авторизация',
  'Платёжный сервис', 'Личный кабинет', 'Уведомления', 'Данные',
];

export const INITIAL_ZONES = ['Backend', 'Frontend', 'Инфраструктура / DevOps', 'Внешний провайдер', 'База данных'];

export const INITIAL_CRITICALITIES = ['Критичный', 'Важный', 'Второстепенный'];

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

/* ------------------------------------------------------------------ */
/* Демо-инциденты (моки) — все уже отработаны и закрыты                */
/* ------------------------------------------------------------------ */
const CAUSES = [
  'Исчерпание пула соединений с БД после релиза',
  'Некорректная конфигурация балансировщика',
  'Деградация внешнего провайдера аутентификации',
  'Утечка памяти в обработчике очереди',
  'Просроченный TLS-сертификат интеграции',
  'Блокировки в БД из-за тяжёлого отчётного запроса',
];

const IMPACTS = [
  'Часть пользователей получала ошибки при основных операциях, конверсия временно просела.',
  'Замедление ответа сервиса, рост числа обращений в поддержку.',
  'Полная недоступность функции на время инцидента для всех клиентов.',
  'Фоновые задачи выполнялись с задержкой, данные обновлялись с опозданием.',
];

const ON_DUTY = ['Петров Иван', 'Смирнова Ольга', 'Козлов Дмитрий', 'Волкова Анна', 'Соколов Егор'];

const ZONES_BY_SERVICE: Record<string, string[]> = {
  'API Gateway': ['Backend', 'Инфраструктура / DevOps'],
  'Мобильное приложение': ['Frontend', 'Backend'],
  Авторизация: ['Backend', 'Внешний провайдер'],
  'Платёжный сервис': ['Backend', 'База данных'],
  'Личный кабинет': ['Frontend'],
  Уведомления: ['Backend', 'Внешний провайдер'],
  Данные: ['База данных', 'Backend'],
};

const addMin = (x: Date, m: number) => new Date(x.getTime() + m * 60000);

type Template = [
  id: string,
  title: string,
  /** Один сервис или несколько — инцидент может затрагивать сразу несколько. */
  service: string | string[],
  type: IncidentType,
  sla: SlaState,
  detectedAt: string,
];

const TEMPLATES: Template[] = [
  // --- июнь ---
  ['INC-2026-00024', 'Ошибка 500 при создании заказа', ['Платёжный сервис', 'API Gateway'], 'Проблема на нашей стороне', 'Соблюден', '30.06.2026 14:32'],
  ['INC-2026-00023', 'Недоступность мобильного приложения', 'Мобильное приложение', 'Сервис с проблемой', 'Нарушен', '30.06.2026 11:15'],
  ['INC-2026-00022', 'Медленная загрузка личного кабинета', 'Личный кабинет', 'Проблема на нашей стороне', 'Соблюден', '29.06.2026 21:45'],
  ['INC-2026-00021', 'Проблемы с авторизацией', 'Авторизация', 'Внешняя проблема', 'Соблюден', '29.06.2026 19:10'],
  ['INC-2026-00020', 'Сбой API Gateway', 'API Gateway', 'Проблема на нашей стороне', 'Соблюден', '29.06.2026 16:05'],
  ['INC-2026-00019', 'Ошибки при оплате', 'Платёжный сервис', 'Сервис с проблемой', 'Соблюден', '28.06.2026 13:22'],
  ['INC-2026-00018', 'Долгое обновление данных', 'Данные', 'Проблема на нашей стороне', 'Соблюден', '27.06.2026 09:40'],
  ['INC-2026-00017', 'Сбой отправки email', 'Уведомления', 'Внешняя проблема', 'Соблюден', '26.06.2026 17:55'],
  ['INC-2026-00016', 'Таймауты в поиске', 'API Gateway', 'Проблема на нашей стороне', 'Нарушен', '25.06.2026 12:03'],
  ['INC-2026-00015', 'Некорректный баланс бонусов', 'Личный кабинет', 'Проблема на нашей стороне', 'Соблюден', '24.06.2026 10:18'],
  ['INC-2026-00014', 'Задержка push-уведомлений', 'Уведомления', 'Установлена заглушка', 'Соблюден', '23.06.2026 08:47'],
  ['INC-2026-00013', 'Ошибка выгрузки отчётов', 'Данные', 'Проблема на нашей стороне', 'Соблюден', '22.06.2026 15:29'],

  // --- май–июнь ---
  ['INC-2026-00012', 'Отказ платёжного шлюза в пиковую нагрузку', ['Платёжный сервис', 'Личный кабинет'], 'Сервис с проблемой', 'Нарушен', '19.06.2026 20:41'],
  ['INC-2026-00011', 'Дубли заказов при повторной отправке', 'API Gateway', 'Проблема на нашей стороне', 'Соблюден', '17.06.2026 13:07'],
  ['INC-2026-00010', 'Медленный отклик авторизации через соцсети', 'Авторизация', 'Внешняя проблема', 'Соблюден', '14.06.2026 09:52'],
  ['INC-2026-00009', 'Заглушка на разделе акций', 'Личный кабинет', 'Установлена заглушка', 'Соблюден', '10.06.2026 16:30'],
  ['INC-2026-00008', 'Ошибка 502 при загрузке каталога', 'API Gateway', 'Проблема на нашей стороне', 'Нарушен', '06.06.2026 11:18'],
  ['INC-2026-00007', 'Не приходят email-уведомления о заказе', 'Уведомления', 'Сервис с проблемой', 'Соблюден', '02.06.2026 08:03'],
  ['INC-2026-00006', 'Просадка производительности БД', 'Данные', 'Проблема на нашей стороне', 'Соблюден', '29.05.2026 22:14'],
  ['INC-2026-00005', 'Сбой push-уведомлений в мобильном приложении', 'Мобильное приложение', 'Проблема на нашей стороне', 'Соблюден', '24.05.2026 15:47'],
  ['INC-2026-00004', 'Утечка сессий при смене пароля', 'Авторизация', 'Проблема на нашей стороне', 'Нарушен', '19.05.2026 10:22'],
  ['INC-2026-00003', 'Задержка обработки платежей провайдером', 'Платёжный сервис', 'Внешняя проблема', 'Соблюден', '13.05.2026 18:09'],
  ['INC-2026-00002', 'Некорректный расчёт скидок в личном кабинете', 'Личный кабинет', 'Проблема на нашей стороне', 'Соблюден', '07.05.2026 12:55'],
  ['INC-2026-00001', 'Массовая рассылка с ошибкой в шаблоне', 'Уведомления', 'Проблема на нашей стороне', 'Соблюден', '02.05.2026 09:40'],

  ['INC-2026-00030', 'Падение сборки после деплоя', 'API Gateway', 'Проблема на нашей стороне', 'Соблюден', '28.06.2026 17:20'],
  ['INC-2026-00029', 'Регресс в тестовом окружении', 'Данные', 'Проблема на нашей стороне', 'Соблюден', '25.06.2026 11:05'],
  ['INC-2026-00028', 'Недоступен CI после обновления рантайма', 'API Gateway', 'Сервис с проблемой', 'Нарушен', '20.06.2026 09:33'],
  ['INC-2026-00027', 'Утечка памяти в фоновом воркере', 'Данные', 'Проблема на нашей стороне', 'Соблюден', '15.06.2026 14:52'],
  ['INC-2026-00026', 'Сбой автотестов из-за внешнего мока', 'API Gateway', 'Внешняя проблема', 'Соблюден', '08.06.2026 10:11'],
  ['INC-2026-00025', 'Заглушка на новом релизе личного кабинета', 'Личный кабинет', 'Установлена заглушка', 'Соблюден', '01.06.2026 16:44'],
];

// Шаблоны датированы маем–июнем 2026-го; переносим их так, чтобы самый свежий
// инцидент (якорь) оказался «сегодня», а относительные интервалы между
// остальными сохранились — иначе при запуске в другую дату дашборд за
// «последние 30 дней» окажется пустым.
const dateOnly = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
const TEMPLATE_ANCHOR = dateOnly(parseDT('30.06.2026 14:32'));

function buildIncident([id, title, serviceOrList, type, sla, detectedAtStr]: Template): FullIncident {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const templateDetected = parseDT(detectedAtStr);
  const daysAgo = Math.round((TEMPLATE_ANCHOR.getTime() - dateOnly(templateDetected).getTime()) / 86400000);

  const detected = dateOnly(new Date());
  detected.setDate(detected.getDate() - daysAgo);
  detected.setHours(templateDetected.getHours(), templateDetected.getMinutes(), 0, 0);

  const started = addMin(detected, -(8 + (seed % 15)));
  const diagnosed = addMin(detected, 3 + (seed % 6));
  const handedOff = addMin(diagnosed, 18 + (seed % 42));
  const resolved = addMin(handedOff, 25 + (seed % 170));

  const services = Array.isArray(serviceOrList) ? serviceOrList : [serviceOrList];
  const zones = [...new Set(services.flatMap((s) => ZONES_BY_SERVICE[s] ?? ['Backend']))];

  const timeline: TimelineStep[] = [
    { id: `${id}-1`, time: fmtT(detected), action: title, kind: 'Обнаружено' },
    {
      id: `${id}-2`,
      time: fmtT(diagnosed),
      action: `Анализ логов и метрик сервиса «${services.join(', ')}»`,
      kind: 'Диагностика',
    },
    {
      id: `${id}-3`,
      time: fmtT(handedOff),
      action: `Эскалация ответственной команде: ${zones[zones.length - 1]}`,
      kind: 'Проблема передана ответственным',
    },
    ...(seed % 5 === 0
      ? [
          {
            id: `${id}-info`,
            time: fmtT(addMin(handedOff, 4)),
            action: 'Разослано уведомление о статусе инцидента',
            kind: 'Информирование' as const,
          },
          {
            id: `${id}-wr`,
            time: fmtT(addMin(handedOff, 9)),
            action: 'Собран телемост для координации команд',
            kind: 'Собран war room' as const,
          },
        ]
      : []),
    { id: `${id}-4`, time: fmtT(resolved), action: 'Инцидент устранён, сервис в норме', kind: 'Решена' },
  ];

  const escalations: EscalationAttempt[] =
    seed % 3 !== 1
      ? [
          {
            id: `${id}-esc-1`,
            time: fmtT(addMin(handedOff, -6)),
            calleeName: ON_DUTY[(seed + 1) % ON_DUTY.length],
            kind: 'Ответственный',
            channel: COMMUNICATION_CHANNELS[seed % COMMUNICATION_CHANNELS.length],
            result: seed % 2 === 0 ? 'Не дозвонился' : 'Дозвонился',
            attempts: seed % 2 === 0 ? 2 : 1,
          },
          ...(seed % 2 === 0
            ? [
                {
                  id: `${id}-esc-2`,
                  time: fmtT(handedOff),
                  calleeName: ON_DUTY[(seed + 2) % ON_DUTY.length],
                  kind: 'Ответственный' as const,
                  channel: COMMUNICATION_CHANNELS[(seed + 1) % COMMUNICATION_CHANNELS.length],
                  result: 'Дозвонился' as const,
                  attempts: 1,
                },
              ]
            : []),
          ...(seed % 4 === 0
            ? [
                {
                  id: `${id}-esc-3`,
                  time: fmtT(addMin(handedOff, 12)),
                  calleeName: ON_DUTY[(seed + 3) % ON_DUTY.length],
                  kind: 'Согласование' as const,
                  channel: COMMUNICATION_CHANNELS[(seed + 2) % COMMUNICATION_CHANNELS.length],
                  result: 'Дозвонился' as const,
                  attempts: 1,
                },
              ]
            : []),
        ]
      : [];

  return {
    id,
    title,
    status: 'published',
    services,
    type,
    criticality: INITIAL_CRITICALITIES[seed % INITIAL_CRITICALITIES.length],
    sla,
    onDutyName: ON_DUTY[seed % ON_DUTY.length],
    createdAt: fmtDT(detected),
    startedAt: fmtDT(started),
    detectedAt: fmtDT(detected),
    resolvedAt: fmtDT(resolved),
    stub: type === 'Установлена заглушка' ? { on: fmtT(diagnosed), off: fmtT(resolved) } : null,
    cause: CAUSES[seed % CAUSES.length],
    impact: IMPACTS[seed % IMPACTS.length],
    taskLink: `https://tracker.example.com/${id}`,
    zones,
    timeline,
    escalations,
  };
}

export const INITIAL_INCIDENTS: FullIncident[] = TEMPLATES.map(buildIncident);
