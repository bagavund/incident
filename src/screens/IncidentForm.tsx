import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Link2, Minus, Plus, Save, Trash2, Upload, User, X } from 'lucide-react';
import {
  computeSla,
  defaultStartInput,
  emptyTimeline,
  fromInputDT,
  nextIncidentCode,
  toInputDT,
  validateTimelineOrder,
  withTime,
} from '../data';
import { ApiError } from '../lib/api';
import { setNavigationGuard } from '../router';
import { useStore } from '../store';
import {
  COMMUNICATION_CHANNELS,
  ESCALATION_KINDS,
  ESCALATION_RESULTS,
  TIMELINE_KINDS,
  type EscalationAttempt,
  type FullIncident,
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
  const { incidents, addIncident, updateIncident, services: serviceOptions, zones: zoneOptions, incidentTypes, criticalities } = useStore();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [criticality, setCriticality] = useState(initial?.criticality ?? '');
  const [activeServices, setActiveServices] = useState<string[]>(initial?.services ?? []);
  const [onDutyName, setOnDutyName] = useState(initial?.onDutyName ?? '');
  const [startedAtInput, setStartedAtInput] = useState(
    initial ? toInputDT(initial.startedAt) : defaultStartInput(),
  );
  const [resolvedAtInput, setResolvedAtInput] = useState(initial?.resolvedAt ? toInputDT(initial.resolvedAt) : '');
  const [stub, setStub] = useState(!!initial?.stub);
  const [stubOn, setStubOn] = useState(initial?.stub?.on ?? '');
  const [stubOff, setStubOff] = useState(initial?.stub?.off === '—' ? '' : initial?.stub?.off ?? '');
  const [zoneChecks, setZoneChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((initial?.zones ?? []).map((z) => [z, true])),
  );
  const [steps, setSteps] = useState<TimelineStep[]>(initial?.timeline ?? emptyTimeline());
  const [escalations, setEscalations] = useState<EscalationAttempt[]>(initial?.escalations ?? []);
  const [cause, setCause] = useState(initial?.cause ?? '');
  const [impact, setImpact] = useState(initial?.impact ?? '');
  const [taskLink, setTaskLink] = useState(initial?.taskLink ?? '');
  const [error, setError] = useState<string | null>(null);

  /** Ref, а не state: должен читаться синхронно из save() в тот же тик, что и сброс перед навигацией. */
  const dirtyRef = useRef(false);

  /**
   * Снимок значений на момент монтирования. Сравнение с ним (а не счётчик запусков эффекта)
   * не ломается от двойного вызова эффектов в React.StrictMode в dev-режиме.
   */
  const baselineRef = useRef({
    title, type, criticality, activeServices, onDutyName, startedAtInput, resolvedAtInput,
    stub, stubOn, stubOff, zoneChecks, steps, escalations, cause, impact, taskLink,
  });
  useEffect(() => {
    const b = baselineRef.current;
    dirtyRef.current =
      title !== b.title || type !== b.type || criticality !== b.criticality ||
      activeServices !== b.activeServices || onDutyName !== b.onDutyName ||
      startedAtInput !== b.startedAtInput || resolvedAtInput !== b.resolvedAtInput ||
      stub !== b.stub || stubOn !== b.stubOn || stubOff !== b.stubOff ||
      zoneChecks !== b.zoneChecks || steps !== b.steps || escalations !== b.escalations ||
      cause !== b.cause || impact !== b.impact || taskLink !== b.taskLink;
  }, [
    title, type, criticality, activeServices, onDutyName, startedAtInput, resolvedAtInput,
    stub, stubOn, stubOff, zoneChecks, steps, escalations, cause, impact, taskLink,
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
      if (step && (step.time || step.action) && !window.confirm('Удалить этот шаг хронологии?')) return s;
      return s.filter((x) => x.id !== id);
    });

  const updateStep = (id: string, patch: Partial<TimelineStep>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps((list) => {
      const idx = list.findIndex((x) => x.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= list.length) return list;
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
    if (
      !title.trim() ||
      activeServices.length === 0 ||
      !type ||
      !criticality ||
      !startedAtInput ||
      !onDutyName.trim()
    ) {
      setError('Заполните обязательные поля: название, сервис, тип, критичность, дата начала, дежурный.');
      return;
    }
    if (!asDraft && !cause.trim()) {
      setError('Для публикации укажите причину инцидента.');
      return;
    }

    const timelineError = validateTimelineOrder(steps);
    if (timelineError) {
      setError(timelineError);
      return;
    }

    const startedAt = fromInputDT(startedAtInput);
    const detectStep = steps.find((s) => s.kind === 'Обнаружено');
    const detectedAt = withTime(startedAt, detectStep?.time || startedAt.split(' ')[1]);
    const resolvedStep = steps.find((s) => s.kind === 'Решена');
    const resolvedAt = resolvedAtInput
      ? fromInputDT(resolvedAtInput)
      : resolvedStep?.time
        ? withTime(startedAt, resolvedStep.time)
        : null;

    const activeZones = Object.keys(zoneChecks).filter((z) => zoneChecks[z]);

    const draft: FullIncident = {
      id: initial?.id ?? nextIncidentCode(incidents),
      title: title.trim(),
      status: asDraft ? 'draft' : 'published',
      services: activeServices,
      type,
      criticality,
      sla: computeSla(criticality, startedAt, resolvedAt),
      onDutyName: onDutyName.trim(),
      createdAt: initial?.createdAt ?? detectedAt,
      startedAt,
      detectedAt,
      resolvedAt,
      stub: stub ? { on: stubOn, off: stubOff || '—' } : null,
      cause: cause.trim(),
      impact: impact.trim(),
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
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <Input
                      value={onDutyName}
                      onChange={(e) => setOnDutyName(e.target.value)}
                      placeholder="Фамилия Имя"
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>
              <Field label="Дата и время начала" required>
                <Input
                  type="datetime-local"
                  value={startedAtInput}
                  onChange={(e) => setStartedAtInput(e.target.value)}
                />
              </Field>
              <Field label="Дата и время завершения">
                <Input
                  type="datetime-local"
                  value={resolvedAtInput}
                  onChange={(e) => updateResolvedAt(e.target.value)}
                />
              </Field>
            </div>
          </Card>

          {/* timeline */}
          <Card>
            <CardHeader
              title="Хронология (что сделано)"
              subtitle="Обнаружено · диагностика · передана ответственным · решена — порядок шагов можно менять стрелками"
            />
            <div className="p-5 pt-2">
              <ol className="relative space-y-3 border-l border-neon/30 pl-6">
                {steps.map((s, idx) => (
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
                        </div>
                        <input
                          type="time"
                          value={s.time}
                          onChange={(e) => updateStep(s.id, { time: e.target.value })}
                          className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-neon outline-none focus:border-neon/60"
                        />
                        <AutoTextarea
                          value={s.action}
                          onChange={(e) => updateStep(s.id, { action: e.target.value })}
                          placeholder="Что было проделано"
                          className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[13px] leading-snug text-gray-200 outline-none focus:border-neon/60"
                        />
                        <button
                          onClick={() => removeStep(s.id)}
                          className="flex h-[34px] items-center justify-center rounded-md border border-white/[0.08] px-2 text-gray-600 transition-colors hover:border-crit/40 hover:text-crit"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {s.custom ? (
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
                ))}
              </ol>

              <button
                onClick={addStep}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-2 text-[13px] text-gray-500 transition-colors hover:border-neon/40 hover:text-neon"
              >
                <Plus size={14} />
                Добавить шаг
              </button>

              <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-3">
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
              <Field label="Причина инцидента" required>
                <Textarea
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  placeholder="Опишите первопричину инцидента..."
                />
              </Field>
              <Field label="Описание влияния">
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
              <Field label="Тип" required>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="" disabled>
                    Выберите тип
                  </option>
                  {incidentTypes.map((t) => (
                    <option key={t}>{t}</option>
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
            <CardHeader title="Зона ответственности" />
            <div className="p-4 pt-1">
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
