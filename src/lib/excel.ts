import type { Workbook, Worksheet } from 'exceljs'
import { REGION_NAMES } from '../data/regions'
import { PREMISE_TYPES, type PremiseType } from '../types'
import { parseNumber } from './format'

type Cell = string | number | null | undefined

async function newWorkbook(): Promise<Workbook> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Мониторинг стоимости аренды'
  wb.created = new Date()
  return wb
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function styleHeader(ws: Worksheet, rowNo: number) {
  const row = ws.getRow(rowNo)
  row.font = { bold: true, color: { argb: 'FF0B3D7E' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF5FD' } }
    c.border = { bottom: { style: 'thin', color: { argb: 'FFB7D3F6' } } }
  })
}

function autoWidth(ws: Worksheet, headers: string[], rows: Cell[][]) {
  headers.forEach((h, i) => {
    const max = Math.max(h.length, ...rows.slice(0, 300).map((r) => String(r[i] ?? '').length))
    ws.getColumn(i + 1).width = Math.min(Math.max(10, max + 2), 48)
  })
}

async function save(wb: Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer()
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

export async function exportRows(sheet: string, headers: string[], rows: Cell[][], filename: string) {
  const wb = await newWorkbook()
  const ws = wb.addWorksheet(sheet.slice(0, 31))
  ws.addRow(headers)
  styleHeader(ws, 1)
  rows.forEach((r) => ws.addRow(r.map((v) => (v == null ? '' : v))))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  autoWidth(ws, headers, rows)
  await save(wb, filename)
}

/** Справка: шапка документа + таблица */
export async function exportReport(opts: { title: string; meta: [string, string][]; headers: string[]; rows: Cell[][]; footer: string[]; filename: string }) {
  const wb = await newWorkbook()
  const ws = wb.addWorksheet('Справка')
  ws.addRow([opts.title]).font = { bold: true, size: 14, color: { argb: 'FF0B3D7E' } }
  ws.mergeCells(1, 1, 1, opts.headers.length)
  ws.addRow([])
  for (const [k, v] of opts.meta) {
    const r = ws.addRow([k, v])
    r.getCell(1).font = { color: { argb: 'FF52514E' } }
    ws.mergeCells(r.number, 2, r.number, opts.headers.length)
  }
  ws.addRow([])
  const h = ws.addRow(opts.headers)
  styleHeader(ws, h.number)
  opts.rows.forEach((r) => {
    const row = ws.addRow(r.map((v) => (v == null ? '' : v)))
    row.eachCell((c, i) => {
      if (i > 2) c.numFmt = '# ##0'
    })
  })
  ws.addRow([])
  for (const line of opts.footer) {
    const r = ws.addRow([line])
    r.font = { italic: true, size: 9, color: { argb: 'FF52514E' } }
    ws.mergeCells(r.number, 1, r.number, opts.headers.length)
  }
  autoWidth(ws, opts.headers, opts.rows)
  ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 10, 32)
  await save(wb, opts.filename)
}

/** Чтение первого листа: массив объектов по заголовкам первой строки */
export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Поддерживается формат .xlsx (Excel 2007 и новее)')
  if (file.size > 10 * 1024 * 1024) throw new Error('Файл больше 10 МБ')
  const wb = await newWorkbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new Error('Не удалось прочитать файл: проверьте, что это корректный файл Excel')
  }
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('В файле нет листов')
  const headers: string[] = []
  ws.getRow(1).eachCell((c, i) => (headers[i] = String(c.text ?? '').trim()))
  const out: Record<string, unknown>[] = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const obj: Record<string, unknown> = {}
    let any = false
    headers.forEach((h, i) => {
      if (!h) return
      const v = row.getCell(i).value
      const plain = v && typeof v === 'object' && !(v instanceof Date) ? ((v as { result?: unknown; text?: unknown; hyperlink?: unknown }).result ?? (v as { text?: unknown }).text ?? (v as { hyperlink?: unknown }).hyperlink) : v
      obj[h] = plain
      if (plain != null && plain !== '') any = true
    })
    if (any) out.push({ ...obj, __row: n })
  })
  return out
}

