import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from './lib/api';
import { mapIncident, mapIncidentToPayload, type ApiIncident } from './adapters';
import type { FullIncident } from './types';

interface LookupRow {
  id: number;
  name: string;
  usage_count: number;
}

interface Store {
  incidents: FullIncident[];
  loading: boolean;
  error: string | null;
  getById: (id: string) => FullIncident | undefined;
  addIncident: (data: FullIncident) => Promise<FullIncident>;
  updateIncident: (id: string, data: FullIncident) => Promise<FullIncident>;
  removeIncident: (id: string) => Promise<void>;

  services: string[];
  addService: (name: string) => void;
  renameService: (index: number, name: string) => void;
  removeService: (index: number) => void;

  zones: string[];
  addZone: (name: string) => void;
  renameZone: (index: number, name: string) => void;
  removeZone: (index: number) => void;

  incidentTypes: string[];
  addIncidentType: (name: string) => void;
  renameIncidentType: (index: number, name: string) => void;
  removeIncidentType: (index: number) => void;

  criticalities: string[];
  addCriticality: (name: string) => void;
  renameCriticality: (index: number, name: string) => void;
  removeCriticality: (index: number) => void;
}

const StoreContext = createContext<Store | null>(null);

/**
 * CRUD над одним из админ-редактируемых справочников (сервисы/зоны/типы/критичность).
 * Все они устроены одинаково на бэкенде (LookupController), поэтому логика общая.
 */
function useLookupResource(endpoint: string) {
  const [rows, setRows] = useState<LookupRow[]>([]);

  const load = useCallback(async () => {
    const res = await apiGet<{ data: LookupRow[] }>(`/${endpoint}`);
    setRows(res.data);
  }, [endpoint]);

  const add = useCallback(
    (name: string) => {
      apiPost<{ data: LookupRow }>(`/${endpoint}`, { name })
        .then((res) => setRows((r) => [...r, res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru'))))
        .catch((e) => {
          if (!(e instanceof ApiError && e.status === 422)) console.error(e);
        });
    },
    [endpoint],
  );

  const rename = useCallback(
    (index: number, name: string) => {
      setRows((current) => {
        const row = current[index];
        if (!row) return current;
        apiPut<{ data: LookupRow }>(`/${endpoint}/${row.id}`, { name })
          .then((res) => setRows((r) => r.map((x, i) => (i === index ? res.data : x))))
          .catch((e) => {
            if (!(e instanceof ApiError && e.status === 422)) console.error(e);
          });
        return current;
      });
    },
    [endpoint],
  );

  const remove = useCallback(
    (index: number) => {
      setRows((current) => {
        const row = current[index];
        if (!row) return current;
        apiDelete(`/${endpoint}/${row.id}`)
          .then(() => setRows((r) => r.filter((_, i) => i !== index)))
          .catch((e) => {
            if (!(e instanceof ApiError && e.status === 409)) console.error(e);
          });
        return current;
      });
    },
    [endpoint],
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([services.load(), zones.load(), incidentTypes.load(), criticalities.load()]);
        const res = await apiGet<{ data: ApiIncident[] }>('/incidents?per_page=2000');
        if (!cancelled) setIncidents(res.data.map(mapIncident));
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
    async (data: FullIncident) => {
      const payload = mapIncidentToPayload(data, resolveServiceIds(data.services));
      const res = await apiPost<{ data: ApiIncident }>('/incidents', payload);
      const saved = mapIncident(res.data);
      setIncidents((list) => [saved, ...list]);
      return saved;
    },
    [resolveServiceIds],
  );

  const updateIncident = useCallback(
    async (id: string, data: FullIncident) => {
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

  const value: Store = {
    incidents,
    loading,
    error,
    getById,
    addIncident,
    updateIncident,
    removeIncident,

    services: services.rows.map((r) => r.name),
    addService: services.add,
    renameService: services.rename,
    removeService: services.remove,

    zones: zones.rows.map((r) => r.name),
    addZone: zones.add,
    renameZone: zones.rename,
    removeZone: zones.remove,

    incidentTypes: incidentTypes.rows.map((r) => r.name),
    addIncidentType: incidentTypes.add,
    renameIncidentType: incidentTypes.rename,
    removeIncidentType: incidentTypes.remove,

    criticalities: criticalities.rows.map((r) => r.name),
    addCriticality: criticalities.add,
    renameCriticality: criticalities.rename,
    removeCriticality: criticalities.remove,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore() must be used within <StoreProvider>');
  return ctx;
}
