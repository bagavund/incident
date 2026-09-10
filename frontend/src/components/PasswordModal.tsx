import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { ApiError } from '../lib/api';
import { Button, Field, Input } from './ui';

/**
 * Модалка смены пароля. Два режима:
 *  - self: пользователь меняет свой пароль, нужен текущий;
 *  - admin: администратор сбрасывает пароль другому, текущий не спрашиваем.
 * onSubmit бросает ApiError — ошибки полей с сервера показываем под инпутами.
 */
export function PasswordModal({
  title,
  mode,
  onSubmit,
  onClose,
}: {
  title: string;
  mode: 'self' | 'admin';
  onSubmit: (values: { current: string; next: string; confirm: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setError(null);
    setFieldErrors({});

    if (mode === 'self' && !current) return setError('Введите текущий пароль.');
    if (!next) return setError('Введите новый пароль.');
    if (next !== confirm) return setError('Пароли не совпадают.');

    setSaving(true);
    try {
      await onSubmit({ current, next, confirm });
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.errors ?? {});
      } else {
        setError('Не удалось сменить пароль. Проверьте соединение.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/10 bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-display text-[13px] font-medium text-gray-200">
            <KeyRound size={14} className="text-neon" />
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {mode === 'self' && (
            <Field label="Текущий пароль">
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              {fieldErrors.current_password?.map((m) => (
                <p key={m} className="mt-1 text-xs text-crit">{m}</p>
              ))}
            </Field>
          )}
          <Field label="Новый пароль">
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {fieldErrors.password?.map((m) => (
              <p key={m} className="mt-1 text-xs text-crit">{m}</p>
            ))}
            <p className="mt-1 text-[11px] text-gray-500">
              Минимум 12 символов, буквы разного регистра и хотя бы одна цифра.
            </p>
          </Field>
          <Field label="Повтор нового пароля">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </Field>

          {error && <p className="text-xs text-crit">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Отмена</Button>
            <Button variant="primary" disabled={saving} onClick={submit}>
              {saving ? 'Сохранение…' : 'Сменить пароль'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
