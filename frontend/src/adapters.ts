import {
  ESCALATION_CHANNEL_LABELS,
  ESCALATION_KIND_LABELS,
  ESCALATION_RESULT_LABELS,
  TIMELINE_KIND_LABELS,
  type EscalationAttempt,
  type EscalationMetrics,
  type FullIncident,
  type IncidentDraft,
  type Metric,
  type Metrics,
  type TimelineStep,
} from './types';

/** Плоское "value" из бэкенда — {value, label}. */
interface EnumPayload {
  value: string;
  label: string;
}

export interface ApiTimelineStep {
  id: number;
  position: number;
  kind: string;
  kind_label: string;
  action: string | null;
  time: string | null;
  occurred_at: string | null;
  custom: boolean;
}

export interface ApiEscalation {
  id: number;
  position: number;
  time: string | null;
  callee_name: string | null;
  kind: EnumPayload;
  channel: EnumPayload;
  result: EnumPayload;
  attempts: number;
}

export interface ApiIncident {
  id: number;
  code: string;
  title: string;
  services?: { id: number; name: string }[];
  type: string | null;
  criticality: string | null;
  status: EnumPayload;
  sla: EnumPayload;
  on_duty: { id: number; name: string } | null;
  started_at: string | null;
  detected_at: string | null;
  resolved_at: string | null;
  stub: { installed: boolean; on: string | null; off: string | null } | null;
  cause: string | null;
  impact: string | null;
  impact_targets: string[] | null;
  task_link: string | null;
  zones: string[];
  timeline?: ApiTimelineStep[];
  escalations?: ApiEscalation[];
  metrics: ApiMetrics;
  created_at: string | null;
}

interface ApiMetrics {
  to_detect: Metric;
  to_escalate: Metric;
  to_diagnose: Metric;
  to_resolve: Metric;
  stub_duration: Metric;
  escalation: {
    total_calls: number;
    responsible_span: Metric;
    approval_span: Metric;
  };
}

/** Обратное отображение «подпись в интерфейсе → value бэкенда» из словаря домена. */
function invert<T extends Record<string, string>>(map: T): Record<string, keyof T> {
  return Object.fromEntries(Object.entries(map).map(([value, label]) => [label, value]));
}

const TO_VALUE = {
  timelineKind: invert(TIMELINE_KIND_LABELS),
  escalationKind: invert(ESCALATION_KIND_LABELS),
  escalationChannel: invert(ESCALATION_CHANNEL_LABELS),
  escalationResult: invert(ESCALATION_RESULT_LABELS),
};

/**
 * Подпись, которой нет в словаре, — это рассинхрон фронта и бэкенда. Молчаливый
 * фолбэк на «первое попавшееся» значение записал бы в базу неверные данные,
 * поэтому падаем громко.
 */
function toValue(kind: keyof typeof TO_VALUE, label: string): string {
  const value = TO_VALUE[kind][label];
  if (!value) throw new Error(`Неизвестное значение «${label}» в словаре ${kind}.`);
  return String(value);
}

/** Числовой id, присвоенный бэкендом, отличаем от клиентского crypto.randomUUID(). */
const isBackendId = (id: string) => /^\d+$/.test(id);

/**
 * Настенное время инцидента, без конвертации в UTC. Шаги хронологии и эскалаций
 * приходят/уходят как "HH:MM" в локальном времени дежурного; started/detected/
 * resolved обязаны жить в том же времени, иначе метрики, сравнивающие «настоящий»
 * timestamp со временем шага, уезжают на смещение пояса браузера.
 */
const iso = (display: string): string => {
  const [d, t] = display.split(' ');
  const [dd, mm, yyyy] = d.split('.');
  return `${yyyy}-${mm}-${dd} ${t || '00:00'}:00`;
};

/** Читает Y-M-D H:M прямо из ISO-строки бэкенда, игнорируя её смещение (+00:00). */
const fromIso = (value: string | null): string => {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return '';
  const [, yyyy, mm, dd, hh, min] = m;
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
};

