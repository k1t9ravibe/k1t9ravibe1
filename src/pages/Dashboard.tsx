import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Files } from 'lucide-react'
import { useStore } from '../store'
import { OPEN_STATUSES } from '../types'
import { ApplicationsTable, EMPTY_FILTERS, FiltersBar, applyFilters, type AppFilters } from '../components/ApplicationsTable'
import { useApplicationPanels } from '../components/useApplicationPanels'
import { StatCard } from '../components/ui'

export function Dashboard() {
  const { db } = useStore()
  const [f, setF] = useState<AppFilters>(EMPTY_FILTERS)
  const panels = useApplicationPanels()

  const base = applyFilters(db.applications, f, { skipVerdict: true })
  const rows = applyFilters(db.applications, f)
  const over = base.filter((a) => a.verdict === 'over').length
  const within = base.filter((a) => a.verdict === 'within').length
  const open = base.filter((a) => OPEN_STATUSES.includes(a.status)).length
  const toggle = (v: AppFilters['verdict']) => setF((p) => ({ ...p, verdict: p.verdict === v ? '' : v }))

  return (
    <>
      <FiltersBar f={f} onChange={setF} />
      <div className="mb-4 grid grid-cols-4 gap-4">
        <StatCard label="Всего заявок" value={base.length} icon={<Files size={20} />} active={!f.verdict} onClick={() => toggle('')} />
        <StatCard label="Заявки с превышением цены" value={over} hint={base.length ? `${Math.round((over / base.length) * 100)}% от общего числа` : undefined} tone="over" icon={<AlertTriangle size={20} />} active={f.verdict === 'over'} onClick={() => toggle('over')} />
        <StatCard label="В пределах ценового ориентира" value={within} hint={base.length ? `${Math.round((within / base.length) * 100)}% от общего числа` : undefined} tone="ok" icon={<CheckCircle2 size={20} />} active={f.verdict === 'within'} onClick={() => toggle('within')} />
        <StatCard label="Заявки на рассмотрении" value={open} hint="включая запрос и представление обоснования" tone="brand" icon={<Clock size={20} />} active={f.verdict === 'open'} onClick={() => toggle('open')} />
      </div>
      <ApplicationsTable apps={rows} onOpen={panels.open} />
      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-red-200 bg-over-bg" /> превышение ценового ориентира</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-green-200 bg-ok-bg" /> в пределах ориентира</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-white" /> ориентир не сформирован</span>
        <span className="ml-auto">Показано: {rows.length}. Нажмите на строку, чтобы открыть карточку заявки.</span>
      </div>
      {panels.element}
    </>
  )
}
