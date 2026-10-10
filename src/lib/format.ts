const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

export const fmtNum = (n: number | null | undefined, digits: 0 | 2 = 0) =>
  n == null || Number.isNaN(n) ? '—' : (digits ? nf2 : nf0).format(n)

export const fmtMoney = (n: number | null | undefined) => (n == null ? '—' : `${nf0.format(n)} ₸`)

export const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${nf2.format(n)}%`

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ru-RU') : '—'

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} КБ` : `${(bytes / 1024 / 1024).toFixed(1)} МБ`

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const todayIso = () => new Date().toISOString().slice(0, 10)

/** Разбор числа из пользовательского ввода: допускает пробелы и запятую */
export function parseNumber(v: string | number | null | undefined): number {
  if (typeof v === 'number') return v
  if (v == null) return NaN
  const s = String(v).replace(/[\s ₸]/g, '').replace(',', '.')
  return s === '' ? NaN : Number(s)
}
