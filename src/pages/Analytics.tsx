import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X } from 'lucide-react'
import { REGIONS } from '../data/regions'
import { PREMISE_TYPES } from '../types'
import { useStore } from '../store'
import { fmtNum } from '../lib/format'
import { groupSummaries, mean, median, withinPeriod } from '../lib/stats'
import { Card, PageHeader, Select } from '../components/ui'
import { PERIODS, periodStart } from '../components/ApplicationsTable'
import { KzMap } from '../components/KzMap'

// Палитра графиков: категориальные слоты 1–2 и статусные цвета
const C = {
  s1: '#2a78d6',
  s2: '#eb6834',
  good: '#0ca30c',
  critical: '#d03b3b',
  neutral: '#c3c2b7',
  grid: '#e1e0d9',
  axis: '#898781',
}

const axisProps = { tick: { fontSize: 11, fill: C.axis }, axisLine: { stroke: '#c3c2b7' }, tickLine: false } as const
const tooltipStyle = { contentStyle: { fontSize: 12, borderRadius: 6, border: '1px solid #d6e4f5' }, formatter: (v: unknown) => `${fmtNum(Number(v))} ₸/м²` }

export function Analytics() {
  const { db } = useStore()
  const { priceRecords, applications, settings } = db
  const [region, setRegion] = useState('')
  const [type, setType] = useState('')
  const [period, setPeriod] = useState('')

  // Фактические ставки за период ориентира (по умолчанию 12 мес.)
  const recentAll = useMemo(() => priceRecords.filter((r) => withinPeriod(r.purchaseDate, settings.periodMonths) && (!type || r.premiseType === type)), [priceRecords, settings.periodMonths, type])
  const recent = useMemo(() => recentAll.filter((r) => !region || r.region === region), [recentAll, region])

  const byRegion = useMemo(() => groupSummaries(recentAll, (r) => r.region, (r) => r.pricePerM2), [recentAll])
  const ranking = useMemo(
    () =>
      REGIONS.map((r) => ({ name: r.name, short: r.short, median: byRegion.get(r.name)?.median ?? null, count: byRegion.get(r.name)?.count ?? 0 })).sort(
        (a, b) => (b.median ?? -1) - (a.median ?? -1),
      ),
    [byRegion],
  )

  const barData = useMemo(() => {
    if (region) {
      const g = groupSummaries(recent, (r) => r.settlement, (r) => r.pricePerM2)
      return [...g.entries()].map(([name, s]) => ({ name, mean: Math.round(s.mean!), median: Math.round(s.median!), count: s.count })).sort((a, b) => b.median - a.median)
    }
    return [...byRegion.entries()]
      .map(([name, s]) => ({ name: REGIONS.find((r) => r.name === name)?.short ?? name, mean: Math.round(s.mean!), median: Math.round(s.median!), count: s.count }))
      .sort((a, b) => b.median - a.median)
  }, [region, recent, byRegion])

  const monthly = useMemo(() => {
    const src = priceRecords.filter((r) => (!region || r.region === region) && (!type || r.premiseType === type))
    const out: { month: string; median: number | null; mean: number | null; count: number }[] = []
    const now = new Date()
    for (let i = 17; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const v = src.filter((r) => r.purchaseDate.startsWith(key)).map((r) => r.pricePerM2)
      out.push({ month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }), median: v.length ? Math.round(median(v)!) : null, mean: v.length ? Math.round(mean(v)!) : null, count: v.length })
    }
    return out
  }, [priceRecords, region, type])

  const byType = useMemo(() => {
    const src = priceRecords.filter((r) => withinPeriod(r.purchaseDate, settings.periodMonths) && (!region || r.region === region))
    const g = groupSummaries(src, (r) => r.premiseType, (r) => r.pricePerM2)
    return PREMISE_TYPES.filter((t) => g.has(t)).map((t) => ({ name: t, mean: Math.round(g.get(t)!.mean!), median: Math.round(g.get(t)!.median!), count: g.get(t)!.count }))
  }, [priceRecords, region, settings.periodMonths])

  const apps = useMemo(() => {
    const from = periodStart(period)
    return applications.filter((a) => (!region || a.region === region) && (!type || a.premiseType === type) && (!from || new Date(a.createdAt) >= from))
  }, [applications, region, type, period])
  const overCount = apps.filter((a) => a.verdict === 'over').length
  const withBenchmark = apps.filter((a) => a.verdict !== 'nodata').length
  const overShare = withBenchmark ? (overCount / withBenchmark) * 100 : null
  const avgOverDev = mean(apps.filter((a) => a.verdict === 'over').map((a) => a.deviation!))

  const appsByMonth = useMemo(() => {
    const m = new Map<string, { month: string; over: number; within: number; nodata: number; t: number }>()
    for (const a of apps) {
      const d = new Date(a.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!m.has(key)) m.set(key, { month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }), over: 0, within: 0, nodata: 0, t: new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
      m.get(key)![a.verdict]++
    }
    return [...m.values()].sort((a, b) => a.t - b.t)
  }, [apps])

  const sel = REGIONS.find((r) => r.name === region)
  const v = recent.map((r) => r.pricePerM2)

  return (
    <>
      <PageHeader title="Аналитика" description={`Фактические ставки аренды за последние ${settings.periodMonths} мес. и результаты проверки заявок`} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-3">
        <div className="w-72"><Select value={region} placeholder="Все регионы" options={REGIONS.map((r) => r.name)} onChange={(e) => setRegion(e.target.value)} /></div>
        <div className="w-56"><Select value={type} placeholder="Все типы помещений" options={PREMISE_TYPES} onChange={(e) => setType(e.target.value)} /></div>
        <div className="w-56"><Select value={period} placeholder="Заявки за всё время" options={PERIODS} onChange={(e) => setPeriod(e.target.value)} /></div>
        {region && (
          <button className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-sm text-brand-800 hover:bg-brand-200" onClick={() => setRegion('')}>
            {region} <X size={14} />
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-6 gap-3">
        <Kpi label="Средняя цена за 1 м²" value={`${fmtNum(mean(v))} ₸`} />
        <Kpi label="Медианная цена за 1 м²" value={`${fmtNum(median(v))} ₸`} />
        <Kpi label="Объектов в базе (период)" value={fmtNum(v.length)} />
        <Kpi label="Заявок" value={fmtNum(apps.length)} />
        <Kpi label="Заявок с превышением" value={fmtNum(overCount)} tone="over" hint={avgOverDev != null ? `среднее превышение ${fmtNum(avgOverDev)}%` : undefined} />
        <Kpi label="Доля заявок с превышением" value={overShare != null ? `${fmtNum(overShare)}%` : '—'} tone="over" hint={`от ${withBenchmark} заявок с ориентиром`} />
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-4">
        <Card
          title={`Карта: медианная цена аренды за 1 м²${type ? `, ${type.toLowerCase()}` : ''} (${settings.periodMonths} мес.)`}
          actions={<span className="text-xs text-slate-500">Нажмите на регион, чтобы выбрать его</span>}
        >
          <KzMap stats={byRegion} selected={region} onSelect={(n) => setRegion((p) => (p === n ? '' : n))} />
        </Card>
        <Card title="Рейтинг регионов по медиане" bodyClass="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th">Регион</th>
                <th className="th text-right">Медиана, ₸/м²</th>
                <th className="th text-right">Объектов</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr
                  key={r.name}
                  onClick={() => setRegion((p) => (p === r.name ? '' : r.name))}
                  className={`cursor-pointer ${region === r.name ? 'bg-brand-100' : 'hover:bg-brand-50'}`}
                >
                  <td className="td">
                    <span className="mr-2 inline-block w-5 text-right text-xs text-slate-400 tabular">{r.median != null ? i + 1 : ''}</span>
                    {r.short}
                  </td>
                  <td className="td text-right font-medium tabular">{r.median != null ? fmtNum(r.median) : <span className="text-xs font-normal text-slate-400">нет данных</span>}</td>
                  <td className="td text-right text-slate-500 tabular">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card title={sel ? `Средняя и медианная цена по населённым пунктам: ${sel.short}` : 'Средняя и медианная цена за 1 м² по регионам'}>
          <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 22 + 60)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" {...axisProps} tickFormatter={(x) => fmtNum(x)} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipStyle} cursor={{ fill: '#eef5fd' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="median" name="Медиана" fill={C.s1} radius={[0, 4, 4, 0]} />
              <Bar isAnimationActive={false} dataKey="mean" name="Средняя" fill={C.s2} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`Изменение цен по месяцам${sel ? `: ${sel.short}` : ''}${type ? `, ${type.toLowerCase()}` : ''}`}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthly} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="month" {...axisProps} interval={1} />
              <YAxis {...axisProps} width={56} tickFormatter={(x) => fmtNum(x)} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="median" name="Медиана" stroke={C.s1} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
              <Line isAnimationActive={false} type="monotone" dataKey="mean" name="Средняя" stroke={C.s2} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-slate-500">По дате закупки, последние 18 месяцев</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`Сравнение стоимости по типам помещений${sel ? `: ${sel.short}` : ''}`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byType} margin={{ left: 0, right: 16, top: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fontSize: 10, fill: C.axis }} />
              <YAxis {...axisProps} width={56} tickFormatter={(x) => fmtNum(x)} />
              <Tooltip {...tooltipStyle} cursor={{ fill: '#eef5fd' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="median" name="Медиана" fill={C.s1} radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="mean" name="Средняя" fill={C.s2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

      <Card title={`Результаты проверки заявок по месяцам${sel ? `: ${sel.short}` : ''}`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={appsByMonth} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle.contentStyle} cursor={{ fill: '#eef5fd' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar isAnimationActive={false} dataKey="over" name="С превышением" stackId="a" fill={C.critical} stroke="#fff" strokeWidth={1} />
            <Bar isAnimationActive={false} dataKey="within" name="В пределах ориентира" stackId="a" fill={C.good} stroke="#fff" strokeWidth={1} />
            <Bar isAnimationActive={false} dataKey="nodata" name="Нет ориентира" stackId="a" fill={C.neutral} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </div>
    </>
  )
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'over' }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold tabular ${tone === 'over' ? 'text-over' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}
