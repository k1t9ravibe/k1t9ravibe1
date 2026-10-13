import { REGIONS } from './regions'
import { computeBenchmark, evaluate, pricePerM2, round } from '../lib/stats'
import {
  DEFAULT_SETTINGS,
  PREMISE_TYPES,
  type Application,
  type AppStatus,
  type DB,
  type MarketOffer,
  type PremiseType,
  type PriceRecord,
} from '../types'

/** Детерминированный генератор, чтобы демо-база была одинаковой при каждом сбросе */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Базовая ставка административного помещения, ₸/м² в месяц (демонстрационные значения) */
const REGION_BASE: Record<string, number> = {
  'г. Астана': 5600,
  'г. Алматы': 6500,
  'г. Шымкент': 3900,
  'Атырауская область': 5000,
  'Мангистауская область': 4300,
  'Актюбинская область': 3100,
  'Карагандинская область': 3000,
  'Павлодарская область': 2700,
  'Восточно-Казахстанская область': 2800,
  'Алматинская область': 3300,
  'Костанайская область': 2500,
  'Западно-Казахстанская область': 2700,
  'Акмолинская область': 2400,
  'Абайская область': 2400,
  'Жамбылская область': 2200,
  'Жетысуская область': 2300,
  'Кызылординская область': 2300,
  'Северо-Казахстанская область': 2100,
  'Туркестанская область': 2100,
  'Улытауская область': 2200,
}

const TYPE_K: Record<PremiseType, number> = {
  Административное: 0.95,
  Производственное: 0.62,
  Складское: 0.46,
  Техническое: 0.55,
  Другое: 0.6,
}

const TYPE_AREA: Record<PremiseType, [number, number]> = {
  Административное: [25, 700],
  Производственное: [150, 1500],
  Складское: [120, 2200],
  Техническое: [6, 120],
  Другое: [30, 300],
}

const ADDRESS_STREETS = ['ул. Абая', 'пр. Республики', 'ул. Толе би', 'ул. Кунаева', 'пр. Назарбаева', 'ул. Сатпаева', 'ул. Ауэзова', 'ул. Желтоксан', 'мкр. Самал', 'промзона Северная']
const SUPPLIERS = ['ТОО «Арна Девелопмент»', 'ИП Ахметов Б.К.', 'ТОО «Сункар Пропертиз»', 'АО «Береке Холдинг»', 'ТОО «Дала Логистик»', 'ИП Ким А.В.', 'ТОО «Нур Инвест»', 'ТОО «Алтын Склад»', 'ГКП «Жылу»', 'ТОО «KazBuild Group»']

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function genPriceRecords(r: () => number): PriceRecord[] {
  const out: PriceRecord[] = []
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]
  for (const reg of REGIONS) {
    const base = REGION_BASE[reg.name] ?? 2500
    reg.settlements.forEach((settlement, si) => {
      const cityK = si === 0 ? 1 : 0.78 - si * 0.04
      const isCity = reg.name.startsWith('г.')
      const types = si === 0 ? PREMISE_TYPES.filter((t) => t !== 'Другое' || isCity) : ['Административное', 'Складское'] as PremiseType[]
      for (const type of types) {
        // Пример из ТЗ формируется отдельно
        if (reg.name === 'Актюбинская область' && settlement === 'Актобе' && type === 'Производственное') continue
        const n = si === 0 ? 7 + Math.floor(r() * 4) : 3 + Math.floor(r() * 2)
        for (let i = 0; i < n; i++) {
          const [a0, a1] = TYPE_AREA[type]
          const area = Math.round(a0 + r() * (a1 - a0))
          const age = Math.floor(r() * 540) // до 18 месяцев: часть данных выходит за 12-месячный период
          const trend = 1 - (age / 30) * 0.008 // рост ставок ~0,8% в месяц
          const noise = 0.85 + r() * 0.3
          const ppm = Math.round(base * TYPE_K[type] * cityK * trend * noise)
          out.push({
            id: `seed-p-${out.length + 1}`,
            region: reg.name,
            settlement,
            premiseType: type,
            area,
            monthlyCost: ppm * area,
            pricePerM2: ppm,
            purchaseDate: iso(daysAgo(age)),
            source: r() < 0.7 ? 'Договор аренды (закупка из одного источника)' : 'Завершённая закупка',
            address: `${settlement}, ${pick(ADDRESS_STREETS)}, ${1 + Math.floor(r() * 180)}`,
            demo: true,
          })
        }
      }
    })
  }
  // Актобе, производственные помещения 300–1000 м²: медиана ровно 2 000 ₸/м²
  const aktobe: [number, number, number][] = [
    [320, 1850, 40],
    [450, 1950, 95],
    [600, 2000, 150],
    [380, 2050, 210],
    [520, 2200, 280],
  ]
  for (const [area, ppm, age] of aktobe) {
    out.push({
      id: `seed-p-${out.length + 1}`,
      region: 'Актюбинская область',
      settlement: 'Актобе',
      premiseType: 'Производственное',
      area,
      monthlyCost: ppm * area,
      pricePerM2: ppm,
      purchaseDate: iso(daysAgo(age)),
      source: 'Договор аренды (закупка из одного источника)',
      address: `Актобе, промзона Северная, ${area / 10}`,
      demo: true,
    })
  }
  return out
}

