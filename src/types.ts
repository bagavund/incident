/**
 * Словарь домена: value на бэкенде (PHP-энам) => подпись в интерфейсе.
 *
 * Единственное место, где это соответствие записано: TS-типы выводятся отсюда,
 * а adapters.ts строит по нему обратное отображение для запросов. Раньше копий
 * было две — union'ы здесь и захардкоженные таблицы в адаптерах, — и опечатка в
 * подписи молча превращалась в неверное значение при сохранении.
 */
export const TIMELINE_KIND_LABELS = {
  detected: 'Обнаружено',
  diagnosis: 'Диагностика',
  handed_off: 'Проблема передана ответственным',
  informed: 'Информирование',
  war_room: 'Собран war room',
  resolved: 'Решена',
} as const;

export const ESCALATION_KIND_LABELS = {
  responsible: 'Ответственный',
  approval: 'Согласование',
} as const;

export const ESCALATION_CHANNEL_LABELS = {
  phone: 'Телефон',
  telegram: 'Telegram',
  yandex_messenger: 'Яндекс мессенджер',
  mail: 'Почта',
} as const;

export const ESCALATION_RESULT_LABELS = {
  reached: 'Дозвонился',
  not_reached: 'Не дозвонился',
  redirected: 'Переадресовал на другого ответственного',
} as const;

export const SLA_LABELS = {
  met: 'Соблюден',
  breached: 'Нарушен',
} as const;

const labels = <T extends Record<string, string>>(map: T): T[keyof T][] =>
  Object.values(map) as T[keyof T][];

export type SlaState = (typeof SLA_LABELS)[keyof typeof SLA_LABELS];

/** Тип инцидента — редактируемый справочник (Администрирование). */
export type IncidentType = string;

export type TimelineKind = (typeof TIMELINE_KIND_LABELS)[keyof typeof TIMELINE_KIND_LABELS];

export const TIMELINE_KINDS: TimelineKind[] = labels(TIMELINE_KIND_LABELS);

export interface TimelineStep {
  id: string;
  time: string;
  action: string;
  kind: TimelineKind;
  /** true — промежуточный шаг между «передана ответственным» и «решена» (без выбора типа) */
  custom?: boolean;
}

export interface Metric {
  minutes: number | null;
  human: string | null;
}

export interface EscalationMetrics {
  /** Суммарное число звонков по всем попыткам (с учётом повторов). */
  totalCalls: number;
  /** От первой до последней попытки дозвониться ответственным. */
  responsibleSpan: Metric;
  /** От первой до последней попытки согласования. */
  approvalSpan: Metric;
}

export interface Metrics {
  toDetect: Metric;
  /** Обнаружение → передача ответственным (эскалация). */
  toEscalate: Metric;
  toDiagnose: Metric;
  toResolve: Metric;
  /** Сколько провисела временная заглушка (от установки до снятия). */
  stubDuration: Metric;
  escalation: EscalationMetrics;
}

/** Результат одной попытки дозвониться при эскалации. */
export type EscalationResult = (typeof ESCALATION_RESULT_LABELS)[keyof typeof ESCALATION_RESULT_LABELS];

export const ESCALATION_RESULTS: EscalationResult[] = labels(ESCALATION_RESULT_LABELS);

export type EscalationKind = (typeof ESCALATION_KIND_LABELS)[keyof typeof ESCALATION_KIND_LABELS];

export const ESCALATION_KINDS: EscalationKind[] = labels(ESCALATION_KIND_LABELS);

/** Канал связи, которым пытались достучаться до ответственного. */
export type CommunicationChannel = (typeof ESCALATION_CHANNEL_LABELS)[keyof typeof ESCALATION_CHANNEL_LABELS];

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = labels(ESCALATION_CHANNEL_LABELS);

/** Одна попытка эскалации (звонок/обращение) в рамках инцидента. */
export interface EscalationAttempt {
  id: string;
  time: string;
  calleeName: string;
  kind: EscalationKind;
  channel: CommunicationChannel;
  result: EscalationResult;
  /** Сколько звонков понадобилось, чтобы получить этот результат. */
  attempts: number;
}

/** Критичность конкретного инцидента — редактируемый справочник (Администрирование). */
export type IncidentCriticality = string;

/** Черновик виден только создателю до публикации — не хватает причины (постмортема). */
export type IncidentStatus = 'draft' | 'published';

/** Единая, редактируемая модель инцидента — и для списка, и для карточки. */
export interface FullIncident {
  id: string;
  title: string;
  status: IncidentStatus;
  /** Один инцидент может затрагивать несколько сервисов. */
  services: string[];
  type: IncidentType;
  /** Проставляет дежурный вручную — критичность самого инцидента, не сервиса. */
  criticality: IncidentCriticality;
  sla: SlaState;
  /** Дежурный, вписанный в инцидент — реальный аккаунт, а не свободный текст. */
  onDuty: { id: number; name: string } | null;
  createdAt: string;
  startedAt: string;
  detectedAt: string;
  resolvedAt: string | null;
  /** off === null — заглушка ещё не снята. */
  stub: { on: string; off: string | null } | null;
  cause: string;
  impact: string;
  taskLink: string;
  zones: string[];
  timeline: TimelineStep[];
  escalations: EscalationAttempt[];
  /** Тайминги считает сервер (IncidentMetrics) — клиент их только показывает. */
  metrics: Metrics;
}

/**
 * То, что заполняет форма. Код инцидента, вердикт по SLA и дату создания
 * присваивает сервер, тайминги он же считает — клиент их не выдумывает.
 * Дежурного форма выбирает по id из списка пользователей, а не вводит текстом.
 */
export type IncidentDraft = Omit<FullIncident, 'id' | 'sla' | 'createdAt' | 'metrics' | 'onDuty'> & {
  onDutyUserId: number | null;
};

/** Роль учётной записи: полный доступ или дежурный, привязанный к своим инцидентам. */
export type UserRole = 'admin' | 'on_duty';

/** Строка списка пользователей — выбор дежурного в форме, управление учётками в админке. */
export interface UserAccount {
  id: number;
  name: string;
  username: string;
  position: string | null;
  role: UserRole;
  role_label: string;
}

/** Фильтры списка инцидентов; часть полей заполняется при клике по дашборду. */
export interface IncidentFilters {
  q: string;
  service: string;
  type: string;
  sla: string;
  zone: string;
  from: string;
  to: string;
  /** 0 = понедельник … 6 = воскресенье (клик по тепловой карте). */
  weekday?: number;
  hourStart?: number;
  hourEnd?: number;
}

export type Screen = 'dashboard' | 'incidents' | 'create' | 'admin';
