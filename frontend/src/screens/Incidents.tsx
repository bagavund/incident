import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, RotateCcw, Search } from 'lucide-react';
import { HEATMAP_DAYS, parseDT } from '../data';
import { useAuth } from '../auth';
import { useStore } from '../store';
import type { FullIncident, IncidentFilters, Screen, SlaState } from '../types';
import { Badge, Button, Card, cn, Input, Select, SlaBadge } from '../components/ui';

const SLAS: SlaState[] = ['Соблюден', 'Нарушен'];

const EMPTY: IncidentFilters = { q: '', service: '', type: '', sla: '', zone: '', from: '', to: '' };

export function Incidents({
  incidents,
  initialFilter,
  onNavigate,
  onOpen,
}: {
  incidents: FullIncident[];
  initialFilter?: Partial<IncidentFilters> | null;
  onNavigate: (s: Screen) => void;
  onOpen: (id: string) => void;
}) {
  const { services, incidentTypes, zones: zoneOptions } = useStore();
  const { isViewer } = useAuth();
  const [f, setF] = useState<IncidentFilters>(() => ({ ...EMPTY, ...initialFilter }));
  const set = (patch: Partial<IncidentFilters>) => setF((s) => ({ ...s, ...patch }));

  // Клик по дашборду передаёт новый набор фильтров — подхватываем его.
  useEffect(() => {
    if (initialFilter) setF({ ...EMPTY, ...initialFilter });
  }, [initialFilter]);

  const dirty =
    f.q || f.service || f.type || f.sla || f.zone || f.from || f.to || f.weekday !== undefined || f.hourStart !== undefined;

  const rows = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const from = f.from ? new Date(`${f.from}T00:00`) : null;
    const to = f.to ? new Date(`${f.to}T23:59`) : null;

    return incidents.filter((i) => {
      if (needle && !`${i.id} ${i.title} ${i.services.join(' ')} ${i.cause} ${i.onDuty?.name ?? ''}`.toLowerCase().includes(needle)) return false;
      if (f.service && !i.services.includes(f.service)) return false;
      if (f.type && i.type !== f.type) return false;
      if (f.sla && i.sla !== f.sla) return false;
      if (f.zone && !i.zones.includes(f.zone)) return false;
      if (from || to) {
        const at = parseDT(i.createdAt);
        if (from && at < from) return false;
        if (to && at > to) return false;
      }
      if (f.weekday !== undefined) {
        const day = (parseDT(i.detectedAt).getDay() + 6) % 7;
        if (day !== f.weekday) return false;
      }
      if (f.hourStart !== undefined && f.hourEnd !== undefined) {
        const h = parseDT(i.detectedAt).getHours();
        if (h < f.hourStart || h >= f.hourEnd) return false;
      }
      return true;
    });
  }, [incidents, f]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-50">Инциденты</h1>
          <p className="mt-1 text-sm text-gray-500">Список всех инцидентов</p>
        </div>
        {!isViewer && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => onNavigate('create')}>
            Создать инцидент
          </Button>
        )}
      </div>

      <Card>
        {/* filters */}
        <div className="space-y-3 border-b border-white/[0.06] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <Input
                value={f.q}
                onChange={(e) => set({ q: e.target.value })}
                placeholder="Поиск по ID, названию, сервису, причине, дежурному..."
                className="pl-9"
              />
            </div>
            {dirty && (
              <Button icon={<RotateCcw size={14} />} onClick={() => setF(EMPTY)}>
                Сбросить
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={f.service} onChange={(e) => set({ service: e.target.value })}>
              <option value="">Сервис: все</option>
              {services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={f.type} onChange={(e) => set({ type: e.target.value })}>
              <option value="">Тип: все</option>
              {incidentTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={f.sla} onChange={(e) => set({ sla: e.target.value })}>
              <option value="">SLA: все</option>
              {SLAS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select value={f.zone} onChange={(e) => set({ zone: e.target.value })}>
              <option value="">Зона: все</option>
              {zoneOptions.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={f.from}
                onChange={(e) => set({ from: e.target.value })}
                title="Дата с"
                className="px-2"
              />
              <Input
                type="date"
                value={f.to}
                onChange={(e) => set({ to: e.target.value })}
                title="Дата по"
                className="px-2"
              />
            </div>
          </div>

          {(f.weekday !== undefined || f.hourStart !== undefined) && (
            <p className="text-xs text-gray-500">
              Фильтр из тепловой карты: {f.weekday !== undefined && HEATMAP_DAYS[f.weekday]}
              {f.hourStart !== undefined && ` — ${String(f.hourStart).padStart(2, '0')}:00–${String(f.hourEnd).padStart(2, '0')}:00`}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Название</th>
                <th className="px-5 py-3 font-medium">Сервис</th>
                <th className="px-5 py-3 font-medium">Тип</th>
                <th className="px-5 py-3 font-medium">Дежурный</th>
                <th className="px-5 py-3 font-medium">Дата создания</th>
                <th className="px-5 py-3 font-medium">SLA</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((i, idx) => (
                <tr
                  key={i.id}
                  onClick={() => onOpen(i.id)}
                  className={cn(
                    'group cursor-pointer border-t border-white/[0.04] transition-colors hover:bg-white/[0.03]',
                    idx % 2 === 1 && 'bg-white/[0.015]',
                  )}
                >
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-neon">{i.id}</td>
                  <td className="px-5 py-3 text-gray-200">
                    <span className="flex items-center gap-2">
                      {i.title}
                      {i.status === 'draft' && <Badge color="gray">Черновик</Badge>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{i.services.join(', ')}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <Badge color="gray">{i.type}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-gray-400">{i.onDuty?.name ?? '—'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-gray-400">
                    {i.createdAt}
                  </td>
                  <td className="px-5 py-3">
                    <SlaBadge sla={i.sla} />
                  </td>
                  <td className="px-5 py-3">
                    <ChevronRight
                      size={15}
                      className="text-gray-700 transition-colors group-hover:text-gray-400"
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-600">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 text-xs text-gray-500">
          Показано {rows.length} из {incidents.length}
        </div>
      </Card>
    </div>
  );
}
