import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './lib/api';
import { mapIncident, mapIncidentToPayload, type ApiIncident } from './adapters';
import type { FullIncident, IncidentDraft, ProblemCategory, UserAccount, UserRole } from './types';

/** Данные для создания учётки — заводит только администратор. */
export interface NewUser {
  name: string;
  username: string;
  password: string;
  passwordConfirmation: string;
  position: string;
  role: UserRole;
}

export interface LookupRow {
  id: number;
  name: string;
  /** Сколько инцидентов ссылаются на значение — считает сервер. */
  usage_count: number;
  /** У типов инцидентов и зон: категория проблемы (Внешняя / На нашей стороне). */
  category?: ProblemCategory;
}

/**
 * Один справочник в том виде, в каком им пользуется экран администрирования.
 * Мутации возвращают Promise и не глушат ошибки: сообщение с сервера («уже
 * существует», «используется в N инцидентах», 403) показывает вызывающий экран.
 */
export interface LookupApi {
  rows: LookupRow[];
  add: (name: string, category?: ProblemCategory) => Promise<void>;
  rename: (index: number, name: string, category?: ProblemCategory) => Promise<void>;
  remove: (index: number) => Promise<void>;
}

export type LookupKey = 'services' | 'zones' | 'incidentTypes' | 'criticalities';

interface Store {
  incidents: FullIncident[];
  loading: boolean;
  error: string | null;
  getById: (id: string) => FullIncident | undefined;
  addIncident: (data: IncidentDraft) => Promise<FullIncident>;
  updateIncident: (id: string, data: IncidentDraft) => Promise<FullIncident>;
  removeIncident: (id: string) => Promise<void>;

  /** Названия значений — для выпадающих списков и чекбоксов в формах. */
  services: string[];
  zones: string[];
  incidentTypes: string[];
  criticalities: string[];

  /** Полные строки справочников с CRUD — для экрана администрирования. */
  lookups: Record<LookupKey, LookupApi>;

  /** SLA — минуты на эскалацию (обнаружение → передача ответственным), порог общий для всех инцидентов. */
  slaEscalationMinutes: number | null;
  /** Меняет порог; сервер тут же пересчитывает вердикт по SLA у всех инцидентов, поэтому список перезагружается. */
  updateSlaEscalationMinutes: (minutes: number) => Promise<void>;

  /** Все учётки — выбор дежурного в форме инцидента и список в администрировании. */
  users: UserAccount[];
  /** Заводит учётку (админ-only на бэке); бросает ApiError, если логин занят или прав не хватает. */
  addUser: (data: NewUser) => Promise<void>;
  /** Админский сброс пароля пользователя (админ-only на бэке). */
  resetUserPassword: (userId: number, password: string, passwordConfirmation: string) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

/**
 * CRUD над одним из админ-редактируемых справочников (сервисы/зоны/типы/критичность).
 * Все они устроены одинаково на бэкенде (LookupController), поэтому логика общая.
 */
function useLookupResource(endpoint: string) {
  const [rows, setRows] = useState<LookupRow[]>([]);

  const byName = (a: LookupRow, b: LookupRow) => a.name.localeCompare(b.name, 'ru');

  const load = useCallback(async () => {
    const res = await apiGet<{ data: LookupRow[] }>(`/${endpoint}`);
    setRows(res.data);
  }, [endpoint]);

  const add = useCallback(
    async (name: string, category?: ProblemCategory) => {
      const res = await apiPost<{ data: LookupRow }>(`/${endpoint}`, { name, ...(category && { category }) });
      setRows((r) => [...r, res.data].sort(byName));
    },
    [endpoint],
  );

  const rename = useCallback(
    async (index: number, name: string, category?: ProblemCategory) => {
      const row = rows[index];
      if (!row) return;
      const res = await apiPut<{ data: LookupRow }>(`/${endpoint}/${row.id}`, {
        name,
        ...(category && { category }),
      });
      setRows((r) => r.map((x, i) => (i === index ? res.data : x)).sort(byName));
    },
    [endpoint, rows],
  );

  const remove = useCallback(
    async (index: number) => {
      const row = rows[index];
      if (!row) return;
      await apiDelete(`/${endpoint}/${row.id}`);
      setRows((r) => r.filter((_, i) => i !== index));
    },
    [endpoint, rows],
  );

  return { rows, load, add, rename, remove };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<FullIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const services = useLookupResource('services');
  const zones = useLookupResource('zones');
  const incidentTypes = useLookupResource('incident-types');
  const criticalities = useLookupResource('criticalities');
  const [slaEscalationMinutes, setSlaEscalationMinutes] = useState<number | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);

