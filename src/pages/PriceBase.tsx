import { useMemo, useState } from 'react'
import { Download, FileUp, Pencil, Plus, RotateCcw, Trash2, Info } from 'lucide-react'
import { AREA_RANGES, REGION_NAMES, areaRangeOf, settlementsOf } from '../data/regions'
import { PREMISE_TYPES, type PriceRecord } from '../types'
import { isNotified, useStore } from '../store'
import { fmtDate, fmtNum } from '../lib/format'
import { NO_DATA_TEXT, groupSummaries, median, withinPeriod } from '../lib/stats'
import { exportRows } from '../lib/excel'
import { Button, Card, DemoTag, Empty, PageHeader, Select } from '../components/ui'
import { ImportDialog, RecordForm } from '../components/RecordForms'

type Dim = 'region' | 'settlement' | 'premiseType' | 'areaRange'
const DIMS: { key: Dim; label: string }[] = [
  { key: 'region', label: 'Регион' },
  { key: 'settlement', label: 'Населённый пункт' },
  { key: 'premiseType', label: 'Тип помещения' },
  { key: 'areaRange', label: 'Диапазон площади' },
]
const dimValue = (r: PriceRecord, d: Dim) => (d === 'areaRange' ? areaRangeOf(r.area).label : r[d])

export function PriceBase() {
  const store = useStore()
  const { priceRecords, settings } = store.db
  const [tab, setTab] = useState<'summary' | 'records'>('summary')
  const [fl, setFl] = useState({ region: '', settlement: '', premiseType: '', areaRange: '', recentOnly: false, search: '' })
  const [dims, setDims] = useState<Dim[]>(['region', 'settlement', 'premiseType', 'areaRange'])
  const [form, setForm] = useState<{ record?: PriceRecord } | null>(null)
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = fl.search.trim().toLowerCase()
    return priceRecords.filter(
      (r) =>
        (!fl.region || r.region === fl.region) &&
        (!fl.settlement || r.settlement === fl.settlement) &&
        (!fl.premiseType || r.premiseType === fl.premiseType) &&
        (!fl.areaRange || areaRangeOf(r.area).key === fl.areaRange) &&
        (!fl.recentOnly || withinPeriod(r.purchaseDate, settings.periodMonths)) &&
        (!q || [r.address ?? '', r.source, r.settlement].some((s) => s.toLowerCase().includes(q))),
    )
  }, [priceRecords, fl, settings.periodMonths])

  const groups = useMemo(() => {
    const g = groupSummaries(filtered, (r) => dims.map((d) => dimValue(r, d)).join('\u0001'), (r) => r.pricePerM2)
    return [...g.entries()]
      .map(([k, s]) => {
        const recent = s.items.filter((r) => withinPeriod(r.purchaseDate, settings.periodMonths)).map((r) => r.pricePerM2)
        return { parts: k.split('\u0001'), ...s, recentCount: recent.length, benchmark: recent.length >= settings.minObjects ? median(recent) : null }
      })
      .sort((a, b) => a.parts.join(' ').localeCompare(b.parts.join(' '), 'ru'))
  }, [filtered, dims, settings])

  const totals = useMemo(() => {
    const v = filtered.map((r) => r.pricePerM2)
    return { count: v.length, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, median: median(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null }
  }, [filtered])

  const toggleDim = (d: Dim) => setDims((p) => (p.includes(d) ? (p.length > 1 ? p.filter((x) => x !== d) : p) : DIMS.map((x) => x.key).filter((k) => p.includes(k) || k === d)))

  const removeSelected = async (ids: string[]) => {
    if (!ids.length || !window.confirm(`Удалить записей: ${ids.length}?`)) return
    try {
      await store.deletePrices(ids)
      setSelected(new Set())
      store.notify('success', 'Записи удалены')
    } catch (e) {
      if (!isNotified(e)) store.notify('error', (e as Error).message)
    }
  }

  const exportXlsx = () =>
    (tab === 'records'
      ? exportRows('База цен', ['Регион', 'Населённый пункт', 'Тип помещения', 'Адрес', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Цена за 1 м², ₸', 'Дата закупки', 'Источник', 'Демо'], filtered.map((r) => [r.region, r.settlement, r.premiseType, r.address, r.area, r.monthlyCost, r.pricePerM2, fmtDate(r.purchaseDate), r.source, r.demo ? 'да' : '']), 'baza_cen.xlsx')
      : exportRows('Сводка', [...dims.map((d) => DIMS.find((x) => x.key === d)!.label), 'Средняя, ₸/м²', 'Медиана, ₸/м²', 'Мин., ₸/м²', 'Макс., ₸/м²', 'Объектов', `Ориентир (${settings.periodMonths} мес.), ₸/м²`], groups.map((g) => [...g.parts, Math.round(g.mean!), Math.round(g.median!), g.min, g.max, g.count, g.benchmark != null ? Math.round(g.benchmark) : NO_DATA_TEXT]), 'baza_cen_svodka.xlsx')
    ).catch((e) => store.notify('error', (e as Error).message))

  return (
    <>
      <PageHeader
        title="База цен"
        description="Накопительная база фактических ставок аренды помещений по Казахстану"
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportXlsx}>Выгрузить</Button>
            <Button icon={<FileUp size={15} />} onClick={() => setImporting(true)}>Импорт из Excel</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>Добавить запись</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-3 lg:grid-cols-6">
        <Select value={fl.region} placeholder="Все регионы" options={REGION_NAMES} onChange={(e) => setFl({ ...fl, region: e.target.value, settlement: '' })} />
        <Select value={fl.settlement} placeholder="Все населённые пункты" options={fl.region ? settlementsOf(fl.region) : REGION_NAMES.flatMap(settlementsOf).sort()} onChange={(e) => setFl({ ...fl, settlement: e.target.value })} />
        <Select value={fl.premiseType} placeholder="Все типы помещений" options={PREMISE_TYPES} onChange={(e) => setFl({ ...fl, premiseType: e.target.value })} />
        <Select value={fl.areaRange} placeholder="Любая площадь" options={AREA_RANGES.map((r) => ({ value: r.key, label: r.label }))} onChange={(e) => setFl({ ...fl, areaRange: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={fl.recentOnly} onChange={(e) => setFl({ ...fl, recentOnly: e.target.checked })} />
          Только за {settings.periodMonths} мес.
        </label>
        <div className="flex gap-2">
          <input className="input" placeholder="Адрес, источник" value={fl.search} onChange={(e) => setFl({ ...fl, search: e.target.value })} />
          <Button className="px-2.5" title="Сбросить" icon={<RotateCcw size={15} />} onClick={() => setFl({ region: '', settlement: '', premiseType: '', areaRange: '', recentOnly: false, search: '' })} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-5 gap-3">
        {[
          ['Количество объектов', fmtNum(totals.count)],
          ['Средняя цена за 1 м²', `${fmtNum(totals.mean)} ₸`],
          ['Медианная цена за 1 м²', `${fmtNum(totals.median)} ₸`],
          ['Минимальная цена', `${fmtNum(totals.min)} ₸`],
          ['Максимальная цена', `${fmtNum(totals.max)} ₸`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-white px-4 py-3">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="text-xl font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1 border-b border-line">
        {(
          [
            ['summary', 'Группировка и ценовые ориентиры'],
            ['records', `Записи (${filtered.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {l}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 pb-1 text-xs text-slate-500">
          <Info size={13} /> Ориентир — медиана сопоставимых ставок за {settings.periodMonths} мес. при наличии не менее {settings.minObjects} объектов. Согласованные заявки пополняют базу автоматически.
        </span>
      </div>

      {tab === 'summary' ? (
        <Card
          bodyClass=""
          title="Группировка по"
          actions={DIMS.map((d) => (
            <label key={d.key} className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" className="accent-brand-600" checked={dims.includes(d.key)} onChange={() => toggleDim(d.key)} />
              {d.label}
            </label>
          ))}
        >
          <div className="max-h-[calc(100vh-430px)] min-h-64 overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {dims.map((d) => <th key={d} className="th">{DIMS.find((x) => x.key === d)!.label}</th>)}
                  <th className="th text-right">Средняя, ₸/м²</th>
                  <th className="th text-right">Медиана, ₸/м²</th>
                  <th className="th text-right">Мин., ₸/м²</th>
                  <th className="th text-right">Макс., ₸/м²</th>
                  <th className="th text-right">Объектов</th>
                  <th className="th text-right">Ценовой ориентир, ₸/м²</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.parts.join('|')} className="hover:bg-brand-50/60">
                    {g.parts.map((p, i) => <td key={i} className="td">{p}</td>)}
                    <td className="td text-right tabular">{fmtNum(g.mean)}</td>
                    <td className="td text-right tabular">{fmtNum(g.median)}</td>
                    <td className="td text-right tabular">{fmtNum(g.min)}</td>
                    <td className="td text-right tabular">{fmtNum(g.max)}</td>
                    <td className="td text-right tabular">{g.count}</td>
                    <td className="td text-right tabular">
                      {g.benchmark != null ? <b className="text-brand-800">{fmtNum(g.benchmark)}</b> : <span className="text-[11px] text-slate-500">{NO_DATA_TEXT} <span className="text-slate-400">({g.recentCount} из {settings.minObjects})</span></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!groups.length && <Empty>Нет данных по выбранным условиям</Empty>}
          </div>
        </Card>
      ) : (
        <div className="rounded-lg border border-line bg-white">
          {selected.size > 0 && (
            <div className="flex items-center gap-3 border-b border-line bg-brand-50 px-3 py-2 text-sm">
              Выбрано: {selected.size}
              <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => removeSelected([...selected])}>Удалить выбранные</Button>
            </div>
          )}
          <div className="max-h-[calc(100vh-430px)] min-h-64 overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th w-8">
                    <input type="checkbox" className="accent-brand-600" checked={filtered.length > 0 && filtered.slice(0, 500).every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(filtered.slice(0, 500).map((r) => r.id)) : new Set())} />
                  </th>
                  <th className="th">Регион</th>
                  <th className="th">Населённый пункт</th>
                  <th className="th">Тип помещения</th>
                  <th className="th text-right">Площадь, м²</th>
                  <th className="th text-right">Стоимость в месяц, ₸</th>
                  <th className="th text-right">Цена за 1 м², ₸</th>
                  <th className="th">Дата закупки</th>
                  <th className="th">Источник данных</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
                  <tr key={r.id} className="hover:bg-brand-50/60">
                    <td className="td">
                      <input type="checkbox" className="accent-brand-600" checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n })} />
                    </td>
                    <td className="td">{r.region}</td>
                    <td className="td">{r.settlement}</td>
                    <td className="td">{r.premiseType}</td>
                    <td className="td text-right tabular">{fmtNum(r.area, 2)}</td>
                    <td className="td text-right tabular">{fmtNum(r.monthlyCost)}</td>
                    <td className="td text-right font-medium tabular">{fmtNum(r.pricePerM2, 2)}</td>
                    <td className="td tabular">{fmtDate(r.purchaseDate)}</td>
                    <td className="td max-w-72 truncate" title={r.source}>{r.source}{r.demo && <DemoTag />}</td>
                    <td className="td text-right">
                      <button className="mr-2 text-slate-400 hover:text-brand-700" title="Редактировать" onClick={() => setForm({ record: r })}><Pencil size={15} /></button>
                      <button className="text-slate-400 hover:text-over" title="Удалить" onClick={() => removeSelected([r.id])}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty>Записи не найдены</Empty>}
            {filtered.length > 500 && <div className="p-3 text-center text-xs text-slate-500">Показаны первые 500 из {filtered.length} записей — уточните фильтр или выгрузите в Excel.</div>}
          </div>
        </div>
      )}

      {form && <RecordForm kind="prices" record={form.record} onClose={() => setForm(null)} />}
      {importing && <ImportDialog kind="prices" onClose={() => setImporting(false)} />}
    </>
  )
}
