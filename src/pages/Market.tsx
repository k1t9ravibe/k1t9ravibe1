import { useMemo, useState } from 'react'
import { Download, ExternalLink, FileUp, Pencil, Plug, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { REGION_NAMES, settlementsOf } from '../data/regions'
import { PREMISE_TYPES, type MarketOffer } from '../types'
import { isNotified, useStore } from '../store'
import { fmtDate, fmtNum, parseNumber } from '../lib/format'
import { mean, median, withinPeriod } from '../lib/stats'
import { exportRows } from '../lib/excel'
import { Button, DemoTag, Empty, PageHeader, Select } from '../components/ui'
import { ImportDialog, RecordForm } from '../components/RecordForms'

const EMPTY = { region: '', settlement: '', premiseType: '', areaMin: '', areaMax: '', costMin: '', costMax: '' }

export function Market() {
  const store = useStore()
  const { marketOffers, priceRecords, settings } = store.db
  const [fl, setFl] = useState(EMPTY)
  const [form, setForm] = useState<{ record?: MarketOffer } | null>(null)
  const [importing, setImporting] = useState(false)

  const num = (s: string) => (s.trim() ? parseNumber(s) : NaN)
  const filtered = useMemo(() => {
    const [aMin, aMax, cMin, cMax] = [num(fl.areaMin), num(fl.areaMax), num(fl.costMin), num(fl.costMax)]
    return marketOffers.filter(
      (o) =>
        (!fl.region || o.region === fl.region) &&
        (!fl.settlement || o.settlement === fl.settlement) &&
        (!fl.premiseType || o.premiseType === fl.premiseType) &&
        (Number.isNaN(aMin) || o.area >= aMin) &&
        (Number.isNaN(aMax) || o.area <= aMax) &&
        (Number.isNaN(cMin) || o.monthlyCost >= cMin) &&
        (Number.isNaN(cMax) || o.monthlyCost <= cMax),
    )
  }, [marketOffers, fl])

  // Для сопоставления — фактические ставки по тем же условиям (без диапазона стоимости)
  const factual = useMemo(
    () =>
      priceRecords
        .filter((r) => (!fl.region || r.region === fl.region) && (!fl.settlement || r.settlement === fl.settlement) && (!fl.premiseType || r.premiseType === fl.premiseType) && withinPeriod(r.purchaseDate, settings.periodMonths))
        .map((r) => r.pricePerM2),
    [priceRecords, fl, settings.periodMonths],
  )

  const values = filtered.map((o) => o.pricePerM2)
  const mMed = median(values)
  const fMed = median(factual)
  const gap = mMed != null && fMed ? ((mMed - fMed) / fMed) * 100 : null

  const remove = async (o: MarketOffer) => {
    if (!window.confirm('Удалить предложение?')) return
    try {
      await store.deleteOffers([o.id])
      store.notify('success', 'Предложение удалено')
    } catch (e) {
      if (!isNotified(e)) store.notify('error', (e as Error).message)
    }
  }

  const rangeErr = (a: string, b: string) => {
    const x = num(a)
    const y = num(b)
    return (a.trim() && Number.isNaN(x)) || (b.trim() && Number.isNaN(y)) || (!Number.isNaN(x) && !Number.isNaN(y) && x > y)
  }

  return (
    <>
      <PageHeader
        title="Рыночный мониторинг"
        description="Актуальные предложения по аренде помещений — дополнительный ориентир, не заменяющий цены заключённых договоров"
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={() => exportRows('Предложения', ['Регион', 'Населённый пункт', 'Адрес', 'Тип помещения', 'Площадь, м²', 'Стоимость в месяц, ₸', 'Цена за 1 м², ₸', 'Дата объявления', 'Источник', 'Ссылка'], filtered.map((o) => [o.region, o.settlement, o.address, o.premiseType, o.area, o.monthlyCost, o.pricePerM2, fmtDate(o.listedAt), o.source, o.url]), 'rynochnye_predlozheniya.xlsx').catch((e) => store.notify('error', (e as Error).message))}>
              Выгрузить
            </Button>
            <Button icon={<FileUp size={15} />} onClick={() => setImporting(true)}>Импорт из Excel</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({})}>Добавить предложение</Button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-4 py-3 text-sm">
        <Plug size={18} className="mt-0.5 shrink-0 text-brand-600" />
        <div className="flex-1">
          <b className="text-brand-800">Интеграция с Krisha.kz — планируется.</b>{' '}
          <span className="text-slate-600">
            Автоматическое получение объявлений будет подключено после заключения соглашения об официальном доступе к данным (API). Несанкционированный парсинг сайта не используется. До подключения предложения вносятся вручную или загружаются из Excel.
          </span>
        </div>
        <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs whitespace-nowrap text-slate-600">Статус: не подключена</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-3 lg:grid-cols-6">
        <Select value={fl.region} placeholder="Все регионы" options={REGION_NAMES} onChange={(e) => setFl({ ...fl, region: e.target.value, settlement: '' })} />
        <Select value={fl.settlement} placeholder="Все населённые пункты" options={fl.region ? settlementsOf(fl.region) : REGION_NAMES.flatMap(settlementsOf).sort()} onChange={(e) => setFl({ ...fl, settlement: e.target.value })} />
        <Select value={fl.premiseType} placeholder="Все типы помещений" options={PREMISE_TYPES} onChange={(e) => setFl({ ...fl, premiseType: e.target.value })} />
        <div className="flex items-center gap-1">
          <input className={`input tabular ${rangeErr(fl.areaMin, fl.areaMax) ? 'input-error' : ''}`} placeholder="от, м²" value={fl.areaMin} onChange={(e) => setFl({ ...fl, areaMin: e.target.value })} />
          <span className="text-slate-400">–</span>
          <input className={`input tabular ${rangeErr(fl.areaMin, fl.areaMax) ? 'input-error' : ''}`} placeholder="до, м²" value={fl.areaMax} onChange={(e) => setFl({ ...fl, areaMax: e.target.value })} />
        </div>
        <div className="flex items-center gap-1">
          <input className={`input tabular ${rangeErr(fl.costMin, fl.costMax) ? 'input-error' : ''}`} placeholder="от, ₸/мес." value={fl.costMin} onChange={(e) => setFl({ ...fl, costMin: e.target.value })} />
          <span className="text-slate-400">–</span>
          <input className={`input tabular ${rangeErr(fl.costMin, fl.costMax) ? 'input-error' : ''}`} placeholder="до, ₸/мес." value={fl.costMax} onChange={(e) => setFl({ ...fl, costMax: e.target.value })} />
        </div>
        <Button icon={<RotateCcw size={15} />} onClick={() => setFl(EMPTY)}>Сбросить</Button>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat label="Предложений" value={fmtNum(values.length)} />
        <Stat label="Средняя рыночная цена за 1 м²" value={`${fmtNum(mean(values))} ₸`} />
        <Stat label="Медианная рыночная цена за 1 м²" value={`${fmtNum(mMed)} ₸`} />
        <Stat
          label={`Медиана фактических ставок (${settings.periodMonths} мес.)`}
          value={`${fmtNum(fMed)} ₸`}
          hint={gap != null ? `Рынок ${gap >= 0 ? 'выше' : 'ниже'} фактических ставок на ${fmtNum(Math.abs(gap))}%` : 'нет данных для сравнения'}
        />
      </div>

      <div className="max-h-[calc(100vh-470px)] min-h-64 overflow-auto rounded-lg border border-line bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th">Адрес объекта</th>
              <th className="th">Тип помещения</th>
              <th className="th text-right">Площадь, м²</th>
              <th className="th text-right">Стоимость в месяц, ₸</th>
              <th className="th text-right">Цена за 1 м², ₸</th>
              <th className="th">Дата объявления</th>
              <th className="th">Источник</th>
              <th className="th">Ссылка</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-brand-50/60">
                <td className="td">{o.address}</td>
                <td className="td">{o.premiseType}</td>
                <td className="td text-right tabular">{fmtNum(o.area, 2)}</td>
                <td className="td text-right tabular">{fmtNum(o.monthlyCost)}</td>
                <td className="td text-right font-medium tabular">{fmtNum(o.pricePerM2, 2)}</td>
                <td className="td tabular">{fmtDate(o.listedAt)}</td>
                <td className="td">{o.source}{o.demo && <DemoTag />}</td>
                <td className="td">
                  {o.url ? (
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      Открыть <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="td text-right">
                  <button className="mr-2 text-slate-400 hover:text-brand-700" title="Редактировать" onClick={() => setForm({ record: o })}><Pencil size={15} /></button>
                  <button className="text-slate-400 hover:text-over" title="Удалить" onClick={() => remove(o)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <Empty>Предложения не найдены</Empty>}
      </div>

      {form && <RecordForm kind="offers" record={form.record} onClose={() => setForm(null)} />}
      {importing && <ImportDialog kind="offers" onClose={() => setImporting(false)} />}
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold tabular">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
