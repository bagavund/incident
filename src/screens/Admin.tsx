import { useEffect, useState } from 'react';
import { Check, Clock, Pencil, Plus, ShieldAlert, Trash2, UserPlus, X } from 'lucide-react';
import { ApiError } from '../lib/api';
import { useStore, type LookupApi, type LookupKey, type NewUser } from '../store';
import { PROBLEM_CATEGORY_LABELS, type ProblemCategory, type UserRole } from '../types';
import { Button, Card, CardHeader, Field, Input, Select } from '../components/ui';

const SECTIONS: { key: LookupKey; title: string; subtitle: string }[] = [
  { key: 'services', title: 'Сервисы', subtitle: 'Доступны при создании инцидента' },
  { key: 'criticalities', title: 'Критичность инцидента', subtitle: 'Проставляет дежурный при создании' },
];

const CATEGORY_ENTRIES = Object.entries(PROBLEM_CATEGORY_LABELS) as [ProblemCategory, string][];

export function Admin() {
  const { lookups } = useStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-gray-50">Администрирование</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Справочники системы и настройка SLA
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-med/20 bg-med/[0.06] px-4 py-3 text-[13px] text-med">
        <ShieldAlert size={16} className="mt-0.5 flex-none" />
        <p>
          Переименование значения автоматически переносит на новое название все инциденты, которые на него
          ссылаются. Удалить можно только неиспользуемое значение.
        </p>
      </div>

      <SlaSettingCard />

      <UsersCard />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map(({ key, title, subtitle }) => (
          <EditableList key={key} title={title} subtitle={subtitle} lookup={lookups[key]} />
        ))}
        <CategorizedList
          title="Типы инцидентов"
          subtitle="Значение = категория проблемы"
          lookup={lookups.incidentTypes}
        />
        <CategorizedList
          title="Зоны ответственности"
          subtitle="Показываются в форме под свою категорию"
          lookup={lookups.zones}
        />
      </div>
    </div>
  );
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'on_duty', label: 'Дежурный' },
  { value: 'admin', label: 'Администратор' },
];

const EMPTY_NEW_USER: NewUser = {
  name: '',
  username: '',
  password: '',
  passwordConfirmation: '',
  position: '',
  role: 'on_duty',
};

/**
 * Учётки заводит только администратор — самостоятельной регистрации нет.
 * Логин короткий (`vkomlev`), не email.
 */
function UsersCard() {
  const { users, addUser } = useStore();
  const [draft, setDraft] = useState<NewUser>(EMPTY_NEW_USER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.name.trim() || !draft.username.trim() || !draft.password) {
      setError('Заполните имя, логин и пароль.');
      return;
    }
    if (draft.password !== draft.passwordConfirmation) {
      setError('Пароли не совпадают.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addUser(draft);
      setDraft(EMPTY_NEW_USER);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать пользователя. Проверьте соединение.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Пользователи" subtitle="Учётки заводит администратор — логин, а не email" />
      <div className="space-y-1 px-3 pb-1 pt-1">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]">
            <span className="flex-1 text-gray-300">{u.name}</span>
            <span className="font-mono text-xs text-gray-500">{u.username}</span>
            <span className="text-xs text-gray-600">{u.role_label}</span>
          </div>
        ))}
        {users.length === 0 && <p className="px-2 py-2 text-xs text-gray-600">Список пуст</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-white/[0.06] p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Имя">
          <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Комлев Виктор" />
        </Field>
        <Field label="Логин">
          <Input value={draft.username} onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))} placeholder="vkomlev" />
        </Field>
        <Field label="Пароль">
          <Input type="password" value={draft.password} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} />
        </Field>
        <Field label="Повтор пароля">
          <Input
            type="password"
            value={draft.passwordConfirmation}
            onChange={(e) => setDraft((d) => ({ ...d, passwordConfirmation: e.target.value }))}
          />
        </Field>
        <Field label="Роль">
          <Select value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as UserRole }))}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex items-center gap-3 px-4 pb-4">
        <Button variant="primary" icon={<UserPlus size={14} />} disabled={saving} onClick={submit}>
          {saving ? 'Создание…' : 'Добавить пользователя'}
        </Button>
        {error && <p className="text-xs text-crit">{error}</p>}
      </div>
    </Card>
  );
}

/**
 * SLA в системе — это одно общее время реакции: от обнаружения до передачи
 * ответственным (эскалации). Порог не привязан к критичности, меняется тут
 * и сразу пересчитывается для всех инцидентов на сервере.
 */
