export const PREMISE_TYPES = [
  'Административное',
  'Производственное',
  'Складское',
  'Другое',
] as const
export type PremiseType = (typeof PREMISE_TYPES)[number]

/** Приводит тип помещения к справочнику: офисные учитываются как административные, технические — как производственные, жилые не учитываются (undefined) */
export function normalizePremiseType(raw: string): PremiseType | undefined {
  const t = raw.trim().toLowerCase()
  if (t === 'офисное') return 'Административное'
  if (t === 'техническое') return 'Производственное'
  return PREMISE_TYPES.find((x) => x.toLowerCase() === t)
}

export const APP_STATUSES = [
  'На рассмотрении',
  'Запрошено обоснование',
  'Обоснование представлено',
  'Согласовано',
  'Отклонено',
] as const
export type AppStatus = (typeof APP_STATUSES)[number]

/** Статусы, при которых заявка ещё не закрыта */
export const OPEN_STATUSES: AppStatus[] = ['На рассмотрении', 'Запрошено обоснование', 'Обоснование представлено']

/** Результат сравнения с ценовым ориентиром */
export type PriceVerdict = 'over' | 'within' | 'nodata'

export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  dataUrl: string
  uploadedAt: string
}

export interface HistoryEntry {
  at: string
  author: string
  text: string
}

export interface Justification {
  requestedAt: string
  requestedBy: string
  remark: string
  response?: string
  respondedAt?: string
  respondedBy?: string
  attachments: Attachment[]
}

/** Снимок ценового ориентира, зафиксированный при расчёте заявки */
export interface BenchmarkSnapshot {
  median: number | null
  mean: number | null
  min: number | null
  max: number | null
  count: number
  /** Уровень сопоставимости, на котором найдено достаточно данных */
  basis: string
  marketMedian: number | null
  marketCount: number
  calculatedAt: string
}

export interface Application {
  id: string
  number: string
  createdAt: string
  updatedAt: string
  region: string
  settlement: string
  premiseType: PremiseType
  address: string
  area: number
  monthlyCost: number
  supplier: string
  notes: string
  pricePerM2: number
  benchmark: BenchmarkSnapshot
  /** Отклонение от ориентира, % (null — нет ориентира) */
  deviation: number | null
  verdict: PriceVerdict
  status: AppStatus
  justification?: Justification
  history: HistoryEntry[]
  demo: boolean
}

export const PRICE_SOURCES = [
  'Договор аренды (закупка из одного источника)',
  'Завершённая закупка',
  'Импорт из Excel',
  'Ручной ввод',
] as const

export interface PriceRecord {
  id: string
  region: string
  settlement: string
  premiseType: PremiseType
  area: number
  monthlyCost: number
  pricePerM2: number
  purchaseDate: string
  source: string
  address?: string
  demo: boolean
}

export interface MarketOffer {
  id: string
  region: string
  settlement: string
  premiseType: PremiseType
  address: string
  area: number
  monthlyCost: number
  pricePerM2: number
  listedAt: string
  source: string
  url: string
  demo: boolean
}

export interface Settings {
  /** Минимальное число сопоставимых объектов для формирования ориентира */
  minObjects: number
  /** Глубина периода для ориентира, мес. */
  periodMonths: number
  /** Допустимое отклонение, % — до этого порога цена считается соответствующей */
  tolerancePct: number
  /** Имя текущего пользователя (специалиста) */
  userName: string
  organization: string
}

export const DEFAULT_SETTINGS: Settings = {
  minObjects: 3,
  periodMonths: 12,
  tolerancePct: 0,
  userName: 'Специалист по закупкам',
  organization: 'АО «Казахтелеком»',
}

export interface DB {
  applications: Application[]
  priceRecords: PriceRecord[]
  marketOffers: MarketOffer[]
  settings: Settings
}

export type TableName = 'applications' | 'priceRecords' | 'marketOffers'
