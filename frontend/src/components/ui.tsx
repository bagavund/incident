import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Info, Search, X } from 'lucide-react';
import type { SlaState } from '../types';

/* ------------------------------------------------------------------ */
/* cn helper                                                           */
/* ------------------------------------------------------------------ */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-white/[0.06] bg-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'ghost' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'ghost',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'btn-accent font-medium',
    outline: 'border border-white/10 text-gray-200 hover:bg-white/[0.04] bg-transparent',
    ghost: 'border border-white/[0.08] text-gray-400 hover:text-gray-200 hover:bg-white/[0.03] bg-transparent',
  };
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-control px-3.5 py-2 text-sm transition-[background-color,border-color,color,filter,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */
interface BadgeProps {
  children: React.ReactNode;
  color?: 'neon' | 'red' | 'blue' | 'gray';
  className?: string;
}

const BADGE_COLORS: Record<NonNullable<BadgeProps['color']>, string> = {
  neon: 'text-neon bg-neon/[0.08]',
  red: 'text-crit bg-crit/[0.08]',
  blue: 'text-blue-400 bg-blue-400/[0.08]',
  gray: 'text-gray-400 bg-white/[0.05]',
};

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        BADGE_COLORS[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SlaBadge({ sla }: { sla: SlaState }) {
  return <Badge color={sla === 'Соблюден' ? 'neon' : 'red'}>{sla}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */
const fieldBase =
  'w-full rounded-control border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-neon/60 focus:bg-white/[0.03] placeholder:text-gray-600 aria-[invalid=true]:border-crit/70 aria-[invalid=true]:bg-crit/[0.05]';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...rest} />
  ),
);
Input.displayName = 'Input';

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          fieldBase,
          'appearance-none bg-[#141416] pr-9 text-gray-200',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
      />
    </div>
  );
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, 'min-h-[90px] resize-y', className)} {...rest} />;
}

/** Textarea, растущая вниз по мере ввода текста */
export function AutoTextarea({
  value,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={cn('resize-none overflow-hidden', className)}
      {...rest}
    />
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-gray-500">
      {children}
      {required && <span className="ml-0.5 text-neon">*</span>}
    </label>
  );
}

export function Field({
  label,
  required,
  error,
  id,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className={id ? 'scroll-mt-24' : undefined}>
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-[11px] text-crit">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */
export function Checkbox({
  label,
  checked,
  onChange,
  radio,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 py-1.5 text-left text-[13px] text-gray-300 transition-[color,transform] duration-150 hover:text-gray-100 active:scale-[0.98]"
    >
      <span
        className={cn(
          'flex h-[18px] w-[18px] flex-none items-center justify-center border transition-colors',
          radio ? 'rounded-full' : 'rounded-[5px]',
          checked ? 'border-neon bg-neon text-black' : 'border-white/20 bg-transparent',
        )}
      >
        {checked &&
          (radio ? (
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2.5 6.5L5 9l4.5-5" />
            </svg>
          ))}
      </span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* MultiSelect — выпадающий список с поиском и мультивыбором           */
/* ------------------------------------------------------------------ */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Выберите значения',
  searchPlaceholder = 'Поиск...',
  invalid,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  );

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-invalid={invalid || undefined}
        className={cn(
          fieldBase,
          'flex min-h-[38px] cursor-pointer items-center justify-between gap-2 text-left',
          open && 'border-neon/60 bg-white/[0.03]',
        )}
      >
        {selected.length === 0 ? (
          <span className="text-gray-600">{placeholder}</span>
        ) : (
          <span className="flex flex-1 flex-wrap gap-1.5">
            {selected.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-gray-200"
              >
                {s}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(s);
                  }}
                  className="text-gray-500 hover:text-crit"
                >
                  <X size={11} />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={15} className="flex-none text-gray-500" />
      </button>

      {open && (
        <div className="animate-panel-in absolute left-0 right-0 top-full z-20 mt-1.5 origin-top rounded-lg border border-white/10 bg-card shadow-xl">
          <div className="relative border-b border-white/[0.06] p-1.5">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md bg-white/[0.03] py-1.5 pl-7 pr-2 text-[13px] text-gray-200 outline-none placeholder:text-gray-600"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs text-gray-600">Ничего не найдено</p>
            )}
            {filtered.map((opt) => {
              const active = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                    active ? 'bg-white/[0.06] text-gray-100' : 'text-gray-400 hover:bg-white/[0.03]',
                  )}
                >
                  {opt}
                  {active && <Check size={14} className="text-neon" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* InfoHint — (i) с всплывающей подсказкой                             */
/* ------------------------------------------------------------------ */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info size={13} className="cursor-help text-gray-600 transition-colors group-hover:text-gray-400" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-black/95 px-3 py-2 text-[11px] font-normal leading-relaxed text-gray-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Delta (percent up/down)                                             */
/* ------------------------------------------------------------------ */
export function Delta({ value, up }: { value: number; up: boolean }) {
  return (
    <span
      title="Изменение относительно предыдущего периода такой же длины"
      className={cn('text-xs font-semibold tabular-nums', up ? 'text-neon' : 'text-crit')}
    >
      {value > 0 ? '+' : ''}
      {value}%
    </span>
  );
}
