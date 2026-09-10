import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Calendar, ChevronDown } from 'lucide-react';
import { HEATMAP_DAYS, HEATMAP_HOURS, PERIODS, periodRange, type DashboardMetric } from '../data';
import { ApiError, apiGet } from '../lib/api';
import type { IncidentFilters } from '../types';
import { Button, Card, CardHeader, cn, Delta, InfoHint, Input } from '../components/ui';

interface DashboardPayload {
  kpis: DashboardMetric[];
  time_analytics: DashboardMetric[];
  by_day: { day: string; date: string; count: number }[];
  by_zone: { name: string; value: number }[];
  by_type: { name: string; value: number; pct: number }[];
  top_services: { name: string; count: number; delta: number }[];
  top_services_pie: { name: string; value: number }[];
  heatmap: { matrix: number[][] };
  channel_speed: { channel: string; avg_attempts: number; success_rate: number; total: number }[];
  reliability: {
    prolonged_escalation_rate: number;
    recidivism_rate: number;
    night_weekend_ratio: number;
    first_call_success_rate: number;
    war_room_rate: number;
  };
}

const EMPTY_HEATMAP = Array.from({ length: 7 }, () => Array(24).fill(0));

const AXIS = { fill: '#9AA0A6', fontSize: 11, fontFamily: 'Golos Text' };
const GRID = 'rgba(120,127,133,0.18)';
const BAR_COLOR = '#2F7D57';
const PIE_COLORS = ['#2F7D57', '#54A0C2', '#DFB750', '#9AA0A6'];
const HEAT_ACCENT = '47,125,87';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-xs">
      {label != null && <p className="mb-1 text-gray-500">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-gray-300">
          {p.name}: <span className="text-neon">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Dashboard({
  onDrill,
}: {
  onDrill: (filter: Partial<IncidentFilters>) => void;
}) {
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState(() => fmtInputDate(new Date(Date.now() - 30 * 86400000)));
  const [customTo, setCustomTo] = useState(() => fmtInputDate(new Date()));

  const { from, to } = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (period === 'custom') {
          params.set('from', customFrom);
          params.set('to', customTo);
        } else {
          params.set('period', period);
        }
        const res = await apiGet<DashboardPayload>(`/analytics/dashboard?${params}`);
        if (!cancelled) setPayload(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Не удалось загрузить аналитику.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period, customFrom, customTo]);

  const kpis = payload?.kpis ?? [];
  const timeAnalytics = payload?.time_analytics ?? [];
  const byDay = payload?.by_day ?? [];
  const byZone = payload?.by_zone ?? [];
  const byType = payload?.by_type ?? [];
  const topServices = payload?.top_services ?? [];
  const topServicesPie = payload?.top_services_pie ?? [];
  const heatmap = payload?.heatmap.matrix ?? EMPTY_HEATMAP;
  const channelSpeed = (payload?.channel_speed ?? []).map((c) => ({
    channel: c.channel,
    avgAttempts: c.avg_attempts,
    successRate: c.success_rate,
    total: c.total,
  }));
  const prolongedEscalationRate = payload?.reliability.prolonged_escalation_rate ?? 0;
  const recidivismRate = payload?.reliability.recidivism_rate ?? 0;
  const nightWeekendRatio = payload?.reliability.night_weekend_ratio ?? 0;
  const firstCallSuccessRate = payload?.reliability.first_call_success_rate ?? 0;
  const warRoomRate = payload?.reliability.war_room_rate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-normal tracking-tight text-gray-50">Дашборд</h1>
          <p className="mt-1 text-sm text-gray-500">
            Общая картина по инцидентам. Нажмите на любой график, чтобы открыть инциденты за этот срез.
          </p>
        </div>
        <PeriodPicker
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => {
            setCustomFrom(f);
            setCustomTo(t);
          }}
        />
      </div>

      {loading && !payload ? (
        <p className="py-10 text-center text-xs text-gray-600">Загрузка аналитики...</p>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-crit/20 bg-crit/[0.06] px-4 py-3 text-[13px] text-crit">
          <AlertCircle size={16} className="flex-none" />
          {error}
        </div>
      ) : (
      <>
      {/* KPI — одна делёная полоса, а не набор карточек */}
      <Card
        className="kpi-band grid overflow-hidden"
        style={{ ['--cols' as string]: Math.max(kpis.length, 1) }}
      >
        {kpis.map((k) => (
          <button
            key={k.key}
            onClick={() => onDrill({ from: fmtInputDate(from), to: fmtInputDate(to) })}
            className="px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
          >
            <p className="text-xs text-gray-500">{k.label}</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[30px] font-normal leading-none tracking-tight tabular-nums text-gray-50">
                {k.value}
              </span>
              <span className="pb-0.5">
                <Delta value={k.delta} up={k.up} />
              </span>
            </div>
          </button>
        ))}
      </Card>

      {/* Аналитика по времени — такой же делёной полосой */}
      <Card
        className="kpi-band grid overflow-hidden"
        style={{ ['--cols' as string]: Math.max(timeAnalytics.length, 1) }}
      >
        {timeAnalytics.map((a) => (
          <div key={a.key} className="px-5 py-4">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              {a.label}
              {a.hint && <InfoHint text={a.hint} />}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-[30px] font-normal leading-none tracking-tight tabular-nums text-gray-50">
                {a.value}
              </span>
              <span className="pb-0.5">
                <Delta value={a.delta} up={a.up} />
              </span>
            </div>
          </div>
        ))}
      </Card>

      {/* Инциденты по дням — компактная панель */}
      <Card className="flex flex-col">
        <CardHeader title="Инциденты по дням" />
        <div className="h-[140px] px-2 pb-3 pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar
                dataKey="count"
                name="Инциденты"
                fill={BAR_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                cursor="pointer"
                onClick={(d: any) => onDrill({ from: d.date, to: d.date })}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Тепловая карта — на всю ширину, без горизонтального скролла */}
      <Heatmap data={heatmap} onDrill={onDrill} />

      {/* Row: by zone + top services + by type */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Инциденты по зонам ответственности" />
          <div className="h-[240px] px-2 pb-3 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byZone} margin={{ top: 8, right: 12, bottom: 28, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={AXIS}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tickLine={false} axisLine={false} tick={AXIS} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" name="Инциденты" radius={[4, 4, 0, 0]} maxBarSize={34} cursor="pointer">
                  {byZone.map((z) => (
                    <Cell key={z.name} fill={BAR_COLOR} onClick={() => onDrill({ zone: z.name })} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Топ сервисов с инцидентами" />
          <ul className="px-2 pb-2">
            {topServices.map((s) => (
              <li key={s.name}>
                <button
                  onClick={() => onDrill({ service: s.name })}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.03]"
                >
                  <span className="text-gray-300">{s.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-gray-400">{s.count}</span>
                    {s.delta !== 0 && <Delta value={s.delta} up={s.delta > 0} />}
                  </span>
                </button>
              </li>
            ))}
            {topServices.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-gray-600">Нет данных за период</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Тип инцидента" />
          <ul className="space-y-3 p-5 pt-2">
            {byType.map((t) => (
              <li key={t.name}>
                <button
                  onClick={() => onDrill({ type: t.name })}
                  className="block w-full text-left transition-opacity hover:opacity-80"
                >
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-gray-400">{t.name}</span>
                    <span className="tabular-nums text-gray-500">
                      {t.value} — {t.pct}%
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-neon/70" style={{ width: `${t.pct}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Дополнительная аналитика: эскалации, рецидивы, надёжность */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-300">Эскалации и надёжность</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Затянутая эскалация"
            value={`${prolongedEscalationRate}%`}
            hint="Доля инцидентов, где хотя бы одна попытка эскалации закончилась «Не дозвонился» — человек оказался недоступен."
          />
          <StatTile
            label="Рецидивные инциденты"
            value={`${recidivismRate}%`}
            hint="Доля инцидентов, у которых за 90 дней до этого уже был инцидент с той же причиной и тем же сервисом."
          />
          <StatTile
            label="Ночь/выходные"
            value={`${nightWeekendRatio}%`}
            hint="Доля инцидентов, начавшихся с 21:00 до 09:00 или в выходные."
          />
          <StatTile
            label="Дозвон с 1-й попытки"
            value={`${firstCallSuccessRate}%`}
            hint="Доля попыток эскалации, когда дозвонились сразу, без повторных звонков."
          />
          <StatTile
            label="Сбор телемоста"
            value={`${warRoomRate}%`}
            hint="Как часто по инциденту собирали телемост (war room)."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader title="Топ-3 проблемных сервиса" />
          <div className="h-[220px] px-2 pb-3 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topServicesPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(d: any) => d?.name !== 'Остальные' && onDrill({ service: d.name })}
                >
                  {topServicesPie.map((s, i) => (
                    <Cell key={s.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  formatter={(v) => <span style={{ color: '#a1a1aa', fontSize: 11 }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {topServicesPie.length === 0 && (
            <p className="px-3 pb-4 text-center text-xs text-gray-600">Нет данных за период</p>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Какой канал связи самый быстрый?"
            subtitle="Средняя длина серии звонков и доля успешных дозвонов по каналу"
          />
          <div className="h-[220px] px-2 pb-3 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelSpeed} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="channel" tickLine={false} axisLine={false} tick={AXIS} tickMargin={10} interval={0} />
                <YAxis tickLine={false} axisLine={false} tick={AXIS} width={28} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-xs">
                        <p className="mb-1 text-gray-500">{label}</p>
                        <p className="text-gray-300">
                          Ср. попыток: <span className="text-neon">{d.avgAttempts}</span>
                        </p>
                        <p className="text-gray-300">
                          Успешных: <span className="text-neon">{d.successRate}%</span>
                        </p>
                      </div>
                    );
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="avgAttempts" name="Ср. попыток до результата" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {channelSpeed.length === 0 && (
            <p className="px-3 pb-4 text-center text-xs text-gray-600">Нет данных за период</p>
          )}
        </Card>
      </div>
      </>
      )}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        {label}
        {hint && <InfoHint text={hint} />}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-gray-50">{value}</p>
    </Card>
  );
}

function fmtInputDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function PeriodPicker({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: string;
  onChange: (v: string) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = PERIODS.find((p) => p.value === value) ?? PERIODS[1];

  return (
    <div ref={ref} className="relative">
      <Button icon={<Calendar size={14} />} onClick={() => setOpen((o) => !o)}>
        {current.label}
        <ChevronDown size={14} className="text-gray-500" />
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-white/10 bg-card p-1 shadow-xl">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                onChange(p.value);
                if (p.value !== 'custom') setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] transition-colors',
                value === p.value ? 'bg-white/[0.06] text-gray-100' : 'text-gray-400 hover:bg-white/[0.03]',
              )}
            >
              {p.label}
              {value === p.value && <span className="text-neon">✓</span>}
            </button>
          ))}

          {value === 'custom' && (
            <div className="mt-1 grid grid-cols-2 gap-2 border-t border-white/[0.06] p-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => onCustomChange(e.target.value, customTo)}
                className="px-2 py-1.5 text-xs"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => onCustomChange(customFrom, e.target.value)}
                className="px-2 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Heatmap({
  data,
  onDrill,
}: {
  data: number[][];
  onDrill: (filter: Partial<IncidentFilters>) => void;
}) {
  const max = Math.max(1, ...data.flat());
  return (
    <Card>
      <CardHeader title="Тепловая карта" subtitle="День недели и час обнаружения. Нажмите на ячейку, чтобы открыть инциденты." />
      <div className="p-4 pt-2">
        <div className="mb-1 grid grid-cols-[28px_repeat(24,minmax(0,1fr))] gap-1">
          <span />
          {HEATMAP_HOURS.map((h, c) => (
            <span key={h} className="text-center text-[9px] tabular-nums text-gray-600">
              {c % 3 === 0 ? h : ''}
            </span>
          ))}
        </div>
        {data.map((row, r) => (
          <div key={r} className="mb-1 grid grid-cols-[28px_repeat(24,minmax(0,1fr))] items-center gap-1">
            <span className="text-[10px] text-gray-600">{HEATMAP_DAYS[r]}</span>
            {row.map((v, c) => (
              <button
                key={c}
                onClick={() => onDrill({ weekday: r, hourStart: c, hourEnd: c + 1 })}
                title={`${HEATMAP_DAYS[r]} ${HEATMAP_HOURS[c]}:00 — ${v}`}
                className="aspect-square w-full rounded-[3px] transition-transform hover:scale-110"
                style={{
                  backgroundColor:
                    v === 0 ? 'rgba(120,127,133,0.12)' : `rgba(${HEAT_ACCENT},${0.15 + (v / max) * 0.8})`,
                }}
              />
            ))}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-600">
          <span>меньше</span>
          {[0.04, 0.25, 0.5, 0.75, 1].map((o, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{
                backgroundColor: i === 0 ? 'rgba(120,127,133,0.12)' : `rgba(${HEAT_ACCENT},${o})`,
              }}
            />
          ))}
          <span>больше</span>
        </div>
      </div>
    </Card>
  );
}
