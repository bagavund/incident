import { lazy, Suspense, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './auth';
import { StoreProvider, useStore } from './store';
import { ThemeProvider } from './theme';
import { navigate, usePath } from './router';
import { Login } from './screens/Login';
import type { IncidentFilters, Screen } from './types';

const Dashboard = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.Dashboard })));
const Incidents = lazy(() => import('./screens/Incidents').then((m) => ({ default: m.Incidents })));
const CreateIncident = lazy(() => import('./screens/CreateIncident').then((m) => ({ default: m.CreateIncident })));
const IncidentDetail = lazy(() => import('./screens/IncidentDetail').then((m) => ({ default: m.IncidentDetail })));
const Admin = lazy(() => import('./screens/Admin').then((m) => ({ default: m.Admin })));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Пока не залогинены — экран входа; бэкенд требует JWT на все эндпоинты. */
function Gate() {
  const { token } = useAuth();
  if (!token) return <Login />;

  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function parsePath(path: string): { screen: Screen; openId: string | null } {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'incidents') return { screen: 'incidents', openId: parts[1] ?? null };
  if (parts[0] === 'create') return { screen: 'create', openId: null };
  if (parts[0] === 'admin') return { screen: 'admin', openId: null };
  return { screen: 'dashboard', openId: null };
}

function ScreenFallback() {
  return <div className="flex h-40 items-center justify-center text-xs text-gray-600">Загрузка...</div>;
}

function Shell() {
  const { incidents, loading, error } = useStore();
  const { logout } = useAuth();
  const path = usePath();
  const { screen, openId } = parsePath(path);
  const [pendingFilter, setPendingFilter] = useState<Partial<IncidentFilters> | null>(null);

  const goto = (s: Screen) => {
    setPendingFilter(null);
    navigate(s === 'dashboard' ? '/' : `/${s}`);
  };

  /** После публикации нового инцидента открываем его карточку. */
  const openPublished = (id: string) => {
    navigate(`/incidents/${id}`);
  };

  /** Клик по дашборду: показать инциденты, из которых сложился этот график. */
  const drillToIncidents = (filter: Partial<IncidentFilters>) => {
    setPendingFilter(filter);
    navigate('/incidents');
  };

  return (
    <div className="grid-bg flex min-h-screen text-gray-200">
      <Sidebar screen={screen} onNavigate={goto} onLogout={logout} />
      <main className="flex-1 overflow-x-hidden px-6 py-6 lg:px-8">
        {loading ? (
          <ScreenFallback />
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-crit/20 bg-crit/[0.06] px-4 py-3 text-[13px] text-crit">
            <AlertCircle size={16} className="flex-none" />
            {error}
          </div>
        ) : (
          <Suspense fallback={<ScreenFallback />}>
            {openId ? (
              <IncidentDetail id={openId} onBack={() => navigate('/incidents')} />
            ) : screen === 'dashboard' ? (
              <Dashboard onDrill={drillToIncidents} />
            ) : screen === 'incidents' ? (
              <Incidents
                incidents={incidents}
                initialFilter={pendingFilter}
                onNavigate={goto}
                onOpen={(id) => navigate(`/incidents/${id}`)}
              />
            ) : screen === 'admin' ? (
              <Admin />
            ) : (
              <CreateIncident onPublished={openPublished} onCancel={() => navigate('/')} />
            )}
          </Suspense>
        )}
      </main>
    </div>
  );
}
