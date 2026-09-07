import { useEffect, useRef, useState } from 'react';
import { Check, LayoutDashboard, ListChecks, LogOut, Moon, PlusCircle, Settings, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../auth';
import type { Screen } from '../types';
import { useTheme, type Theme } from '../theme';
import { navigate } from '../router';
import { cn } from './ui';

const NAV: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'incidents', label: 'Инциденты', icon: ListChecks },
  { id: 'create', label: 'Создать инцидент', icon: PlusCircle },
];

export function Sidebar({
  screen,
  onNavigate,
  onLogout,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
}) {
  const { user, isAdmin } = useAuth();

  return (
    <aside className="flex w-60 flex-none flex-col border-r border-neon/10 bg-black/80 backdrop-blur">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 font-display text-[13px] font-bold text-neon">
          IMS
        </div>
        <div className="leading-tight">
          <p className="font-display text-[13px] font-medium text-gray-200">Incident</p>
          <p className="text-[11px] text-gray-500">Management System</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                active
                  ? 'bg-white/[0.06] text-gray-100'
                  : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300',
              )}
            >
              <Icon size={16} className={active ? 'text-neon' : ''} />
              {label}
            </button>
          );
        })}

        <div className="my-3 h-px bg-white/5" />

        <SettingsMenu adminActive={screen === 'admin'} isAdmin={isAdmin} onLogout={onLogout} />
      </nav>

      {user && (
        <div className="border-t border-white/5 px-5 py-3 leading-tight">
          <p className="truncate text-[13px] text-gray-300">{user.name}</p>
          <p className="text-[11px] text-gray-600">{user.role_label}</p>
        </div>
      )}
    </aside>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'light', label: 'Светлая', icon: Sun },
];

function SettingsMenu({
  adminActive,
  isAdmin,
  onLogout,
}: {
  adminActive: boolean;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
          open ? 'bg-white/[0.03] text-gray-300' : 'text-gray-600 hover:bg-white/[0.03] hover:text-gray-400',
        )}
      >
        <Settings size={16} />
        Настройки
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-1.5 rounded-lg border border-white/10 bg-card p-1 shadow-xl">
          <p className="px-2.5 pb-1 pt-1.5 text-[10px] uppercase tracking-wide text-gray-600">Тема</p>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
                  active ? 'bg-white/[0.06] text-gray-100' : 'text-gray-400 hover:bg-white/[0.03]',
                )}
              >
                <Icon size={14} className={active ? 'text-neon' : ''} />
                <span className="flex-1">{label}</span>
                {active && <Check size={14} className="text-neon" />}
              </button>
            );
          })}
          {isAdmin && (
            <>
          <div className="my-1 h-px bg-white/5" />
          <button
            onClick={() => {
              setOpen(false);
              navigate('/admin');
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
              adminActive ? 'bg-white/[0.06] text-gray-100' : 'text-gray-400 hover:bg-white/[0.03]',
            )}
          >
            <ShieldCheck size={14} className={adminActive ? 'text-neon' : ''} />
            <span className="flex-1">Администрирование</span>
            {adminActive && <Check size={14} className="text-neon" />}
          </button>
            </>
          )}
          <div className="my-1 h-px bg-white/5" />
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-gray-400 transition-colors hover:bg-white/[0.03] hover:text-crit"
          >
            <LogOut size={14} />
            <span className="flex-1">Выйти</span>
          </button>
        </div>
      )}
    </div>
  );
}
