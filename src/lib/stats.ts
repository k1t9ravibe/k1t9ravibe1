import { areaRangeOf } from '../data/regions'
import type {
  BenchmarkSnapshot,
  MarketOffer,
  PremiseType,
  PriceRecord,
  PriceVerdict,
  Settings,
} from '../types'

export function round(n: number, digits = 0): number {
  const k = 10 ** digits
  return Math.round(n * k) / k
}

export function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface Summary {
  count: number
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
}

export function summarize(values: number[]): Summary {
  return {
    count: values.length,
    mean: mean(values),
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  }
}

/** Цена за 1 м² = ежемесячная стоимость / площадь */
export function pricePerM2(monthlyCost: number, area: number): number {
  if (!(area > 0) || !(monthlyCost >= 0)) return 0
  return round(monthlyCost / area, 2)
}

export function monthsAgo(months: number, from = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() - months)
  return d
}

export function withinPeriod(dateIso: string, months: number, now = new Date()): boolean {
  const d = new Date(dateIso)
  return d >= monthsAgo(months, now) && d <= now
}

export interface Subject {
  region: string
  settlement: string
  premiseType: PremiseType
  area: number
}

interface Level {
  basis: string
  match: (r: { region: string; settlement: string; premiseType: PremiseType; area: number }) => boolean
}

function levelsFor(s: Subject): Level[] {
  const range = areaRangeOf(s.area)
  return [
    {
      basis: `${s.settlement}, ${s.premiseType.toLowerCase()}, ${range.label}`,
      match: (r) =>
        r.settlement === s.settlement && r.premiseType === s.premiseType && areaRangeOf(r.area).key === range.key,
    },
    {
      basis: `${s.settlement}, ${s.premiseType.toLowerCase()}, любая площадь`,
      match: (r) => r.settlement === s.settlement && r.premiseType === s.premiseType,
    },
    {
      basis: `${s.region}, ${s.premiseType.toLowerCase()}, любая площадь`,
      match: (r) => r.region === s.region && r.premiseType === s.premiseType,
    },
  ]
}

export const NO_DATA_TEXT = 'Недостаточно данных для формирования ценового ориентира'

/**
 * Ценовой ориентир — медиана сопоставимых фактических ставок за период (по умолчанию 12 мес.).
 * Сопоставимость сужается от «НП + тип + диапазон площади» до «регион + тип»,
 * пока не наберётся минимальное количество объектов. Рыночные предложения
 * учитываются отдельно и в ориентир не подмешиваются.
 */
export function computeBenchmark(
  subject: Subject,
  records: PriceRecord[],
  offers: MarketOffer[],
  settings: Settings,
  now = new Date(),
): BenchmarkSnapshot {
  const recent = records.filter((r) => withinPeriod(r.purchaseDate, settings.periodMonths, now))
  const levels = levelsFor(subject)

  let found: { basis: string; values: number[] } | null = null
  let bestCount = 0
  for (const level of levels) {
    const values = recent.filter(level.match).map((r) => r.pricePerM2)
    bestCount = Math.max(bestCount, values.length)
    if (values.length >= settings.minObjects) {
      found = { basis: level.basis, values }
      break
    }
  }

  const recentOffers = offers.filter((o) => withinPeriod(o.listedAt, settings.periodMonths, now))
  let marketValues: number[] = []
  for (const level of levels.slice(1)) {
    marketValues = recentOffers.filter(level.match).map((o) => o.pricePerM2)
    if (marketValues.length) break
  }

  const s = found ? summarize(found.values) : null
  return {
    median: s?.median != null ? round(s.median, 2) : null,
    mean: s?.mean != null ? round(s.mean, 2) : null,
    min: s?.min ?? null,
    max: s?.max ?? null,
    count: found ? found.values.length : bestCount,
    basis: found ? found.basis : NO_DATA_TEXT,
    marketMedian: marketValues.length ? round(median(marketValues)!, 2) : null,
    marketCount: marketValues.length,
    calculatedAt: now.toISOString(),
  }
}

export function evaluate(
  price: number,
  benchmark: BenchmarkSnapshot,
  tolerancePct: number,
): { deviation: number | null; verdict: PriceVerdict } {
  if (benchmark.median == null || benchmark.median <= 0) return { deviation: null, verdict: 'nodata' }
  const deviation = round(((price - benchmark.median) / benchmark.median) * 100, 1)
  return { deviation, verdict: deviation > tolerancePct ? 'over' : 'within' }
}

/** Группировка значений по ключу с расчётом сводных показателей */
export function groupSummaries<T>(
  items: T[],
  key: (item: T) => string,
  value: (item: T) => number,
): Map<string, Summary & { items: T[] }> {
  const groups = new Map<string, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = groups.get(k)
    if (arr) arr.push(it)
    else groups.set(k, [it])
  }
  const out = new Map<string, Summary & { items: T[] }>()
  for (const [k, arr] of groups) out.set(k, { ...summarize(arr.map(value)), items: arr })
  return out
}
