import { useState } from 'react';
import { Check, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import { Button, Card, CardHeader, Input } from '../components/ui';

export function Admin() {
  const {
    services, addService, renameService, removeService,
    zones, addZone, renameZone, removeZone,
    incidentTypes, addIncidentType, renameIncidentType, removeIncidentType,
    criticalities, addCriticality, renameCriticality, removeCriticality,
    incidents,
  } = useStore();

  const usageCounts = {
    services: (name: string) => incidents.filter((i) => i.services.includes(name)).length,
    zones: (name: string) => incidents.filter((i) => i.zones.includes(name)).length,
    incidentTypes: (name: string) => incidents.filter((i) => i.type === name).length,
    criticalities: (name: string) => incidents.filter((i) => i.criticality === name).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-gray-50">Администрирование</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">
          Справочники системы: сервисы, зоны ответственности, типы и критичность инцидентов
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-med/20 bg-med/[0.06] px-4 py-3 text-[13px] text-med">
        <ShieldAlert size={16} className="mt-0.5 flex-none" />
        <p>
          Раздел временно открыт всем — доступ будет ограничен ролью «Администратор» после подключения
          внутреннего сервиса единой авторизации (проверка группы AD).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EditableList
          title="Сервисы"
          subtitle="Доступны при создании инцидента"
          items={services}
          onAdd={addService}
          onRename={renameService}
          onRemove={removeService}
          usageCount={usageCounts.services}
        />
        <EditableList
          title="Зоны ответственности"
          subtitle="Чекбоксы в карточке инцидента"
          items={zones}
          onAdd={addZone}
          onRename={renameZone}
          onRemove={removeZone}
          usageCount={usageCounts.zones}
        />
        <EditableList
          title="Типы инцидентов"
          subtitle="Выбор при создании инцидента"
          items={incidentTypes}
          onAdd={addIncidentType}
          onRename={renameIncidentType}
          onRemove={removeIncidentType}
          usageCount={usageCounts.incidentTypes}
        />
        <EditableList
          title="Критичность инцидента"
          subtitle="Проставляет дежурный при создании"
          items={criticalities}
          onAdd={addCriticality}
          onRename={renameCriticality}
          onRemove={removeCriticality}
          usageCount={usageCounts.criticalities}
        />
      </div>
    </div>
  );
}

function EditableList({
  title,
  subtitle,
  items,
  onAdd,
  onRename,
  onRemove,
  usageCount,
}: {
  title: string;
  subtitle: string;
  items: string[];
  onAdd: (name: string) => void;
  onRename: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  /** Сколько инцидентов ссылаются на это значение — блокирует удаление, если > 0. */
  usageCount: (name: string) => number;
}) {
  const [draft, setDraft] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    onAdd(name);
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
    if (name) onRename(editingIdx, name);
    setEditingIdx(null);
  };

  const remove = (idx: number) => {
    const name = items[idx];
    const count = usageCount(name);
    if (count > 0) {
      setError(`«${name}» используется в ${count} инцидент(ах) — удаление недоступно.`);
      return;
    }
    setError(null);
    onRemove(idx);
  };

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-1 px-3 pb-3 pt-1">
        {items.map((item, idx) => (
          <div
            key={idx}
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
                <span className="flex-1 text-gray-300">{item}</span>
                <button onClick={() => startEdit(idx, item)} className="text-gray-600 hover:text-gray-300">
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
