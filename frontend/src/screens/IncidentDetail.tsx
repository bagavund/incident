import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Pencil, PhoneCall, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { fmtHumanDT } from '../data';
import { apiGet } from '../lib/api';
import { safeExternalUrl } from '../lib/url';
import { useStore } from '../store';
import { IMPACT_TARGET_LABELS, PROBLEM_CATEGORY_LABELS, type ImpactTarget, type TimelineKind } from '../types';
import { Badge, Button, Card, CardHeader, cn, InfoHint, SlaBadge } from '../components/ui';
import { IncidentForm } from './IncidentForm';

const KIND_COLOR: Record<TimelineKind, string> = {
  Обнаружено: 'bg-blue-400',
  Диагностика: 'bg-med',
  'Проблема передана ответственным': 'bg-high',
  Информирование: 'bg-blue-400',
  'Собран war room': 'bg-med',
  Решена: 'bg-neon',
};

const ESCALATION_RESULT_COLOR: Record<string, 'neon' | 'red' | 'blue'> = {
  Дозвонился: 'neon',
  'Не дозвонился': 'red',
  'Переадресовал на другого ответственного': 'blue',
};

export function IncidentDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { getById, removeIncident, lookups } = useStore();
  const { canEditIncident } = useAuth();
  const [editing, setEditing] = useState(false);
  const incident = useMemo(() => getById(id), [getById, id]);
  const metrics = incident?.metrics ?? null;
  const escalation = metrics?.escalation ?? null;
  const stub = metrics?.stubDuration ?? null;
  const typeCategory = lookups.incidentTypes.rows.find((r) => r.name === incident?.type)?.category ?? null;

  const handleDelete = async () => {
    if (!incident) return;
    if (!window.confirm(`Удалить инцидент «${incident.title}» (${incident.id})? Это действие необратимо.`)) return;
    try {
      await removeIncident(incident.id);
      onBack();
    } catch {
      window.alert('Не удалось удалить инцидент. Проверьте соединение с сервером.');
    }
  };

  if (!incident || !metrics) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-200">
          <ArrowLeft size={15} /> Назад к списку
        </button>
        <p className="text-sm text-gray-500">Инцидент не найден.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <IncidentForm
        initial={incident}
        onSaved={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-gray-400 transition-colors hover:text-gray-200">
        <ArrowLeft size={15} /> Назад к списку
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-neon">{incident.id}</span>
            <SlaBadge sla={incident.sla} />
            {incident.status === 'draft' && <Badge color="gray">Черновик</Badge>}
          </div>
          <h1 className="mt-1 font-display text-xl font-semibold text-gray-50">{incident.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {incident.services.map((s) => (
              <Badge key={s} color="gray">
                {s}
              </Badge>
            ))}
            {typeCategory && PROBLEM_CATEGORY_LABELS[typeCategory] !== incident.type && (
              <Badge color="gray">{PROBLEM_CATEGORY_LABELS[typeCategory]}</Badge>
            )}
            <Badge color="neon">{incident.type}</Badge>
            {incident.criticality && <Badge color="red">{incident.criticality}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditIncident(incident) && (
            <>
              <Button icon={<Pencil size={14} />} onClick={() => setEditing(true)}>
                Редактировать
              </Button>
              <Button
                icon={<Trash2 size={14} />}
                onClick={handleDelete}
                className="border-crit/30 text-crit hover:border-crit/60 hover:bg-crit/[0.08] hover:text-crit"
              >
                Удалить
              </Button>
            </>
          )}
          {safeExternalUrl(incident.taskLink) && (
            <a
              href={safeExternalUrl(incident.taskLink)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3.5 py-2 text-[13px] text-gray-300 transition-colors hover:bg-white/[0.04]"
            >
              <ExternalLink size={14} />
              Задача в трекере
            </a>
          )}
        </div>
      </div>

      {/* metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <Metric label="Время до обнаружения" value={metrics.toDetect.human} hint="Время между началом проблемы и её обнаружением дежурным (MTTD)." />
        <Metric label="Время на диагностику" value={metrics.toDiagnose.human} hint="Время между началом диагностики и передачей проблемы ответственным." />
        <Metric label="Время до эскалации" value={metrics.toEscalate.human} hint="Время между обнаружением и передачей проблемы ответственным." />
        <Metric label="Показ заглушки" value={stub?.human ?? null} hint="Сколько провисела временная заглушка — от установки до снятия." />
        <Metric label="Общее время решения" value={metrics.toResolve.human} hint="Время от начала инцидента до его устранения (MTTR)." />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* left */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Хронология" subtitle="Полный ход работы над инцидентом" />
            <div className="p-5 pt-2">
              <ol className="relative space-y-4 border-l border-neon/30 pl-6">
                {incident.timeline
                  .filter((s) => s.time || s.action)
                  .map((s) => (
                    <li key={s.id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-bg',
                          s.custom ? 'bg-gray-600' : KIND_COLOR[s.kind],
                        )}
                      />
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xs text-neon">{s.time || '—'}</span>
                        <span className="text-xs font-medium text-gray-400">{s.kind}</span>
                      </div>
                      {s.action && <p className="mt-1 text-[13px] text-gray-200">{s.action}</p>}
                    </li>
                  ))}
              </ol>
            </div>
          </Card>

          {incident.escalations.length > 0 && escalation && (
            <Card>
              <CardHeader title="Эскалации" subtitle={`Количество звонков: ${escalation.totalCalls}`} />
              <ul className="space-y-2 px-5 pt-1">
                {incident.escalations.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[13px]"
                  >
                    <PhoneCall size={13} className="flex-none text-gray-500" />
                    <span className="font-mono text-xs text-neon">{e.time || '—'}</span>
                    <span className="text-gray-200">{e.calleeName || '—'}</span>
                    <span className="text-xs text-gray-500">
                      {e.kind} · {e.channel}
                      {e.attempts > 1 && ` · ${e.attempts} попытки`}
                    </span>
                    <Badge color={ESCALATION_RESULT_COLOR[e.result] ?? 'gray'} className="ml-auto">
                      {e.result}
                    </Badge>
                  </li>
                ))}
              </ul>
              {(escalation.responsibleSpan.human || escalation.approvalSpan.human) && (
                <dl className="mt-2 divide-y divide-white/[0.05] px-5 pb-5 pt-2 text-[13px]">
                  {escalation.responsibleSpan.human && (
                    <Row k="Время на дозвон ответственным" v={escalation.responsibleSpan.human} />
                  )}
                  {escalation.approvalSpan.human && <Row k="Время на согласование" v={escalation.approvalSpan.human} />}
                </dl>
              )}
            </Card>
          )}

          <Card>
            <CardHeader title="Причина инцидента" />
            <p className="px-5 pb-5 pt-1 text-[13px] leading-relaxed text-gray-300">{incident.cause || '—'}</p>
          </Card>

          <Card>
            <CardHeader title="Влияние" />
            <div className="px-5 pb-5 pt-1">
              <ImpactTargets targets={incident.impactTargets} />
              <p className="mt-2 text-[13px] leading-relaxed text-gray-300">{incident.impact || '—'}</p>
            </div>
          </Card>
        </div>

        {/* right */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Тайминги" />
            <dl className="divide-y divide-white/[0.05] px-5 pb-2 pt-1 text-[13px]">
              <Row k="Дежурный" v={incident.onDuty?.name || '—'} />
              <Row k="Начало инцидента" v={fmtHumanDT(incident.startedAt) || '—'} />
              <Row k="Обнаружен" v={fmtHumanDT(incident.detectedAt) || '—'} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Заглушка" />
            {incident.stub ? (
              <dl className="divide-y divide-white/[0.05] px-5 pb-2 pt-1 text-[13px]">
                <Row k="Установлена в" v={incident.stub.on || '—'} />
                <Row k="Снята в" v={incident.stub.off || '—'} />
              </dl>
            ) : (
              <p className="px-5 pb-5 pt-1 text-[13px] text-gray-500">Заглушка не устанавливалась</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Зона ответственности" />
            <div className="flex flex-wrap gap-2 px-5 pb-5 pt-1">
              {incident.zones.length === 0 && <span className="text-xs text-gray-600">Не указана</span>}
              {incident.zones.map((z) => (
                <Badge key={z} color="gray">
                  {z}
                </Badge>
              ))}
            </div>
          </Card>

          <AuditLog incidentId={incident.id} />
        </div>
      </div>
    </div>
  );
}

interface AuditEntry {
  id: number;
  action: 'created' | 'updated' | 'deleted';
  user: { id: number; name: string } | null;
  changes: Record<string, [unknown, unknown]> | null;
  created_at: string;
}

/** Подпись поля в записи журнала — то же название, что и в форме инцидента. */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Название',
  type: 'Тип',
  criticality: 'Критичность',
  status: 'Статус',
  sla: 'SLA',
  on_duty_user_id: 'Дежурный',
  started_at: 'Начало инцидента',
  detected_at: 'Обнаружен',
  resolved_at: 'Решён',
  stub_installed: 'Заглушка установлена',
  stub_on: 'Заглушка: установлена в',
  stub_off: 'Заглушка: снята в',
  cause: 'Причина',
  impact: 'Влияние',
  impact_targets: 'Влияние на сайт/МП',
  task_link: 'Ссылка на задачу',
  zones: 'Зона ответственности',
  services: 'Сервисы',
};

const AUDIT_ACTION_LABEL: Record<AuditEntry['action'], string> = {
  created: 'Создан',
  updated: 'Изменён',
  deleted: 'Удалён',
};

/** Журнал изменений инцидента — кто и что поменял. Грузится лениво, при открытии карточки. */
function AuditLog({ incidentId }: { incidentId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);

    apiGet<{ data: AuditEntry[] }>(`/incidents/${incidentId}/audit`)
      .then((res) => {
        if (!cancelled) setEntries(res.data);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить журнал изменений.');
      });

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  return (
    <Card>
      <CardHeader title="История изменений" />
      <div className="space-y-3 px-5 pb-5 pt-1 text-[13px]">
        {error && <p className="text-xs text-crit">{error}</p>}
        {!error && entries === null && <p className="text-xs text-gray-600">Загрузка…</p>}
        {entries?.length === 0 && <p className="text-xs text-gray-600">Изменений не было</p>}
        {entries?.map((entry) => (
          <div key={entry.id} className="border-l-2 border-white/10 pl-3">
            <p className="text-gray-300">
              <span className="font-medium">{AUDIT_ACTION_LABEL[entry.action]}</span>
              {entry.user && <span className="text-gray-500"> · {entry.user.name}</span>}
            </p>
            <p className="font-mono text-[11px] text-gray-600">
              {new Date(entry.created_at).toLocaleString('ru-RU')}
            </p>
            {entry.changes && (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
                {Object.entries(entry.changes).map(([field, [oldValue, newValue]]) => (
                  <li key={field}>
                    <span className="text-gray-400">{AUDIT_FIELD_LABELS[field] ?? field}:</span>{' '}
                    {formatAuditValue(oldValue)} → {formatAuditValue(newValue)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function Metric({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        {label}
        {hint && <InfoHint text={hint} />}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold tracking-tight text-gray-50">{value ?? '—'}</p>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-gray-500">{k}</dt>
      <dd className="text-[13px] text-gray-300">{v}</dd>
    </div>
  );
}

/** Затронутые площадки: null — не заполнено, [] — влияния не было. */
function ImpactTargets({ targets }: { targets: ImpactTarget[] | null }) {
  if (targets === null) return null;
  if (targets.length === 0) {
    return <p className="text-xs text-gray-500">Влияния на пользователей не было</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((t) => (
        <Badge key={t} color="red">
          {IMPACT_TARGET_LABELS[t]}
        </Badge>
      ))}
    </div>
  );
}