  const loadUsers = useCallback(async () => {
    const res = await apiGet<{ data: UserAccount[] }>('/users');
    setUsers(res.data);
  }, []);

  const loadIncidents = useCallback(async () => {
    const res = await apiGet<{ data: ApiIncident[] }>('/incidents?per_page=2000');
    setIncidents(res.data.map(mapIncident));
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [, , , , slaSetting] = await Promise.all([
          services.load(),
          zones.load(),
          incidentTypes.load(),
          criticalities.load(),
          apiGet<{ data: { escalation_minutes: number } }>('/sla-setting'),
          loadUsers(),
        ]);
        if (!cancelled) setSlaEscalationMinutes(slaSetting.data.escalation_minutes);
        await loadIncidents();
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные с сервера.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getById = useCallback((id: string) => incidents.find((i) => i.id === id), [incidents]);

  const resolveServiceIds = useCallback(
    (names: string[]) =>
      names
        .map((name) => services.rows.find((r) => r.name === name)?.id)
        .filter((id): id is number => id != null),
    [services.rows],
  );

  const addIncident = useCallback(
    async (data: IncidentDraft) => {
      const payload = mapIncidentToPayload(data, resolveServiceIds(data.services));
      const res = await apiPost<{ data: ApiIncident }>('/incidents', payload);
      const saved = mapIncident(res.data);
      setIncidents((list) => [saved, ...list]);
      return saved;
    },
    [resolveServiceIds],
  );

  const updateIncident = useCallback(
    async (id: string, data: IncidentDraft) => {
      const payload = mapIncidentToPayload(data, resolveServiceIds(data.services));
      const res = await apiPut<{ data: ApiIncident }>(`/incidents/${id}`, payload);
      const saved = mapIncident(res.data);
      setIncidents((list) => list.map((i) => (i.id === id ? saved : i)));
      return saved;
    },
    [resolveServiceIds],
  );

  const removeIncident = useCallback(async (id: string) => {
    await apiDelete(`/incidents/${id}`);
    setIncidents((list) => list.filter((i) => i.id !== id));
  }, []);

  const addUser = useCallback(async (data: NewUser) => {
    const res = await apiPost<{ data: UserAccount }>('/users', {
      name: data.name,
      username: data.username,
      password: data.password,
      password_confirmation: data.passwordConfirmation,
      position: data.position || null,
      role: data.role,
    });
    setUsers((list) => [...list, res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
  }, []);

  const resetUserPassword = useCallback(
    async (userId: number, password: string, passwordConfirmation: string) => {
      await apiPut(`/users/${userId}/password`, {
        password,
        password_confirmation: passwordConfirmation,
      });
    },
    [],
  );

  const updateSlaEscalationMinutes = useCallback(
    async (minutes: number) => {
      const res = await apiPut<{ data: { escalation_minutes: number } }>('/sla-setting', {
        escalation_minutes: minutes,
      });
      setSlaEscalationMinutes(res.data.escalation_minutes);
      // Сервер пересчитал вердикт по SLA у всех инцидентов — подтягиваем свежий список.
      await loadIncidents();
    },
    [loadIncidents],
  );

  const value: Store = {
    incidents,
    loading,
    error,
    getById,
    addIncident,
    updateIncident,
    removeIncident,

    services: services.rows.map((r) => r.name),
    zones: zones.rows.map((r) => r.name),
    incidentTypes: incidentTypes.rows.map((r) => r.name),
    criticalities: criticalities.rows.map((r) => r.name),

    lookups: { services, zones, incidentTypes, criticalities },

    slaEscalationMinutes,
    updateSlaEscalationMinutes,

    users,
    addUser,
    resetUserPassword,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore() must be used within <StoreProvider>');
  return ctx;
}
