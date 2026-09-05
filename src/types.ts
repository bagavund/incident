export type SlaState = 'Соблюден' | 'Нарушен';

/** Тип инцидента — редактируемый справочник (Администрирование). */
export type IncidentType = string;

export type TimelineKind =
  | 'Обнаружено'
  | 'Диагностика'
  | 'Проблема передана ответственным'
  | 'Информирование'
  | 'Собран war room'
  | 'Решена';

export const TIMELINE_KINDS: TimelineKind[] = [
  'Обнаружено',
  'Диагностика',
  'Проблема передана ответственным',
  'Информирование',
  'Собран war room',
  'Решена',
];

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

export interface Metrics {
  toDetect: Metric;
  /** Обнаружение → передача ответственным (эскалация). */
  toEscalate: Metric;
  toDiagnose: Metric;
  toResolve: Metric;
}

/** Результат одной попытки дозвониться при эскалации. */
export type EscalationResult = 'Дозвонился' | 'Не дозвонился' | 'Переадресовал на другого ответственного';

export const ESCALATION_RESULTS: EscalationResult[] = [
  'Дозвонился',
  'Не дозвонился',
  'Переадресовал на другого ответственного',
];

export type EscalationKind = 'Ответственный' | 'Согласование';

export const ESCALATION_KINDS: EscalationKind[] = ['Ответственный', 'Согласование'];

/** Канал связи, которым пытались достучаться до ответственного. */
export type CommunicationChannel = 'Телефон' | 'Telegram' | 'Яндекс мессенджер' | 'Почта';

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = ['Телефон', 'Telegram', 'Яндекс мессенджер', 'Почта'];

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
  /** ФИО дежурного, который обнаружил и вёл инцидент (позже — из AD-группы). */
  onDutyName: string;
  createdAt: string;
  startedAt: string;
  detectedAt: string;
  resolvedAt: string | null;
  stub: { on: string; off: string } | null;
  cause: string;
  impact: string;
  taskLink: string;
  zones: string[];
  timeline: TimelineStep[];
  escalations: EscalationAttempt[];
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