export async function downloadTemplate(kind: 'prices' | 'offers') {
  const headers = kind === 'prices' ? PRICE_HEADERS : OFFER_HEADERS
  const sample: Cell[][] =
    kind === 'prices'
      ? [['Актюбинская область', 'Актобе', 'Производственное', 320, 640000, '15.03.2026', 'Договор аренды (закупка из одного источника)', 'Актобе, промзона Северная, 12']]
      : [['г. Астана', 'Астана', 'Офисное', 'Астана, пр. Республики, 10', 120, 780000, '01.09.2026', 'Krisha.kz (вручную)', 'https://krisha.kz/']]
  await exportRows(kind === 'prices' ? 'База цен' : 'Предложения', headers, sample, kind === 'prices' ? 'shablon_baza_cen.xlsx' : 'shablon_predlozheniya.xlsx')
}

export const PRICE_HEADERS = ['Регион', 'Населённый пункт', 'Тип помещения', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Дата закупки', 'Источник', 'Адрес']
export const OFFER_HEADERS = ['Регион', 'Населённый пункт', 'Тип помещения', 'Адрес', 'Площадь, м²', 'Ежемесячная стоимость, ₸', 'Дата объявления', 'Источник', 'Ссылка']

function pick(row: Record<string, unknown>, ...names: string[]) {
  for (const n of names) {
    const key = Object.keys(row).find((k) => k.toLowerCase().startsWith(n.toLowerCase()))
    if (key) return row[key]
  }
  return undefined
}

function parseDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10)
  const s = String(v ?? '').trim()
  let m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

export interface ParsedRow {
  region: string
  settlement: string
  premiseType: PremiseType
  area: number
  monthlyCost: number
  date: string
  source: string
  address: string
  url: string
}

/** Проверка строк импорта; возвращает корректные строки и перечень ошибок */
export function validateImport(rows: Record<string, unknown>[], kind: 'prices' | 'offers') {
  const ok: ParsedRow[] = []
  const errors: string[] = []
  for (const r of rows) {
    const n = r.__row
    const region = String(pick(r, 'Регион') ?? '').trim()
    const settlement = String(pick(r, 'Населённый', 'Населенный') ?? '').trim()
    const typeRaw = String(pick(r, 'Тип') ?? '').trim()
    const premiseType = PREMISE_TYPES.find((t) => t.toLowerCase() === typeRaw.toLowerCase())
    const area = parseNumber(pick(r, 'Площадь') as string)
    const monthlyCost = parseNumber(pick(r, 'Ежемесячная', 'Стоимость') as string)
    const date = parseDate(pick(r, 'Дата'))
    const problems: string[] = []
    const regionNorm = REGION_NAMES.find((x) => x.toLowerCase() === region.toLowerCase())
    if (!regionNorm) problems.push(`неизвестный регион «${region}»`)
    if (!settlement) problems.push('не указан населённый пункт')
    if (!premiseType) problems.push(`неизвестный тип помещения «${typeRaw}»`)
    if (!(area > 0)) problems.push('некорректная площадь')
    if (!(monthlyCost > 0)) problems.push('некорректная стоимость')
    if (!date) problems.push('некорректная дата')
    if (problems.length) {
      errors.push(`Строка ${n}: ${problems.join(', ')}`)
      continue
    }
    ok.push({
      region: regionNorm!,
      settlement,
      premiseType: premiseType!,
      area,
      monthlyCost,
      date: date!,
      source: String(pick(r, 'Источник') ?? '').trim() || (kind === 'prices' ? 'Импорт из Excel' : 'Импорт из Excel'),
      address: String(pick(r, 'Адрес') ?? '').trim(),
      url: String(pick(r, 'Ссылка') ?? '').trim(),
    })
  }
  return { ok, errors }
}
