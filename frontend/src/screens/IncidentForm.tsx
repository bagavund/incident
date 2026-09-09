import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Link2, Lock, Minus, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import {
  defaultStartInput,
  emptyTimeline,
  fromInputDT,
  toInputDT,
  withTime,
} from '../data';
import { ApiError } from '../lib/api';
import { setNavigationGuard } from '../router';
import { useStore } from '../store';
import {
  COMMUNICATION_CHANNELS,
  ESCALATION_KINDS,
  ESCALATION_RESULTS,
  IMPACT_TARGET_LABELS,
  IMPACT_TARGETS,
  TIMELINE_KINDS,
  type EscalationAttempt,
  type FullIncident,
  type ImpactTarget,
  type IncidentDraft,
  type TimelineKind,
  type TimelineStep,
} from '../types';
import {
  AutoTextarea,
  Button,
  Card,
  CardHeader,
  Checkbox,
  cn,
  Field,
  Input,
  MultiSelect,
  Select,
  Textarea,
} from '../components/ui';

const KIND_COLOR: Record<TimelineKind, string> = {
  Обнаружено: 'bg-blue-400',
  Диагностика: 'bg-med',
  'Проблема передана ответственным': 'bg-high',
  Информирование: 'bg-blue-400',
  'Собран war room': 'bg-med',
  Решена: 'bg-neon',
};

