import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { AREA_RANGES, REGION_NAMES, areaRangeOf, settlementsOf } from '../data/regions'
import { APP_STATUSES, PREMISE_TYPES, type Application, type PriceVerdict } from '../types'
import { fmtDate, fmtNum, fmtPct } from '../lib/format'
import { Button, DemoTag, Empty, Select, StatusBadge } from './ui'

export interface AppFilters {
  region: string
  settlement: string
  premiseType: string
  areaRange: string
  period: string
  status: string
  verdict: PriceVerdict | 'open' | ''
  search: string
}

export const EMPTY_FILTERS: AppFilters = { region: '', settlement: '', premiseType: '', areaRange: '', period: '', status: '', verdict: '', search: '' }

export const PERIODS = [
  { value: '30', label: 'Последние 30 дней' },
  { value: '90', label: 'Последние 90 дней' },
  { value: '180', label: 'Последние 6 месяцев' },
  { value: '365', label: 'Последние 12 месяцев' },
  { value: 'year', label: 'Текущий год' },
]

export function periodStart(period: string): Date | null {
  if (!period) return null
  if (period === 'year') return new Date(new Date().getFullYear(), 0, 1)
  const d = new Date()
  d.setDate(d.getDate() - Number(period))
  return d
}

export function applyFilters(apps: Application[], f: AppFilters, opts: { skipVerdict?: boolean } = {}) {
  const from = periodStart(f.period)
  const q = f.search.trim().toLowerCase()
  return apps.filter(
    (a) =>
      (!f.region || a.region === f.region) &&
      (!f.settlement || a.settlement === f.settlement) &&
      (!f.premiseType || a.premiseType === f.premiseType) &&
      (!f.areaRange || areaRangeOf(a.area).key === f.areaRange) &&
      (!from || new Date(a.createdAt) >= from) &&
      (!f.status || a.status === f.status) &&
      (opts.skipVerdict || !f.verdict || (f.verdict === 'open' ? ['На рассмотрении', 'Запрошено обоснование', 'Обоснование представлено'].includes(a.status) : a.verdict === f.verdict)) &&
      (!q || [a.number, a.supplier, a.address, a.settlement].some((s) => s.toLowerCase().includes(q))),
  )
}

export function FiltersBar({ f, onChange, withSearch }: { f: AppFilters; onChange: (f: AppFilters) => void; withSearch?: boolean }) {
  const set = (patch: Partial<AppFilters>) => onChange({ ...f, ...patch })
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-3 lg:grid-cols-4 xl:grid-cols-7">
      <Select value={f.region} placeholder="Все регионы" options={REGION_NAMES} onChange={(e) => set({ region: e.target.value, settlement: '' })} aria-label="Регион" />
      <Select value={f.settlement} placeholder="Все населённые пункты" options={f.region ? settlementsOf(f.region) : REGION_NAMES.flatMap(settlementsOf).sort()} onChange={(e) => set({ settlement: e.target.value })} aria-label="Населённый пункт" />
      <Select value={f.premiseType} placeholder="Все типы помещений" options={PREMISE_TYPES} onChange={(e) => set({ premiseType: e.target.value })} aria-label="Тип помещения" />
      <Select value={f.areaRange} placeholder="Любая площадь" options={AREA_RANGES.map((r) => ({ value: r.key, label: r.label }))} onChange={(e) => set({ areaRange: e.target.value })} aria-label="Площадь" />
      <Select value={f.period} placeholder="За всё время" options={PERIODS} onChange={(e) => set({ period: e.target.value })} aria-label="Период" />
      <Select value={f.status} placeholder="Все статусы" options={APP_STATUSES} onChange={(e) => set({ status: e.target.value })} aria-label="Статус" />
      <div className="flex gap-2">
        {withSearch && <input className="input" placeholder="№, поставщик, адрес" value={f.search} onChange={(e) => set({ search: e.target.value })} />}
        <Button icon={<RotateCcw size={15} />} onClick={() => onChange(EMPTY_FILTERS)} title="Сбросить фильтры" className={withSearch ? 'px-2.5' : 'w-full'}>
          {withSearch ? '' : 'Сбросить'}
        </Button>
      </div>
    </div>
  )
}

type SortKey = 'number' | 'region' | 'settlement' | 'premiseType' | 'area' | 'pricePerM2' | 'benchmark' | 'deviation' | 'status' | 'createdAt' | 'supplier'

const COLS: { key: SortKey; label: string; num?: boolean; extended?: boolean }[] = [
  { key: 'number', label: '№ заявки' },
  { key: 'createdAt', label: 'Дата', extended: true },
  { key: 'region', label: 'Регион' },
  { key: 'settlement', label: 'Населённый пункт' },
  { key: 'premiseType', label: 'Тип помещения' },
  { key: 'supplier', label: 'Поставщик', extended: true },
  { key: 'area', label: 'Площадь, м²', num: true },
  { key: 'pricePerM2', label: 'Цена за 1 м², ₸', num: true },
  { key: 'benchmark', label: 'Ценовой ориентир, ₸', num: true },
  { key: 'deviation', label: 'Отклонение', num: true },
  { key: 'status', label: 'Статус' },
]

const val = (a: Application, k: SortKey): string | number =>
  k === 'benchmark' ? (a.benchmark.median ?? -Infinity) : k === 'deviation' ? (a.deviation ?? -Infinity) : (a[k] as string | number)

export function ApplicationsTable({ apps, onOpen, extended }: { apps: Application[]; onOpen: (a: Application) => void; extended?: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'number', dir: -1 })
  const rows = useMemo(
    () =>
      [...apps].sort((a, b) => {
        const x = val(a, sort.key)
        const y = val(b, sort.key)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru')) * sort.dir
      }),
    [apps, sort],
  )
  const cols = COLS.filter((c) => !c.extended || extended)

  return (
    <div className="max-h-[calc(100vh-330px)] min-h-64 overflow-auto rounded-lg border border-line bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`th cursor-pointer select-none hover:text-brand-700 ${c.num ? 'text-right' : ''}`} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (-s.dir as 1 | -1) : 1 }))}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sort.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const bg = a.verdict === 'over' ? 'bg-over-bg hover:bg-red-100/70' : a.verdict === 'within' ? 'bg-ok-bg hover:bg-green-100/70' : 'bg-white hover:bg-brand-50'
            const devColor = a.verdict === 'over' ? 'text-over font-semibold' : a.verdict === 'within' ? 'text-ok' : 'text-slate-400'
            return (
              <tr key={a.id} className={`cursor-pointer ${bg}`} onClick={() => onOpen(a)}>
                <td className="td font-medium text-brand-700">
                  {a.number}
                  {a.demo && <DemoTag />}
                </td>
                {extended && <td className="td tabular">{fmtDate(a.createdAt)}</td>}
                <td className="td">{a.region}</td>
                <td className="td">{a.settlement}</td>
                <td className="td">{a.premiseType}</td>
                {extended && <td className="td max-w-56 truncate">{a.supplier}</td>}
                <td className="td text-right tabular">{fmtNum(a.area, 2)}</td>
                <td className="td text-right tabular">{fmtNum(a.pricePerM2, 2)}</td>
                <td className="td text-right tabular">{a.benchmark.median != null ? fmtNum(a.benchmark.median, 2) : <span className="text-xs text-slate-400">нет данных</span>}</td>
                <td className={`td text-right tabular ${devColor}`}>{fmtPct(a.deviation)}</td>
                <td className="td">
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && <Empty>Заявки не найдены. Измените условия фильтра.</Empty>}
    </div>
  )
}