function genMarket(r: () => number): MarketOffer[] {
  const out: MarketOffer[] = []
  const types: PremiseType[] = ['Административное', 'Складское', 'Производственное', 'Техническое']
  for (const reg of REGIONS) {
    const base = REGION_BASE[reg.name] ?? 2500
    const settlement = reg.settlements[0]
    for (const type of types) {
      const n = 2 + Math.floor(r() * 4)
      for (let i = 0; i < n; i++) {
        const [a0, a1] = TYPE_AREA[type]
        const area = Math.round(a0 + r() * (a1 - a0))
        const ppm = Math.round(base * TYPE_K[type] * (1.02 + r() * 0.28)) // предложения обычно выше фактических ставок
        out.push({
          id: `seed-m-${out.length + 1}`,
          region: reg.name,
          settlement,
          premiseType: type,
          address: `${settlement}, ${ADDRESS_STREETS[Math.floor(r() * ADDRESS_STREETS.length)]}, ${1 + Math.floor(r() * 200)}`,
          area,
          monthlyCost: ppm * area,
          pricePerM2: ppm,
          listedAt: iso(daysAgo(Math.floor(r() * 120))),
          source: 'Ручной ввод (демо)',
          url: '',
          demo: true,
        })
      }
    }
  }
  return out
}

interface AppSpec {
  region: string
  settlement: string
  type: PremiseType
  area: number
  /** Множитель к ориентиру; null — задать стоимость напрямую */
  k: number | null
  monthly?: number
  status: AppStatus
  just?: 'requested' | 'answered'
}

const APP_SPECS: AppSpec[] = [
  { region: 'Актюбинская область', settlement: 'Актобе', type: 'Производственное', area: 300, k: null, monthly: 750000, status: 'На рассмотрении' },
  { region: 'г. Астана', settlement: 'Астана', type: 'Административное', area: 180, k: 1.32, status: 'Запрошено обоснование', just: 'requested' },
  { region: 'г. Алматы', settlement: 'Алматы', type: 'Административное', area: 95, k: 0.94, status: 'Согласовано' },
  { region: 'г. Шымкент', settlement: 'Шымкент', type: 'Складское', area: 640, k: 1.18, status: 'Обоснование представлено', just: 'answered' },
  { region: 'Карагандинская область', settlement: 'Караганда', type: 'Административное', area: 420, k: 0.97, status: 'На рассмотрении' },
  { region: 'Павлодарская область', settlement: 'Павлодар', type: 'Техническое', area: 24, k: 1.41, status: 'На рассмотрении' },
  { region: 'Атырауская область', settlement: 'Атырау', type: 'Административное', area: 72, k: 0.9, status: 'Согласовано' },
  { region: 'Мангистауская область', settlement: 'Актау', type: 'Складское', area: 900, k: 1.12, status: 'Запрошено обоснование', just: 'requested' },
  { region: 'Восточно-Казахстанская область', settlement: 'Усть-Каменогорск', type: 'Административное', area: 140, k: 0.99, status: 'На рассмотрении' },
  { region: 'Костанайская область', settlement: 'Костанай', type: 'Производственное', area: 1100, k: 0.88, status: 'Согласовано' },
  { region: 'Кызылординская область', settlement: 'Кызылорда', type: 'Другое', area: 60, k: null, monthly: 210000, status: 'На рассмотрении' },
  { region: 'Жамбылская область', settlement: 'Тараз', type: 'Административное', area: 65, k: 1.24, status: 'Отклонено' },
  { region: 'Туркестанская область', settlement: 'Туркестан', type: 'Административное', area: 260, k: 0.92, status: 'На рассмотрении' },
  { region: 'Северо-Казахстанская область', settlement: 'Петропавловск', type: 'Складское', area: 480, k: 1.07, status: 'На рассмотрении' },
  { region: 'Западно-Казахстанская область', settlement: 'Уральск', type: 'Административное', area: 110, k: 0.96, status: 'Согласовано' },
  { region: 'Акмолинская область', settlement: 'Кокшетау', type: 'Техническое', area: 18, k: 1.29, status: 'Обоснование представлено', just: 'answered' },
  { region: 'Абайская область', settlement: 'Семей', type: 'Производственное', area: 750, k: 0.95, status: 'На рассмотрении' },
  { region: 'Жетысуская область', settlement: 'Талдыкорган', type: 'Административное', area: 85, k: 1.16, status: 'На рассмотрении' },
  { region: 'Улытауская область', settlement: 'Жезказган', type: 'Складское', area: 350, k: 0.91, status: 'Согласовано' },
  { region: 'Алматинская область', settlement: 'Конаев', type: 'Административное', area: 54, k: 1.05, status: 'На рассмотрении' },
  { region: 'г. Астана', settlement: 'Астана', type: 'Складское', area: 1500, k: 0.93, status: 'Согласовано' },
  { region: 'г. Алматы', settlement: 'Алматы', type: 'Техническое', area: 12, k: 1.52, status: 'Запрошено обоснование', just: 'requested' },
  { region: 'Карагандинская область', settlement: 'Темиртау', type: 'Административное', area: 70, k: 0.98, status: 'На рассмотрении' },
  { region: 'Павлодарская область', settlement: 'Экибастуз', type: 'Складское', area: 300, k: 1.09, status: 'На рассмотрении' },
  { region: 'Актюбинская область', settlement: 'Актобе', type: 'Административное', area: 160, k: 1.0, status: 'Согласовано' },
]

