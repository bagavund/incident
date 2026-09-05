import { fmtDT, parseDT } from './data';
import type { EscalationAttempt, FullIncident, TimelineStep } from './types';

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
  type: string;
  criticality: string;
  status: EnumPayload;
  sla: EnumPayload;
  on_duty_name: string | null;
  started_at: string | null;
  detected_at: string | null;
  resolved_at: string | null;
  stub: { installed: boolean; on: string | null; off: string | null } | null;
  cause: string | null;
  impact: string | null;
  task_link: string | null;
  zones: string[];
  timeline?: ApiTimelineStep[];
  escalations?: ApiEscalation[];
  created_at: string | null;
}

const TIMELINE_KIND_LABEL_TO_VALUE: Record<string, string> = {
  Обнаружено: 'detected',
  Диагностика: 'diagnosis',
  'Проблема передана ответственным': 'handed_off',
  Информирование: 'informed',
  'Собран war room': 'war_room',
  Решена: 'resolved',
};

const ESCALATION_KIND_LABEL_TO_VALUE: Record<string, string> = {
  Ответственный: 'responsible',
  Согласование: 'approval',
};

const ESCALATION_CHANNEL_LABEL_TO_VALUE: Record<string, string> = {
  Телефон: 'phone',
  Telegram: 'telegram',
  'Яндекс мессенджер': 'yandex_messenger',
  Почта: 'mail',
};

const ESCALATION_RESULT_LABEL_TO_VALUE: Record<string, string> = {
  Дозвонился: 'reached',
  'Не дозвонился': 'not_reached',
  'Переадресовал на другого ответственного': 'redirected',
};

const SLA_LABEL_TO_VALUE: Record<string, string> = {
  Соблюден: 'met',
  Нарушен: 'breached',
};

/** Числовой id, присвоенный бэкендом, отличаем от клиентского crypto.randomUUID(). */
const isBackendId = (id: string) => /^\d+$/.test(id);

const iso = (display: string): string => parseDT(display).toISOString();
const fromIso = (value: string | null): string => (value ? fmtDT(new Date(value)) : '');

export function mapIncident(api: ApiIncident): FullIncident {
  return {
    id: api.code,
    title: api.title,
    status: (api.status.value as FullIncident['status']) ?? 'draft',
    services: api.services?.map((s) => s.name) ?? [],
    type: api.type,
    criticality: api.criticality,
    sla: (api.sla.label as FullIncident['sla']) ?? 'Соблюден',
    onDutyName: api.on_duty_name ?? '',
    createdAt: fromIso(api.created_at) || fromIso(api.detected_at),
    startedAt: fromIso(api.started_at),
    detectedAt: fromIso(api.detected_at),
    resolvedAt: api.resolved_at ? fromIso(api.resolved_at) : null,
    stub: api.stub?.installed ? { on: api.stub.on ?? '', off: api.stub.off ?? '—' } : null,
    cause: api.cause ?? '',
    impact: api.impact ?? '',
    taskLink: api.task_link ?? '',
    zones: api.zones ?? [],
    timeline: (api.timeline ?? []).map(mapTimelineStep),
    escalations: (api.escalations ?? []).map(mapEscalation),
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
export function mapIncidentToPayload(inc: FullIncident, serviceIds: number[]) {
  return {
    title: inc.title,
    services: serviceIds,
    type: inc.type,
    criticality: inc.criticality,
    status: inc.status,
    sla: SLA_LABEL_TO_VALUE[inc.sla] ?? 'met',
    on_duty_name: inc.onDutyName,
    started_at: inc.startedAt ? iso(inc.startedAt) : undefined,
    detected_at: inc.detectedAt ? iso(inc.detectedAt) : undefined,
    resolved_at: inc.resolvedAt ? iso(inc.resolvedAt) : null,
    stub_installed: !!inc.stub,
    stub_on: inc.stub?.on || null,
    stub_off: inc.stub && inc.stub.off !== '—' ? inc.stub.off : null,
    cause: inc.cause,
    impact: inc.impact,
    task_link: inc.taskLink,
    zones: inc.zones,
    timeline: inc.timeline.map((s) => ({
      id: isBackendId(s.id) ? Number(s.id) : undefined,
      kind: TIMELINE_KIND_LABEL_TO_VALUE[s.kind] ?? 'handed_off',
      action: s.action,
      time: s.time || null,
      custom: !!s.custom,
    })),
    escalations: inc.escalations.map((e) => ({
      id: isBackendId(e.id) ? Number(e.id) : undefined,
      time: e.time || null,
      callee_name: e.calleeName,
      kind: ESCALATION_KIND_LABEL_TO_VALUE[e.kind] ?? 'responsible',
      channel: ESCALATION_CHANNEL_LABEL_TO_VALUE[e.channel] ?? 'phone',
      result: ESCALATION_RESULT_LABEL_TO_VALUE[e.result] ?? 'reached',
      attempts: e.attempts,
    })),
  };
}