export function IncidentForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: FullIncident;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const { addIncident, updateIncident, services: serviceOptions, lookups, criticalities, users } = useStore();

  const typeRows = lookups.incidentTypes.rows;
  const zoneRows = lookups.zones.rows;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [criticality, setCriticality] = useState(initial?.criticality ?? '');
  const [activeServices, setActiveServices] = useState<string[]>(initial?.services ?? []);
  const [onDutyUserId, setOnDutyUserId] = useState<number | ''>(initial?.onDuty?.id ?? '');
  const [startedAtInput, setStartedAtInput] = useState(
    initial ? toInputDT(initial.startedAt) : defaultStartInput(),
  );
  const [resolvedAtInput, setResolvedAtInput] = useState(initial?.resolvedAt ? toInputDT(initial.resolvedAt) : '');
  const [stub, setStub] = useState(!!initial?.stub);
  const [stubOn, setStubOn] = useState(initial?.stub?.on ?? '');
  const [stubOff, setStubOff] = useState(initial?.stub?.off ?? '');
  const [zoneChecks, setZoneChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((initial?.zones ?? []).map((z) => [z, true])),
  );
  const [steps, setSteps] = useState<TimelineStep[]>(() => {
    let base = initial?.timeline ?? emptyTimeline();
    // «Решена» — обязательный замыкающий шаг; на старых данных мог отсутствовать.
    if (!base.some((s) => s.kind === 'Решена')) {
      base = [...base, { id: crypto.randomUUID(), time: '', action: '', kind: 'Решена' }];
    }
    // Время «Решена» — зеркало поля «Дата и время завершения»: приводим сразу при открытии.
    if (initial?.resolvedAt) {
      const t = toInputDT(initial.resolvedAt).split('T')[1] ?? '';
      base = base.map((s) => (s.kind === 'Решена' ? { ...s, time: t } : s));
    }
    return base;
  });
  const [escalations, setEscalations] = useState<EscalationAttempt[]>(initial?.escalations ?? []);
  const [cause, setCause] = useState(initial?.cause ?? '');
  const [impact, setImpact] = useState(initial?.impact ?? '');
  /** [] на бэке — «влияния не было»; null — не заполнено. */
  const [impactNone, setImpactNone] = useState(initial?.impactTargets?.length === 0);
  const [impactTargets, setImpactTargets] = useState<ImpactTarget[]>(initial?.impactTargets ?? []);
  const [taskLink, setTaskLink] = useState(initial?.taskLink ?? '');
  const [error, setError] = useState<string | null>(null);

  /** Ref, а не state: должен читаться синхронно из save() в тот же тик, что и сброс перед навигацией. */
  const dirtyRef = useRef(false);

  /**
   * Снимок значений на момент монтирования. Сравнение с ним (а не счётчик запусков эффекта)
   * не ломается от двойного вызова эффектов в React.StrictMode в dev-режиме.
   */
  const baselineRef = useRef({
    title, type, criticality, activeServices, onDutyUserId, startedAtInput, resolvedAtInput,
    stub, stubOn, stubOff, zoneChecks, steps, escalations, cause, impact, impactNone, impactTargets, taskLink,
  });
  useEffect(() => {
    const b = baselineRef.current;
    dirtyRef.current =
      title !== b.title || type !== b.type || criticality !== b.criticality ||
      activeServices !== b.activeServices || onDutyUserId !== b.onDutyUserId ||
      startedAtInput !== b.startedAtInput || resolvedAtInput !== b.resolvedAtInput ||
      stub !== b.stub || stubOn !== b.stubOn || stubOff !== b.stubOff ||
      zoneChecks !== b.zoneChecks || steps !== b.steps || escalations !== b.escalations ||
      cause !== b.cause || impact !== b.impact || impactNone !== b.impactNone ||
      impactTargets !== b.impactTargets || taskLink !== b.taskLink;
  }, [
    title, type, criticality, activeServices, onDutyUserId, startedAtInput, resolvedAtInput,
    stub, stubOn, stubOff, zoneChecks, steps, escalations, cause, impact, impactNone, impactTargets, taskLink,
  ]);

  /** Блокирует переход по сайдбару/настройкам, пока в форме есть несохранённые изменения. */
  useEffect(() => {
    setNavigationGuard(
      () => !dirtyRef.current || window.confirm('Есть несохранённые изменения. Уйти со страницы без сохранения?'),
    );
    return () => setNavigationGuard(null);
  }, []);

  /** Блокирует закрытие вкладки/обновление страницы с несохранёнными изменениями. */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const confirmDiscard = () =>
    !dirtyRef.current || window.confirm('Есть несохранённые изменения. Отменить и уйти без сохранения?');

  const addStep = () =>
    setSteps((s) => {
      const next = [...s];
      const lastIdx = next.map((x) => x.kind).lastIndexOf('Решена');
      const insertAt = lastIdx === -1 ? next.length : lastIdx;
      next.splice(insertAt, 0, {
        id: crypto.randomUUID(),
        time: '',
        action: '',
        kind: 'Проблема передана ответственным',
        custom: true,
      });
      return next;
    });

  const removeStep = (id: string) =>
    setSteps((s) => {
      const step = s.find((x) => x.id === id);
      if (!step || step.kind === 'Решена') return s; // замыкающий шаг не удаляем
      if ((step.time || step.action) && !window.confirm('Удалить этот шаг хронологии?')) return s;
      return s.filter((x) => x.id !== id);
    });

  const updateStep = (id: string, patch: Partial<TimelineStep>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((list) => {
      const idx = list.findIndex((x) => x.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= list.length) return list;
      // «Решена» держим последней — не двигаем её саму и не перепрыгиваем через неё.
      if (list[idx].kind === 'Решена' || list[target].kind === 'Решена') return list;
      const next = [...list];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  /** «Была рассылка» / «Собирался war room» — обязательный шаг хронологии, который появляется/исчезает вместе с чекбоксом. */
  const toggleFixedStep = (kind: TimelineKind, present: boolean) => {
    setSteps((s) => {
      if (present) {
        if (s.some((x) => x.kind === kind)) return s;
        const lastIdx = s.map((x) => x.kind).lastIndexOf('Решена');
        const insertAt = lastIdx === -1 ? s.length : lastIdx;
        const next = [...s];
        next.splice(insertAt, 0, { id: crypto.randomUUID(), time: '', action: '', kind });
        return next;
      }
      return s.filter((x) => x.kind !== kind);
    });
  };
  const notified = steps.some((s) => s.kind === 'Информирование');
  const warRoomCreated = steps.some((s) => s.kind === 'Собран war room');

  /** Категория проблемы = категория выбранного типа; она делит зоны ответственности. */
  const category = typeRows.find((r) => r.name === type)?.category ?? null;
  const zoneOptions = category
    ? zoneRows.filter((z) => z.category === category).map((z) => z.name)
    : [];

  /** Смена типа меняет категорию — снимаем отметки с зон, которые к ней уже не относятся. */
  const changeType = (next: string) => {
    setType(next);
    const nextCategory = typeRows.find((r) => r.name === next)?.category ?? null;
    const allowed = new Set(zoneRows.filter((z) => z.category === nextCategory).map((z) => z.name));
    setZoneChecks((cur) => Object.fromEntries(Object.entries(cur).filter(([z]) => allowed.has(z))));
  };

  /** «Сайт» / «МП» и «Не было влияния» — взаимоисключающие. */
  const toggleImpactTarget = (target: ImpactTarget, on: boolean) => {
    setImpactNone(false);
    setImpactTargets((cur) => (on ? [...cur, target] : cur.filter((x) => x !== target)));
  };
  const toggleImpactNone = (on: boolean) => {
    setImpactNone(on);
    if (on) setImpactTargets([]);
  };

  /** Дата завершения задаёт время и для шага «Решена» в хронологии. */
  const updateResolvedAt = (value: string) => {
    setResolvedAtInput(value);
    const time = value.split('T')[1] ?? '';
    setSteps((s) => s.map((x) => (x.kind === 'Решена' ? { ...x, time } : x)));
  };

  const addEscalation = () =>
    setEscalations((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        time: '',
        calleeName: '',
        kind: 'Ответственный',
        channel: 'Телефон',
        result: 'Дозвонился',
        attempts: 1,
      },
    ]);
  const removeEscalation = (id: string) =>
    setEscalations((list) => {
      const item = list.find((x) => x.id === id);
      if (item && (item.time || item.calleeName) && !window.confirm('Удалить эту попытку эскалации?')) return list;
      return list.filter((x) => x.id !== id);
    });
  const updateEscalation = (id: string, patch: Partial<EscalationAttempt>) =>
    setEscalations((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (asDraft = false) => {
    // Сохраняем только видимые (подходящие категории) отмеченные зоны.
    const activeZones = zoneOptions.filter((z) => zoneChecks[z]);

    if (
      !title.trim() ||
      activeServices.length === 0 ||
      !type ||
      !criticality ||
      !startedAtInput ||
      !onDutyUserId
    ) {
      setError('Заполните обязательные поля: название, сервис, тип, критичность, дата начала, дежурный.');
      return;
    }
    if (!asDraft) {
      if (!cause.trim()) {
        setError('Для публикации укажите причину инцидента.');
        return;
      }
      if (
        !resolvedAtInput ||
        activeZones.length === 0 ||
        !impact.trim() ||
        (!impactNone && impactTargets.length === 0)
      ) {
        setError(
          'Для публикации заполните: дату завершения, зону ответственности, описание влияния и влияние на сайт/МП.',
        );
        return;
      }
    }

    const startedAt = fromInputDT(startedAtInput);
    const detectStep = steps.find((s) => s.kind === 'Обнаружено');
    const detectedAt = withTime(startedAt, detectStep?.time || startedAt.split(' ')[1]);
    // Конец инцидента — только из поля «Дата и время завершения» (шаг «Решена» его зеркалит).
    const resolvedAt = resolvedAtInput ? fromInputDT(resolvedAtInput) : null;

    const draft: IncidentDraft = {
      title: title.trim(),
      status: asDraft ? 'draft' : 'published',
      services: activeServices,
      type,
      criticality,
      onDutyUserId: onDutyUserId || null,
      startedAt,
      detectedAt,
      resolvedAt,
      stub: stub ? { on: stubOn, off: stubOff || null } : null,
      cause: cause.trim(),
      impact: impact.trim(),
      impactTargets: impactNone ? [] : impactTargets.length ? impactTargets : null,
      taskLink: taskLink.trim(),
      zones: activeZones,
      timeline: steps,
      escalations,
    };

    setError(null);
    try {
      const saved = initial ? await updateIncident(initial.id, draft) : await addIncident(draft);
      dirtyRef.current = false;
      onSaved(saved.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить инцидент. Проверьте соединение с сервером.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-gray-50">
            {initial ? 'Редактирование инцидента' : 'Новый инцидент'}
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-500">
            {initial ? initial.id : 'Заполните информацию об инциденте и постмортем'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="flex items-center gap-1.5 text-xs text-crit">
              <AlertCircle size={13} />
              {error}
            </span>
          )}
          {onCancel && (
            <Button icon={<X size={14} />} onClick={() => confirmDiscard() && onCancel()}>
              Отмена
            </Button>
          )}
          {!initial && (
            <Button icon={<Save size={14} />} onClick={() => save(true)}>
              Сохранить черновик
            </Button>
          )}
          <Button variant="primary" icon={<Upload size={14} />} onClick={() => save(false)}>
            {initial ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* left / main: хронология истории инцидента */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Общая информация" />
            <div className="grid grid-cols-1 gap-4 p-5 pt-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Название инцидента" required>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Краткое описание инцидента"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Дежурный" required>
                  <Select
                    value={onDutyUserId}
                    onChange={(e) => setOnDutyUserId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="" disabled>
                      Выберите дежурного
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Дата и время начала" required>
                <Input
                  type="datetime-local"
                  value={startedAtInput}
                  onChange={(e) => setStartedAtInput(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-gray-600">Первый шаг в хронологии — «Начало инцидента»</p>
              </Field>
              <Field label="Дата и время завершения">
                <Input
                  type="datetime-local"
                  value={resolvedAtInput}
                  onChange={(e) => updateResolvedAt(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-gray-600">Задаёт время шага «Решена» в хронологии</p>
              </Field>
            </div>
          </Card>

          {/* timeline */}
          <Card>
            <CardHeader
              title="Хронология (что сделано)"
              subtitle="Первый и последний шаги — начало и решение инцидента, их время берётся из дат выше. Промежуточные шаги можно двигать стрелками."
            />
            <div className="p-5 pt-2">
              <div className="mb-4 space-y-1 border-b border-white/[0.06] pb-3">
                <Checkbox
                  label="Была отправлена рассылка/информирование"
                  checked={notified}
                  onChange={(v) => toggleFixedStep('Информирование', v)}
                />
                <Checkbox
                  label="Был собран war room (телемост)"
                  checked={warRoomCreated}
                  onChange={(v) => toggleFixedStep('Собран war room', v)}
                />
              </div>

              <ol className="relative space-y-3 border-l border-white/10 pl-6">
                {/* Начало инцидента — служебный шаг, время из поля «Дата и время начала». Не сохраняется. */}
                <li className="relative">
                  <span className="absolute -left-[31px] top-3 h-2.5 w-2.5 rounded-full bg-blue-400 ring-4 ring-bg" />
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="time"
                        value={startedAtInput.split('T')[1] ?? ''}
                        readOnly
                        tabIndex={-1}
                        title="Меняется в поле «Дата и время начала»"
                        className="w-[88px] flex-none cursor-not-allowed rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-gray-500 outline-none"
                      />
                      <span className="flex items-center gap-1.5 text-[13px] text-gray-300">
                        Начало инцидента
                        <Lock size={11} className="text-gray-600" />
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-600">Время — из поля «Дата и время начала» наверху</p>
                  </div>
                </li>

                {steps.map((s, idx) => {
                  const locked = s.kind === 'Решена';
                  return (
                    <li key={s.id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[31px] top-2.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg',
                          s.custom ? 'bg-gray-600' : KIND_COLOR[s.kind],
                        )}
                      />
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3">
                        <div className="grid grid-cols-[16px_100px_1fr_auto] items-start gap-2">
                          <div className="mt-1 flex flex-none flex-col text-gray-700">
                            {!locked && (
                              <>
                                <button
                                  onClick={() => moveStep(s.id, -1)}
                                  disabled={idx === 0}
                                  title="Переместить выше"
                                  className="hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-20"
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <button
                                  onClick={() => moveStep(s.id, 1)}
                                  disabled={idx === steps.length - 1}
                                  title="Переместить ниже"
                                  className="hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-20"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </>
                            )}
                          </div>
                          {locked ? (
                            <input
                              type="time"
                              value={resolvedAtInput.split('T')[1] ?? ''}
                              readOnly
                              tabIndex={-1}
                              title="Меняется в поле «Дата и время завершения»"
                              className="w-full cursor-not-allowed rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-gray-500 outline-none"
                            />
                          ) : (
                            <input
                              type="time"
                              value={s.time}
                              onChange={(e) => updateStep(s.id, { time: e.target.value })}
                              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-neon outline-none focus:border-neon/60"
                            />
                          )}
                          <AutoTextarea
                            value={s.action}
                            onChange={(e) => updateStep(s.id, { action: e.target.value })}
                            placeholder="Что было проделано"
                            className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[13px] leading-snug text-gray-200 outline-none focus:border-neon/60"
                          />
                          {locked ? (
                            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center text-gray-700">
                              <Lock size={13} />
                            </span>
                          ) : (
                            <button
                              onClick={() => removeStep(s.id)}
                              className="flex h-[34px] items-center justify-center rounded-md border border-white/[0.08] px-2 text-gray-600 transition-colors hover:border-crit/40 hover:text-crit"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {locked ? (
                          <p className="mt-2 pl-6 text-[11px] text-gray-600">
                            Время — из поля «Дата и время завершения» наверху
                          </p>
                        ) : s.custom ? (
                          <p className="mt-2 pl-6 font-mono text-[11px] text-gray-600">— промежуточный шаг</p>
                        ) : (
                          <div className="mt-2 ml-6 w-[calc(100%-1.5rem)]">
                            <Select
                              value={s.kind}
                              onChange={(e) => updateStep(s.id, { kind: e.target.value as TimelineKind })}
                              className="py-1.5 text-xs"
                            >
                              {TIMELINE_KINDS.map((k) => (
                                <option key={k}>{k}</option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <button
                onClick={addStep}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-2 text-[13px] text-gray-500 transition-colors hover:border-neon/40 hover:text-neon"
              >
                <Plus size={14} />
                Добавить шаг
              </button>
            </div>
          </Card>

          {/* escalations */}
          <Card>
            <CardHeader
              title="Эскалации"
              subtitle={
                escalations.length > 0
                  ? `Количество звонков: ${escalations.reduce((sum, e) => sum + (e.attempts || 1), 0)}`
                  : 'Попытки связаться с ответственными по инциденту'
              }
            />
            <div className="space-y-2 p-5 pt-2">
              {escalations.map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 sm:grid-cols-[90px_1fr_1fr_1fr_1fr_110px_auto] sm:items-center"
                >
                  <input
                    type="time"
                    value={e.time}
                    onChange={(ev) => updateEscalation(e.id, { time: ev.target.value })}
                    className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-neon outline-none focus:border-neon/60"
                  />
                  <Input
                    value={e.calleeName}
                    onChange={(ev) => updateEscalation(e.id, { calleeName: ev.target.value })}
                    placeholder="Кому звонили"
                    className="py-1.5"
                  />
                  <Select
                    value={e.channel}
                    onChange={(ev) => updateEscalation(e.id, { channel: ev.target.value as EscalationAttempt['channel'] })}
                    className="py-1.5 text-xs"
                  >
                    {COMMUNICATION_CHANNELS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                  <Select
                    value={e.kind}
                    onChange={(ev) => updateEscalation(e.id, { kind: ev.target.value as EscalationAttempt['kind'] })}
                    className="py-1.5 text-xs"
                  >
                    {ESCALATION_KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </Select>
                  <Select
                    value={e.result}
                    onChange={(ev) => updateEscalation(e.id, { result: ev.target.value as EscalationAttempt['result'] })}
                    className="py-1.5 text-xs"
                  >
                    {ESCALATION_RESULTS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                  <div
                    className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-1.5 py-1"
                    title="Количество попыток дозвона"
                  >
                    <button
                      onClick={() => updateEscalation(e.id, { attempts: Math.max(1, e.attempts - 1) })}
                      className="flex h-5 w-5 items-center justify-center text-gray-500 hover:text-gray-200"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={e.attempts}
                      onChange={(ev) => updateEscalation(e.id, { attempts: Math.max(1, Number(ev.target.value) || 1) })}
                      className="w-8 flex-1 bg-transparent text-center font-mono text-xs text-gray-200 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => updateEscalation(e.id, { attempts: e.attempts + 1 })}
                      className="flex h-5 w-5 items-center justify-center text-gray-500 hover:text-gray-200"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeEscalation(e.id)}
                    className="flex h-[34px] items-center justify-center rounded-md border border-white/[0.08] px-2 text-gray-600 transition-colors hover:border-crit/40 hover:text-crit"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {escalations.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-gray-600">
                  Пока нет попыток эскалации
                </p>
              )}
              <button
                onClick={addEscalation}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-2 text-[13px] text-gray-500 transition-colors hover:border-neon/40 hover:text-neon"
              >
                <Plus size={14} />
                Добавить попытку
              </button>
            </div>
          </Card>

          {/* postmortem */}
          <Card>
            <CardHeader title="Итоговая информация" subtitle="Причина, влияние на пользователей и ссылка на задачу" />
            <div className="grid grid-cols-1 gap-4 p-5 pt-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Влияние на сайт / МП" required>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-1">
                    {IMPACT_TARGETS.map((t) => (
                      <Checkbox
                        key={t}
                        label={IMPACT_TARGET_LABELS[t]}
                        checked={impactTargets.includes(t)}
                        onChange={(v) => toggleImpactTarget(t, v)}
                      />
                    ))}
                    <Checkbox label="Не было влияния" checked={impactNone} onChange={toggleImpactNone} />
                  </div>
                </Field>
              </div>
              <Field label="Причина инцидента" required>
                <Textarea
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="Опишите первопричину инцидента..."
                />
              </Field>
              <Field label="Описание влияния" required>
                <Textarea
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  placeholder="Как инцидент повлиял на пользователей и бизнес..."
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Ссылка на задачу">
                  <div className="relative">
                    <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <Input
                      value={taskLink}
                      onChange={(e) => setTaskLink(e.target.value)}
                      placeholder="https://tracker.example.com/INC-2026-00024"
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* right panel: классификация инцидента */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Тип и критичность" />
            <div className="space-y-3 p-4 pt-1">
              <Field label="Тип (категория проблемы)" required>
                <Select value={type} onChange={(e) => changeType(e.target.value)}>
                  <option value="" disabled>
                    Выберите тип
                  </option>
                  {typeRows.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Критичность" required>
                <Select value={criticality} onChange={(e) => setCriticality(e.target.value)}>
                  <option value="" disabled>
                    Выберите критичность
                  </option>
                  {criticalities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {/* заглушка — временное решение, применённое по ходу инцидента */}
          <Card>
            <CardHeader title="Заглушка" />
            <div className="p-4 pt-1">
              <Checkbox label="Установлена заглушка" checked={stub} onChange={setStub} />
              {stub && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Установлена в">
                    <Input type="time" value={stubOn} onChange={(e) => setStubOn(e.target.value)} />
                  </Field>
                  <Field label="Снята в">
                    <Input type="time" value={stubOff} onChange={(e) => setStubOff(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Затронутые сервисы" subtitle="Можно выбрать несколько" />
            <div className="p-4 pt-1">
              <MultiSelect
                options={serviceOptions}
                selected={activeServices}
                onChange={setActiveServices}
                placeholder="Выберите сервисы"
                searchPlaceholder="Поиск сервиса..."
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Зона ответственности" subtitle="Зависит от типа проблемы" />
            <div className="p-4 pt-1">
              {!type && <p className="text-xs text-gray-600">Сначала выберите тип проблемы</p>}
              {type && zoneOptions.length === 0 && (
                <p className="text-xs text-gray-600">Для этой категории нет зон — добавьте их в администрировании</p>
              )}
              {zoneOptions.map((z) => (
                <Checkbox
                  key={z}
                  label={z}
                  checked={zoneChecks[z] ?? false}
                  onChange={(v) => setZoneChecks((s) => ({ ...s, [z]: v }))}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
