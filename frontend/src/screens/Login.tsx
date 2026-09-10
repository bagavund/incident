import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { ApiError } from '../lib/api';
import { Button, Field, Input } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти. Проверьте соединение с сервером.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-white/[0.06] border-t-2 border-t-[#63C634] bg-card p-8 shadow-pop">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-xl font-bold tracking-wide text-neon">IMS</span>
          <span className="text-xs text-gray-500">Incident Management System</span>
        </div>

        <h1 className="mb-5 mt-6 text-2xl font-normal tracking-tight text-gray-50">Вход</h1>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Логин" required>
            <Input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vkomlev"
              required
            />
          </Field>
          <Field label="Пароль" required>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-300"
              >
                {showPassword ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </Field>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-crit">
              <AlertCircle size={13} />
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-600">Учётку заводит администратор</p>
      </div>
    </div>
  );
}
