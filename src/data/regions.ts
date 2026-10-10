export interface Region {
  name: string
  short: string
  settlements: string[]
  /** Позиция на схематичной карте (колонка, строка, ширина) */
  map: { x: number; y: number; w?: number }
}

/** Области и города республиканского значения Республики Казахстан */
export const REGIONS: Region[] = [
  { name: 'г. Астана', short: 'Астана', settlements: ['Астана'], map: { x: 4, y: 1 } },
  { name: 'г. Алматы', short: 'Алматы', settlements: ['Алматы'], map: { x: 5, y: 4 } },
  { name: 'г. Шымкент', short: 'Шымкент', settlements: ['Шымкент'], map: { x: 2, y: 4 } },
  { name: 'Абайская область', short: 'Абай', settlements: ['Семей', 'Аягоз', 'Курчатов'], map: { x: 5, y: 1 } },
  { name: 'Акмолинская область', short: 'Акмола', settlements: ['Кокшетау', 'Степногорск', 'Щучинск'], map: { x: 3, y: 1 } },
  { name: 'Актюбинская область', short: 'Актобе', settlements: ['Актобе', 'Хромтау', 'Кандыагаш'], map: { x: 1, y: 1 } },
  { name: 'Алматинская область', short: 'Алматинская', settlements: ['Конаев', 'Талгар', 'Каскелен'], map: { x: 4, y: 3 } },
  { name: 'Атырауская область', short: 'Атырау', settlements: ['Атырау', 'Кульсары'], map: { x: 0, y: 1 } },
  { name: 'Восточно-Казахстанская область', short: 'ВКО', settlements: ['Усть-Каменогорск', 'Риддер', 'Алтай'], map: { x: 6, y: 1 } },
  { name: 'Жамбылская область', short: 'Жамбыл', settlements: ['Тараз', 'Шу', 'Жанатас'], map: { x: 3, y: 3 } },
  { name: 'Жетысуская область', short: 'Жетысу', settlements: ['Талдыкорган', 'Текели', 'Жаркент'], map: { x: 5, y: 2 } },
  { name: 'Западно-Казахстанская область', short: 'ЗКО', settlements: ['Уральск', 'Аксай'], map: { x: 0, y: 0 } },
  { name: 'Карагандинская область', short: 'Караганда', settlements: ['Караганда', 'Темиртау', 'Балхаш'], map: { x: 3, y: 2, w: 2 } },
  { name: 'Костанайская область', short: 'Костанай', settlements: ['Костанай', 'Рудный', 'Лисаковск'], map: { x: 2, y: 0 } },
  { name: 'Кызылординская область', short: 'Кызылорда', settlements: ['Кызылорда', 'Байконыр', 'Аральск'], map: { x: 1, y: 2 } },
  { name: 'Мангистауская область', short: 'Мангистау', settlements: ['Актау', 'Жанаозен'], map: { x: 0, y: 2 } },
  { name: 'Павлодарская область', short: 'Павлодар', settlements: ['Павлодар', 'Экибастуз', 'Аксу'], map: { x: 4, y: 0 } },
  { name: 'Северо-Казахстанская область', short: 'СКО', settlements: ['Петропавловск', 'Булаево'], map: { x: 3, y: 0 } },
  { name: 'Туркестанская область', short: 'Туркестан', settlements: ['Туркестан', 'Кентау', 'Сарыагаш'], map: { x: 2, y: 3 } },
  { name: 'Улытауская область', short: 'Улытау', settlements: ['Жезказган', 'Сатпаев'], map: { x: 2, y: 2 } },
]

export const REGION_NAMES = REGIONS.map((r) => r.name)

export function settlementsOf(region: string): string[] {
  return REGIONS.find((r) => r.name === region)?.settlements ?? []
}

/** Диапазоны площади, используемые для группировки сопоставимых объектов */
export const AREA_RANGES = [
  { key: '0-50', label: 'до 50 м²', min: 0, max: 50 },
  { key: '50-100', label: '50–100 м²', min: 50, max: 100 },
  { key: '100-300', label: '100–300 м²', min: 100, max: 300 },
  { key: '300-1000', label: '300–1000 м²', min: 300, max: 1000 },
  { key: '1000+', label: 'свыше 1000 м²', min: 1000, max: Infinity },
] as const

export function areaRangeOf(area: number) {
  return AREA_RANGES.find((r) => area >= r.min && area < r.max) ?? AREA_RANGES[AREA_RANGES.length - 1]
}
