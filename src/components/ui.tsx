import { useEffect, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertTriangle, CheckCircle2, CircleHelp, Info, X, XCircle } from 'lucide-react'
import type { AppStatus, PriceVerdict } from '../types'
import { useStore } from '../store'
import { fmtPct } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 border-brand-600',
  secondary: 'bg-white text-brand-700 hover:bg-brand-50 border-line',
  ghost: 'bg-transparent text-slate-600 hover:bg-brand-50 border-transparent',
  danger: 'bg-white text-over hover:bg-over-bg border-red-200',
}

export function Button({
  variant = 'secondary',
  icon,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function Card({ title, actions, children, className = '', bodyClass = 'p-4' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function Field({ label, error, children, className = '', hint }: { label: string; error?: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-over">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

export function Select({ options, placeholder, className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[] | { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select className={`input ${className}`} {...rest}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((o) =>
        typeof o === 'string' ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

export function Modal({ title, onClose, children, footer, width = 'max-w-3xl' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6" onMouseDown={onClose}>
      <div className={`mt-8 w-full ${width} rounded-lg border border-line bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button className="rounded p-1 text-slate-500 hover:bg-brand-50" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/25" onMouseDown={onClose}>
      <aside className="flex h-full w-full max-w-[640px] flex-col border-l border-line bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-line bg-brand-50 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-white" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  )
}

export function VerdictBadge({ verdict, deviation }: { verdict: PriceVerdict; deviation?: number | null }) {
  if (verdict === 'over')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-over-bg px-2 py-0.5 text-xs font-medium text-over">
        <AlertTriangle size={12} /> Превышение{deviation != null ? ` ${fmtPct(deviation)}` : ''}
      </span>
    )
  if (verdict === 'within')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-xs font-medium text-ok">
        <CheckCircle2 size={12} /> В пределах ориентира
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <CircleHelp size={12} /> Нет ориентира
    </span>
  )
}

const STATUS_STYLE: Record<AppStatus, string> = {
  'На рассмотрении': 'bg-brand-50 text-brand-700 border-brand-200',
  'Запрошено обоснование': 'bg-amber-50 text-amber-800 border-amber-200',
  'Обоснование представлено': 'bg-violet-50 text-violet-700 border-violet-200',
  Согласовано: 'bg-ok-bg text-ok border-green-200',
  Отклонено: 'bg-slate-100 text-slate-600 border-slate-200',
}

export function StatusBadge({ status }: { status: AppStatus }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[status]}`}>{status}</span>
}

export function DemoTag() {
  return <span className="ml-1.5 rounded bg-slate-100 px-1 py-px text-[10px] font-medium tracking-wide text-slate-500 uppercase">демо</span>
}

export function StatCard({ label, value, hint, tone = 'brand', icon, active, onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'over' | 'ok' | 'neutral'; icon?: ReactNode; active?: boolean; onClick?: () => void }) {
  const tones = {
    brand: 'text-brand-700 bg-brand-50',
    over: 'text-over bg-over-bg',
    ok: 'text-ok bg-ok-bg',
    neutral: 'text-slate-600 bg-slate-100',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 rounded-lg border bg-white p-4 text-left transition disabled:cursor-default ${active ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:enabled:border-brand-300'}`}
    >
      {icon && <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="block text-2xl font-semibold text-slate-900">{value}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>
}

export function Toasts() {
  const { toasts, dismiss } = useStore()
  const icon = { success: <CheckCircle2 size={16} className="text-ok" />, error: <XCircle size={16} className="text-over" />, info: <Info size={16} className="text-brand-600" /> }
  return (
    <div className="no-print fixed right-4 bottom-4 z-[60] flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm shadow-lg">
          <span className="mt-0.5">{icon[t.kind]}</span>
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Закрыть">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