function genApplications(records: PriceRecord[], offers: MarketOffer[], r: () => number): Application[] {
  const settings = DEFAULT_SETTINGS
  return APP_SPECS.map((s, i) => {
    const created = i === 0 ? daysAgo(1) : daysAgo(Math.max(2, 115 - i * 4 - Math.floor(r() * 3)))
    const bm = computeBenchmark({ region: s.region, settlement: s.settlement, premiseType: s.type, area: s.area }, records, offers, settings, created)
    // Если ориентир на дату заявки не сформирован — ставка от базового уровня региона
    const ref = bm.median ?? (REGION_BASE[s.region] ?? 2500) * TYPE_K[s.type]
    const ppmTarget = s.k != null ? ref * s.k : 0
    const monthly = s.monthly ?? Math.round((ppmTarget * s.area) / 1000) * 1000
    const ppm = pricePerM2(monthly, s.area)
    const { deviation, verdict } = evaluate(ppm, bm, settings.tolerancePct)
    const createdIso = created.toISOString()
    const app: Application = {
      id: `seed-a-${i + 1}`,
      number: `АР-2026-${String(i + 1).padStart(4, '0')}`,
      createdAt: createdIso,
      updatedAt: createdIso,
      region: s.region,
      settlement: s.settlement,
      premiseType: s.type,
      address: `${s.settlement}, ${ADDRESS_STREETS[i % ADDRESS_STREETS.length]}, ${10 + i * 7}`,
      area: s.area,
      monthlyCost: monthly,
      supplier: SUPPLIERS[i % SUPPLIERS.length],
      notes: i === 0 ? 'Помещение под размещение линейно-технического цеха. Демонстрационный пример из ТЗ.' : '',
      pricePerM2: ppm,
      benchmark: bm,
      deviation: deviation != null ? round(deviation, 1) : null,
      verdict,
      status: s.status,
      history: [{ at: createdIso, author: 'Система', text: 'Заявка создана, выполнен расчёт стоимости за 1 м²' }],
      demo: true,
    }
    if (s.just) {
      const reqAt = new Date(created.getTime() + 86400000).toISOString()
      app.justification = {
        requestedAt: reqAt,
        requestedBy: settings.userName,
        remark: `Заявленная ставка превышает ценовой ориентир на ${deviation}%. Просим представить обоснование стоимости аренды.`,
        attachments: [],
      }
      app.history.push({ at: reqAt, author: settings.userName, text: 'Направлен запрос обоснования цены' })
      if (s.just === 'answered') {
        const respAt = new Date(created.getTime() + 3 * 86400000).toISOString()
        app.justification.response =
          'Помещение расположено в непосредственной близости от узла связи, альтернативные помещения с необходимым электроснабжением отсутствуют. Прилагаем коммерческие предложения.'
        app.justification.respondedAt = respAt
        app.justification.respondedBy = 'Заказчик (филиал)'
        app.history.push({ at: respAt, author: 'Заказчик (филиал)', text: 'Представлено обоснование цены' })
      }
    }
    if (s.status === 'Согласовано' || s.status === 'Отклонено') {
      const at = new Date(created.getTime() + 5 * 86400000).toISOString()
      app.history.push({ at, author: settings.userName, text: `Статус изменён: ${s.status}` })
      app.updatedAt = at
    }
    return app
  })
}

export function buildSeed(): DB {
  const r = rng(20260101)
  const priceRecords = genPriceRecords(r)
  const marketOffers = genMarket(r)
  const applications = genApplications(priceRecords, marketOffers, r)
  return { applications, priceRecords, marketOffers, settings: { ...DEFAULT_SETTINGS } }
}
