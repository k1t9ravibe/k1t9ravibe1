import { useRef, useState } from 'react'
import { KZ_CITIES, KZ_REGIONS, KZ_VIEWBOX } from '../data/kzMap'
import { REGIONS } from '../data/regions'
import { fmtNum } from '../lib/format'
import type { Summary } from '../lib/stats'

/** Последовательная синяя шкала: светлее — дешевле, темнее — дороже */
export const SEQ = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']
const NO_DATA = '#eef1f4'

const shortOf = (name: string) => REGIONS.find((r) => r.name === name)?.short ?? name

/** Смещение подписи города относительно маркера */
const CITY_LABEL: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' }> = {
  'г. Астана': { dx: 12, dy: 4, anchor: 'start' },
  'г. Алматы': { dx: 12, dy: 10, anchor: 'start' },
  'г. Шымкент': { dx: -12, dy: 10, anchor: 'end' },
}

interface Props {
  stats: Map<string, Summary>
  selected: string
  onSelect: (name: string) => void
}

export function KzMap({ stats, selected, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ name: string; x: number; y: number } | null>(null)

  const medians = [...stats.values()].map((s) => s.median).filter((v): v is number => v != null)
  const lo = medians.length ? Math.min(...medians) : 0
  const hi = medians.length ? Math.max(...medians) : 1
  const colorOf = (v: number | null | undefined) =>
    v == null ? NO_DATA : SEQ[Math.min(SEQ.length - 1, Math.floor(((v - lo) / (hi - lo || 1)) * SEQ.length))]
  const isDark = (fill: string) => SEQ.indexOf(fill) >= 3

  const move = (name: string) => (e: React.MouseEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    setTip({ name, x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const handlers = (name: string) => ({
    onClick: () => onSelect(name),
    onMouseMove: move(name),
    onMouseLeave: () => setTip(null),
    className: 'cursor-pointer',
  })
  const dim = (name: string) => (selected && selected !== name ? 0.4 : 1)
  const tipStats = tip ? stats.get(tip.name) : undefined

  return (
    <div ref={wrap} className="relative">
      <svg viewBox={`0 0 ${KZ_VIEWBOX.width} ${KZ_VIEWBOX.height}`} className="w-full" role="img" aria-label="Карта Казахстана: медианная цена аренды за 1 м² по регионам">
        {KZ_REGIONS.map((r) => {
          const fill = colorOf(stats.get(r.name)?.median)
          const sel = selected === r.name
          return (
            <path
              key={r.name}
              d={r.d}
              fill={fill}
              stroke={sel ? '#29266b' : tip?.name === r.name ? '#4a4fc4' : '#ffffff'}
              strokeWidth={sel ? 3 : tip?.name === r.name ? 2.5 : 1.5}
              strokeLinejoin="round"
              opacity={dim(r.name)}
              {...handlers(r.name)}
            />
          )
        })}
        {/* Выбранный регион поверх соседей, чтобы обводка не перекрывалась */}
        {selected && KZ_REGIONS.some((r) => r.name === selected) && (
          <path d={KZ_REGIONS.find((r) => r.name === selected)!.d} fill="none" stroke="#29266b" strokeWidth={3} strokeLinejoin="round" pointerEvents="none" />
        )}
        {KZ_REGIONS.map((r) => {
          const s = stats.get(r.name)
          const fill = colorOf(s?.median)
          const ink = isDark(fill) ? '#ffffff' : '#1a1838'
          return (
            <g key={r.name} pointerEvents="none" opacity={dim(r.name)} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <text x={r.label[0]} y={r.label[1] - 3} fontSize={14.5} fontWeight={600} fill={ink}>
                {shortOf(r.name)}
              </text>
              <text x={r.label[0]} y={r.label[1] + 13} fontSize={13.5} fill={ink} opacity={0.9}>
                {s?.median != null ? `${fmtNum(s.median)} ₸` : 'нет данных'}
              </text>
            </g>
          )
        })}
        {KZ_CITIES.map((c) => {
          const s = stats.get(c.name)
          const l = CITY_LABEL[c.name]
          return (
            <g key={c.name} opacity={dim(c.name)} {...handlers(c.name)}>
              <circle cx={c.at[0]} cy={c.at[1]} r={14} fill="transparent" />
              <circle cx={c.at[0]} cy={c.at[1]} r={selected === c.name ? 9 : 7.5} fill={colorOf(s?.median)} stroke={selected === c.name ? '#29266b' : '#ffffff'} strokeWidth={2.5} />
              <text
                x={c.at[0] + l.dx}
                y={c.at[1] + l.dy}
                textAnchor={l.anchor}
                fontSize={13.5}
                fontWeight={600}
                fill="#1a1838"
                stroke="#ffffff"
                strokeWidth={3.5}
                paintOrder="stroke"
                strokeLinejoin="round"
                pointerEvents="none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {shortOf(c.name)} {s?.median != null ? `${fmtNum(s.median)} ₸` : '—'}
              </text>
            </g>
          )
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(tip.x + 14, (wrap.current?.clientWidth ?? 0) - 230), top: tip.y + 14 }}
        >
          <div className="mb-1 font-semibold text-slate-900">{tip.name}</div>
          {tipStats?.median != null ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-slate-600 tabular">
              <dt>Медиана</dt><dd className="text-right font-semibold text-slate-900">{fmtNum(tipStats.median)} ₸/м²</dd>
              <dt>Средняя</dt><dd className="text-right">{fmtNum(tipStats.mean)} ₸/м²</dd>
              <dt>Мин. – макс.</dt><dd className="text-right">{fmtNum(tipStats.min)} – {fmtNum(tipStats.max)}</dd>
              <dt>Объектов</dt><dd className="text-right">{tipStats.count}</dd>
            </dl>
          ) : (
            <div className="text-slate-500">Нет данных за период</div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">Нажмите, чтобы {selected === tip.name ? 'снять выбор' : 'выбрать регион'}</div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Медиана, ₸/м²:</span>
        <span className="tabular">{fmtNum(lo)}</span>
        <div className="flex overflow-hidden rounded-sm">{SEQ.map((c) => <span key={c} className="h-2.5 w-8" style={{ background: c }} />)}</div>
        <span className="tabular">{fmtNum(hi)}</span>
        <span className="ml-3 flex items-center gap-1"><span className="h-2.5 w-4 rounded-sm border border-slate-200" style={{ background: NO_DATA }} /> нет данных</span>
        <span className="ml-3 flex items-center gap-1"><span className="size-2.5 rounded-full border-2 border-white bg-brand-400 ring-1 ring-slate-300" /> город республиканского значения</span>
      </div>
    </div>
  )
}