export function mapIncident(api: ApiIncident): FullIncident {
  return {
    id: api.code,
    title: api.title,
    status: (api.status.value as FullIncident['status']) ?? 'draft',
    services: api.services?.map((s) => s.name) ?? [],
    type: api.type ?? '',
    criticality: api.criticality ?? '',
    sla: (api.sla.label as FullIncident['sla']) ?? 'Соблюден',
    onDuty: api.on_duty ? { id: api.on_duty.id, name: api.on_duty.name } : null,
    createdAt: fromIso(api.created_at) || fromIso(api.detected_at),
    startedAt: fromIso(api.started_at),
    detectedAt: fromIso(api.detected_at),
    resolvedAt: api.resolved_at ? fromIso(api.resolved_at) : null,
    stub: api.stub?.installed ? { on: api.stub.on ?? '', off: api.stub.off } : null,
    cause: api.cause ?? '',
    impact: api.impact ?? '',
    impactTargets: (api.impact_targets ?? null) as FullIncident['impactTargets'],
    taskLink: api.task_link ?? '',
    zones: api.zones ?? [],
    timeline: (api.timeline ?? []).map(mapTimelineStep),
    escalations: (api.escalations ?? []).map(mapEscalation),
    metrics: mapMetrics(api.metrics),
  };
}

const NO_METRIC: Metric = { minutes: null, human: null };

const NO_ESCALATION: EscalationMetrics = {
  totalCalls: 0,
  responsibleSpan: NO_METRIC,
  approvalSpan: NO_METRIC,
};

function mapMetrics(m: ApiMetrics | undefined): Metrics {
  return {
    toDetect: m?.to_detect ?? NO_METRIC,
    toEscalate: m?.to_escalate ?? NO_METRIC,
    toDiagnose: m?.to_diagnose ?? NO_METRIC,
    toResolve: m?.to_resolve ?? NO_METRIC,
    stubDuration: m?.stub_duration ?? NO_METRIC,
    escalation: m?.escalation
      ? {
          totalCalls: m.escalation.total_calls,
          responsibleSpan: m.escalation.responsible_span ?? NO_METRIC,
          approvalSpan: m.escalation.approval_span ?? NO_METRIC,
        }
      : NO_ESCALATION,
  };
}

function mapTimelineStep(s: ApiTimelineStep): TimelineStep {
  return {
    id: String(s.id),
    time: s.time ?? '',
    action: s.action ?? '',
    kind: s.kind_label as TimelineStep['kind'],
    custom: s.custom,
  };
}

function mapEscalation(e: ApiEscalation): EscalationAttempt {
  return {
    id: String(e.id),
    time: e.time ?? '',
    calleeName: e.callee_name ?? '',
    kind: e.kind.label as EscalationAttempt['kind'],
    channel: e.channel.label as EscalationAttempt['channel'],
    result: e.result.label as EscalationAttempt['result'],
    attempts: e.attempts,
  };
}

/** Готовит тело запроса create/update; serviceIds — id сервисов, найденные по названиям из inc.services. */
export function mapIncidentToPayload(inc: IncidentDraft, serviceIds: number[]) {
  return {
    title: inc.title,
    services: serviceIds,
    // Черновик может быть не заполнен — пустые справочные поля не отправляем,
    // иначе бэкенд проверит "" по справочнику и вернёт ошибку.
    type: inc.type || undefined,
    criticality: inc.criticality || undefined,
    status: inc.status,
    on_duty_user_id: inc.onDutyUserId,
    started_at: inc.startedAt ? iso(inc.startedAt) : undefined,
    detected_at: inc.detectedAt ? iso(inc.detectedAt) : undefined,
    resolved_at: inc.resolvedAt ? iso(inc.resolvedAt) : null,
    stub_installed: !!inc.stub,
    stub_on: inc.stub?.on || null,
    stub_off: inc.stub?.off || null,
    cause: inc.cause,
    impact: inc.impact,
    impact_targets: inc.impactTargets,
    task_link: inc.taskLink,
    zones: inc.zones,
    timeline: inc.timeline.map((s) => ({
      id: isBackendId(s.id) ? Number(s.id) : undefined,
      kind: toValue('timelineKind', s.kind),
      action: s.action,
      time: s.time || null,
      custom: !!s.custom,
    })),
    escalations: inc.escalations.map((e) => ({
      id: isBackendId(e.id) ? Number(e.id) : undefined,
      time: e.time || null,
      callee_name: e.calleeName,
      kind: toValue('escalationKind', e.kind),
      channel: toValue('escalationChannel', e.channel),
      result: toValue('escalationResult', e.result),
      attempts: e.attempts,
    })),
  };
}
