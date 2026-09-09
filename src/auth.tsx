import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiGet, apiPost, getToken, setToken, setUnauthorizedHandler } from './lib/api';
import type { UserRole } from './types';

interface AuthUser {
  id: number;
  name: string;
  username: string;
  position: string | null;
  role: UserRole;
  role_label: string;
}

interface LoginResponse {
  token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

interface Auth {
  token: string | null;
  user: AuthUser | null;
  /** Сессия восстанавливается по сохранённому токену — до ответа /auth/me экраны не строим. */
  restoring: boolean;
  /** Полный доступ: правит любой инцидент, справочники, SLA, заводит пользователей. */
  isAdmin: boolean;
  /** Инцидент редактирует админ или дежурный, вписанный именно в него. */
  canEditIncident: (incident: { onDuty: { id: number } | null }) => boolean;
  login: (username: string, password: string) => Promise<void>;
  /** Смена своего пароля: сервер отдаёт новый токен (старый отзывает), обновляем сессию. */
  changePassword: (current: string, next: string, confirm: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState<boolean>(() => getToken() !== null);

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    setRestoring(false);
  }, []);

  // Любой 401 (протухший или отозванный токен) возвращает на экран входа.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // После перезагрузки страницы в localStorage есть только токен — кто мы, спрашиваем у сервера.
  useEffect(() => {
    if (!token || user) {
      setRestoring(false);
      return;
    }

    let cancelled = false;

    apiGet<{ data: AuthUser }>('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiPost<LoginResponse>('/auth/login', { username, password });
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    setRestoring(false);
  }, []);

  const changePassword = useCallback(async (current: string, next: string, confirm: string) => {
    const res = await apiPost<LoginResponse>('/auth/password', {
      current_password: current,
      password: next,
      password_confirmation: confirm,
    });
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }, []);

  const isAdmin = user?.role === 'admin';

  const canEditIncident = useCallback(
    (incident: { onDuty: { id: number } | null }) => isAdmin || (!!user && incident.onDuty?.id === user.id),
    [isAdmin, user],
  );

  return (
    <AuthContext.Provider value={{ token, user, restoring, isAdmin, canEditIncident, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used within <AuthProvider>');
  return ctx;
}
