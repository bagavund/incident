import { useState } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../auth';
import { ApiError } from '../lib/api';
import { Button, Card, Field, Input } from '../components/ui';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти. Проверьте соединение с сервером.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center px-4 text-gray-200">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10 font-display text-sm font-bold text-neon">
            IMS
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-medium text-gray-200">Incident Management System</p>
            <p className="text-[11px] text-gray-500">Вход в систему</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@ims.local"
              required
            />
          </Field>
          <Field label="Пароль" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-crit">
              <AlertCircle size={13} />
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" icon={<LogIn size={14} />} className="w-full justify-center" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-gray-600">
          Демо-доступ: engineer@ims.local / password
        </p>
      </Card>
    </div>
  );
}
