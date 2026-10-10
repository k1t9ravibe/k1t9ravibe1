import { useRef, useState } from 'react'
import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { AREA_RANGES, REGION_NAMES, areaRangeOf, settlementsOf } from '../data/regions'
import { PREMISE_TYPES, type PriceRecord } from '../types'
import { useStore } from '../store'
import { fmtDate, fmtDateTime, fmtNum, todayIso } from '../lib/format'
import { groupSummaries, monthsAgo, summarize } from '../lib/stats'
import { exportReport } from '../lib/excel'
import { exportPdf } from '../lib/pdf'
import { Button, Card, Field, PageHeader, Select } from '../components/ui'

interface Params {
  region: string
  settlement: string
  premiseType: string
  areaRange: string
  from: string
  to: string
}

interface Report {
  number: string
  createdAt: string
  params: Params
  rows: { region: string; type: string; mean: number; median: number; count: number }[]
  total: ReturnType<typeof summarize>
  hasDemo: boolean
}

export function Reports() {
  const { db, notify } = useStore()
  const { settings } = db
  const [p, setP] = useState<Params>({ region: '', settlement: '', premiseType: '', areaRange: '', from: monthsAgo(settings.periodMonths).toISOString().slice(0, 10), to: todayIso() })
  const [report, setReport] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)

  const periodErr = !p.from || !p.to ? 'Укажите период' : p.from > p.to ? 'Дата начала позже даты окончания' : ''

  const build = () => {
    if (periodErr) return notify('error', periodErr)
    const recs = db.priceRecords.filter(
      (r: PriceRecord) =>
        (!p.region || r.region === p.region) &&
        (!p.settlement || r.settlement === p.settlement) &&
        (!p.premiseType || r.premiseType === p.premiseType) &&
        (!p.areaRange || areaRangeOf(r.area).key === p.areaRange) &&
        r.purchaseDate >= p.from &&
        r.purchaseDate <= p.to,
    )
    const g = groupSummaries(recs, (r) => `${r.region}\u0001${r.premiseType}`, (r) => r.pricePerM2)
    const rows = [...g.entries()]
      .map(([k, s]) => {
        const [region, type] = k.split('\u0001')
        return { region, type, mean: s.mean!, median: s.median!, count: s.count }
      })
      .sort((a, b) => a.region.localeCompare(b.region, 'ru') || PREMISE_TYPES.indexOf(a.type as never) - PREMISE_TYPES.indexOf(b.type as never))
    const now = new Date()
    setReport({
      number: `СП-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`,
      createdAt: now.toISOString(),
      params: { ...p },
      rows,
      total: summarize(recs.map((r) => r.pricePerM2)),
      hasDemo: recs.some((r) => r.demo),
    })
    if (!rows.length) notify('info', 'По выбранным параметрам данные не найдены')
  }

  const paramList = (r: Report): [string, string][] => [
    ['Регион', r.params.region || 'Все регионы'],
    ['Населённый пункт', r.params.settlement || 'Все населённые пункты'],
    ['Тип помещения', r.params.premiseType || 'Все типы'],
    ['Диапазон площади', AREA_RANGES.find((a) => a.key === r.params.areaRange)?.label ?? 'Любая площадь'],
    ['Период', `с ${fmtDate(r.params.from)} по ${fmtDate(r.params.to)}`],
  ]
  const sourceText = `База цен информационной системы «Мониторинг стоимости аренды» (${settings.organization}): фактические ставки по договорам аренды и завершённым закупкам. Рыночные предложения в расчёт не включены.`
  const methodText = 'Цена за 1 м² = ежемесячная стоимость аренды / площадь помещения. Медиана — серединное значение упорядоченного ряда ставок.'

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      notify('error', `Не удалось сформировать файл: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const toExcel = () =>
    report &&
    run(() =>
      exportReport({
        title: `Справка о стоимости аренды помещений за 1 м² № ${report.number}`,
        meta: [['Дата формирования', fmtDateTime(report.createdAt)], ...paramList(report), ['Источник информации', sourceText]],
        headers: ['Регион', 'Тип помещения', 'Средняя цена, ₸/м²', 'Медианная цена, ₸/м²', 'Количество объектов'],
        rows: [...report.rows.map((r) => [r.region, r.type, Math.round(r.mean), Math.round(r.median), r.count]), ['Итого', '', Math.round(report.total.mean ?? 0), Math.round(report.total.median ?? 0), report.total.count]],
        footer: [methodText, ...(report.hasDemo ? ['Справка сформирована с использованием демонстрационных данных.'] : [])],
        filename: `spravka_${report.number.replace('СП', 'SP')}.xlsx`,
      }),
    )

  const toPdf = () => report && docRef.current && run(() => exportPdf(docRef.current!, `spravka_${report.number.replace('СП', 'SP')}.pdf`))

  return (
    <>
      <PageHeader title="Справки" description="Формирование справки о стоимости аренды за 1 м² на основе базы фактических цен" />
      <Card className="no-print mb-4" title="Параметры справки">
        <div className="grid grid-cols-7 items-end gap-3">
          <Field label="Регион">
            <Select value={p.region} placeholder="Все регионы" options={REGION_NAMES} onChange={(e) => setP({ ...p, region: e.target.value, settlement: '' })} />
          </Field>
          <Field label="Населённый пункт">
            <Select value={p.settlement} placeholder="Все" options={p.region ? settlementsOf(p.region) : []} onChange={(e) => setP({ ...p, settlement: e.target.value })} disabled={!p.region} />
          </Field>
          <Field label="Тип помещения">
            <Select value={p.premiseType} placeholder="Все типы" options={PREMISE_TYPES} onChange={(e) => setP({ ...p, premiseType: e.target.value })} />
          </Field>
          <Field label="Диапазон площади">
            <Select value={p.areaRange} placeholder="Любая площадь" options={AREA_RANGES.map((r) => ({ value: r.key, label: r.label }))} onChange={(e) => setP({ ...p, areaRange: e.target.value })} />
          </Field>
          <Field label="Период" error={periodErr || undefined} className="col-span-2">
            <div className="flex gap-1">
              <input type="date" className="input px-1.5" value={p.from} max={p.to} onChange={(e) => setP({ ...p, from: e.target.value })} />
              <input type="date" className="input px-1.5" value={p.to} min={p.from} onChange={(e) => setP({ ...p, to: e.target.value })} />
            </div>
          </Field>
          <Button variant="primary" icon={<FileText size={16} />} onClick={build} className={periodErr ? 'mb-5' : ''}>
            Сформировать справку
          </Button>
        </div>
      </Card>

      {report && (
        <>
          <div className="no-print mb-3 flex justify-end gap-2">
            <Button icon={<FileSpreadsheet size={15} />} onClick={toExcel} disabled={busy}>Скачать Excel</Button>
            <Button icon={<FileDown size={15} />} onClick={toPdf} disabled={busy}>Скачать PDF</Button>
            <Button icon={<Printer size={15} />} onClick={() => window.print()}>Печать</Button>
          </div>

          <div id="print-area" ref={docRef} className="mx-auto max-w-[900px] border border-line bg-white px-14 py-12 text-[13px] leading-relaxed text-slate-900 shadow-sm">
            <div className="flex items-start justify-between border-b-2 border-brand-700 pb-3">
              <div>
                <div className="text-base font-bold text-brand-800">{settings.organization}</div>
                <div className="text-xs text-slate-500">Информационная система «Мониторинг стоимости аренды»</div>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div>№ {report.number}</div>
                <div>от {fmtDate(report.createdAt)}</div>
              </div>
            </div>

            <h2 className="mt-6 text-center text-lg font-bold">СПРАВКА</h2>
            <p className="mb-6 text-center font-semibold">о стоимости аренды помещений за 1 м²</p>

            <table className="mb-5 w-full text-[13px]">
              <tbody>
                <tr><td className="w-56 py-0.5 text-slate-600">Дата и время формирования</td><td>{fmtDateTime(report.createdAt)}</td></tr>
                {paramList(report).map(([k, v]) => (
                  <tr key={k}><td className="py-0.5 text-slate-600">{k}</td><td>{v}</td></tr>
                ))}
              </tbody>
            </table>

            {report.rows.length ? (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-brand-50">
                    {['Регион', 'Тип помещения', 'Средняя цена, ₸/м²', 'Медианная цена, ₸/м²', 'Количество объектов'].map((h, i) => (
                      <th key={h} className={`border border-slate-300 px-2 py-1.5 font-semibold ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr key={r.region + r.type}>
                      <td className="border border-slate-300 px-2 py-1">{r.region}</td>
                      <td className="border border-slate-300 px-2 py-1">{r.type}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right tabular">{fmtNum(r.mean)}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-semibold tabular">{fmtNum(r.median)}</td>
                      <td className="border border-slate-300 px-2 py-1 text-right tabular">{r.count}{r.count < settings.minObjects ? '*' : ''}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="border border-slate-300 px-2 py-1" colSpan={2}>Итого по выборке</td>
                    <td className="border border-slate-300 px-2 py-1 text-right tabular">{fmtNum(report.total.mean)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right tabular">{fmtNum(report.total.median)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right tabular">{report.total.count}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="rounded border border-slate-300 p-4 text-center text-slate-600">По выбранным параметрам сведения в базе цен отсутствуют.</p>
            )}

            <div className="mt-5 space-y-1.5 text-xs text-slate-600">
              <p><b>Источник информации:</b> {sourceText}</p>
              <p><b>Методика:</b> {methodText}</p>
              {report.rows.some((r) => r.count < settings.minObjects) && <p>* Количество объектов меньше {settings.minObjects} — данных недостаточно для формирования ценового ориентира, значение носит информационный характер.</p>}
              <p>Ценовые ориентиры носят рекомендательный характер.</p>
              {report.hasDemo && <p className="font-semibold text-over">Справка сформирована с использованием демонстрационных данных.</p>}
            </div>

            <div className="mt-12 grid grid-cols-2 gap-10 text-[13px]">
              <div>
                <div className="text-slate-600">Исполнитель</div>
                <div className="mt-6 border-b border-slate-400" />
                <div className="mt-1 text-xs text-slate-500">{settings.userName} (подпись, Ф.И.О.)</div>
              </div>
              <div>
                <div className="text-slate-600">Дата</div>
                <div className="mt-6 border-b border-slate-400" />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