function SlaSettingCard() {
  const { slaEscalationMinutes, updateSlaEscalationMinutes } = useStore();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slaEscalationMinutes != null) setDraft(String(slaEscalationMinutes));
  }, [slaEscalationMinutes]);

  const dirty = slaEscalationMinutes != null && draft.trim() !== String(slaEscalationMinutes);

  const save = async () => {
    const minutes = Number(draft);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError('Введите целое число минут больше нуля.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateSlaEscalationMinutes(Math.round(minutes));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить порог. Проверьте соединение.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="SLA: время на эскалацию"
        subtitle="От обнаружения до передачи ответственным. Общий порог для всех инцидентов."
      />
      <div className="flex items-center gap-2 px-5 pb-5 pt-1">
        <div className="relative">
          <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <Input
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dirty && save()}
            placeholder="Минуты"
            className="w-32 pl-8 font-mono"
          />
        </div>
        <span className="text-xs text-gray-500">минут</span>
        <Button variant="primary" disabled={!dirty || saving} onClick={save} className="ml-2">
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>
      {error && <p className="px-5 pb-4 -mt-2 text-xs text-crit">{error}</p>}
    </Card>
  );
}

function EditableList({ title, subtitle, lookup }: { title: string; subtitle: string; lookup: LookupApi }) {
  const items = lookup.rows;
  const [draft, setDraft] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Сообщение об отказе берём с сервера: он один знает про коллизии и usage_count. */
  const run = (action: Promise<void>) => {
    setError(null);
    action.catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить изменение. Проверьте соединение.'),
    );
  };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    run(lookup.add(name));
    setDraft('');
  };

  const startEdit = (idx: number, current: string) => {
    setError(null);
    setEditingIdx(idx);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const name = editValue.trim();
    if (name) run(lookup.rename(editingIdx, name));
    setEditingIdx(null);
  };

  const remove = (idx: number) => run(lookup.remove(idx));

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-1 px-3 pb-3 pt-1">
        {items.map((row, idx) => (
          <div
            key={row.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.02]"
          >
            {editingIdx === idx ? (
              <>
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                  className="py-1"
                />
                <button onClick={commitEdit} className="text-neon hover:text-neon/80">
                  <Check size={15} />
                </button>
                <button onClick={() => setEditingIdx(null)} className="text-gray-500 hover:text-gray-300">
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-300">{row.name}</span>
                <span className="font-mono text-[11px] text-gray-600" title="Инцидентов со значением">
                  {row.usage_count}
                </span>
                <button onClick={() => startEdit(idx, row.name)} className="text-gray-600 hover:text-gray-300">
                  <Pencil size={13} />
                </button>
                <button onClick={() => remove(idx)} className="text-gray-600 hover:text-crit">
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="px-2 py-2 text-xs text-gray-600">Список пуст</p>}
        {error && <p className="px-2 pt-1 text-xs text-crit">{error}</p>}

        <div className="flex items-center gap-2 pt-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Новое значение"
          />
          <Button variant="outline" icon={<Plus size={14} />} onClick={add}>
            Добавить
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Справочник с категорией (типы инцидентов, зоны): как EditableList, но список
 * сгруппирован по категории проблемы, а при добавлении выбирается категория.
 */
function CategorizedList({ title, subtitle, lookup }: { title: string; subtitle: string; lookup: LookupApi }) {
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState<ProblemCategory>('internal');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (action: Promise<void>) => {
    setError(null);
    action.catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить изменение. Проверьте соединение.'),
    );
  };

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    run(lookup.add(name, draftCategory));
    setDraft('');
  };

  const startEdit = (idx: number, current: string) => {
    setError(null);
    setEditingIdx(idx);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const name = editValue.trim();
    if (name) run(lookup.rename(editingIdx, name));
    setEditingIdx(null);
  };

  const indexed = lookup.rows.map((row, idx) => ({ row, idx }));

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-3 px-3 pb-3 pt-1">
        {CATEGORY_ENTRIES.map(([cat, label]) => {
          const rows = indexed.filter(({ row }) => (row.category ?? 'internal') === cat);
          return (
            <div key={cat}>
              <p className="px-2 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">{label}</p>
              {rows.length === 0 && <p className="px-2 py-1 text-xs text-gray-700">Нет типов</p>}
              {rows.map(({ row, idx }) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.02]"
                >
                  {editingIdx === idx ? (
                    <>
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                        className="py-1"
                      />
                      <button onClick={commitEdit} className="text-neon hover:text-neon/80">
                        <Check size={15} />
                      </button>
                      <button onClick={() => setEditingIdx(null)} className="text-gray-500 hover:text-gray-300">
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-gray-300">{row.name}</span>
                      <span className="font-mono text-[11px] text-gray-600" title="Инцидентов со значением">
                        {row.usage_count}
                      </span>
                      <button onClick={() => startEdit(idx, row.name)} className="text-gray-600 hover:text-gray-300">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => run(lookup.remove(idx))} className="text-gray-600 hover:text-crit">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        {error && <p className="px-2 pt-1 text-xs text-crit">{error}</p>}

        <div className="space-y-2 pt-2">
          <Select value={draftCategory} onChange={(e) => setDraftCategory(e.target.value as ProblemCategory)}>
            {CATEGORY_ENTRIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Новый тип"
            />
            <Button variant="outline" icon={<Plus size={14} />} onClick={add}>
              Добавить
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
