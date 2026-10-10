import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSeed } from '../data/seed'
import { DEFAULT_SETTINGS, type DB, type Settings, type TableName } from '../types'

type Row = { id: string }

export interface Repo {
  kind: 'local' | 'supabase'
  label: string
  load(): Promise<DB>
  upsert(table: TableName, rows: Row[]): Promise<void>
  remove(table: TableName, ids: string[]): Promise<void>
  saveSettings(s: Settings): Promise<void>
  replaceAll(db: DB): Promise<void>
}

/* ---------- Локальное хранилище браузера ---------- */

const LS_KEY = 'rent-monitor-db-v1'

class LocalRepo implements Repo {
  kind = 'local' as const
  label = 'Локальная база данных браузера'
  private db: DB | null = null

  async load(): Promise<DB> {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(LS_KEY)
    } catch {
      throw new Error('Хранилище браузера недоступно (режим инкогнито или запрет сохранения данных)')
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DB
        this.db = { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
        return structuredClone(this.db)
      } catch {
        console.warn('Повреждённые данные в хранилище, выполняется повторная инициализация')
      }
    }
    this.db = buildSeed()
    this.persist()
    return structuredClone(this.db)
  }

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.db))
    } catch (e) {
      const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
      throw new Error(
        quota
          ? 'Недостаточно места в хранилище браузера. Удалите крупные вложения или подключите Supabase.'
          : 'Не удалось сохранить данные в хранилище браузера',
      )
    }
  }

  private snapshot<T>(fn: () => T): T {
    const before = JSON.stringify(this.db)
    try {
      const out = fn()
      this.persist()
      return out
    } catch (e) {
      this.db = JSON.parse(before)
      throw e
    }
  }

  async upsert(table: TableName, rows: Row[]) {
    this.snapshot(() => {
      const list = this.db![table] as Row[]
      const idx = new Map(list.map((r, i) => [r.id, i]))
      for (const row of rows) {
        const i = idx.get(row.id)
        if (i == null) list.unshift(row)
        else list[i] = row
      }
    })
  }

  async remove(table: TableName, ids: string[]) {
    const set = new Set(ids)
    this.snapshot(() => {
      ;(this.db as unknown as Record<TableName, Row[]>)[table] = (this.db![table] as Row[]).filter((r) => !set.has(r.id))
    })
  }

  async saveSettings(s: Settings) {
    this.snapshot(() => {
      this.db!.settings = s
    })
  }

  async replaceAll(db: DB) {
    this.snapshot(() => {
      this.db = structuredClone(db)
    })
  }
}

/* ---------- Supabase / PostgreSQL ---------- */

const TABLES: Record<TableName, string> = {
  applications: 'applications',
  priceRecords: 'price_records',
  marketOffers: 'market_offers',
}

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
const mapKeys = (o: Record<string, unknown>, f: (k: string) => string) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [f(k), v]))

class SupabaseRepo implements Repo {
  kind = 'supabase' as const
  label = 'Supabase (PostgreSQL)'
  private sb: SupabaseClient

  constructor(url: string, key: string) {
    this.sb = createClient(url, key)
  }

  private async selectAll(table: string): Promise<Record<string, unknown>[]> {
    const page = 1000
    const out: Record<string, unknown>[] = []
    for (let from = 0; ; from += page) {
      const { data, error } = await this.sb.from(table).select('*').range(from, from + page - 1)
      if (error) throw new Error(`Ошибка чтения таблицы ${table}: ${error.message}`)
      out.push(...(data ?? []))
      if (!data || data.length < page) break
    }
    return out
  }

  async load(): Promise<DB> {
    const [apps, prices, offers, settingsRes] = await Promise.all([
      this.selectAll(TABLES.applications),
      this.selectAll(TABLES.priceRecords),
      this.selectAll(TABLES.marketOffers),
      this.sb.from('app_settings').select('data').eq('id', 1).maybeSingle(),
    ])
    if (settingsRes.error) throw new Error(`Ошибка чтения настроек: ${settingsRes.error.message}`)
    if (!apps.length && !prices.length && !offers.length && !settingsRes.data) {
      const seed = buildSeed()
      await this.replaceAll(seed)
      return seed
    }
    const camel = (rows: Record<string, unknown>[]) => rows.map((r) => mapKeys(r, toCamel))
    const byDate = (k: string) => (a: Record<string, unknown>, b: Record<string, unknown>) =>
      String(b[k]).localeCompare(String(a[k]))
    return {
      applications: camel(apps).sort(byDate('createdAt')) as unknown as DB['applications'],
      priceRecords: camel(prices).sort(byDate('purchaseDate')) as unknown as DB['priceRecords'],
      marketOffers: camel(offers).sort(byDate('listedAt')) as unknown as DB['marketOffers'],
      settings: { ...DEFAULT_SETTINGS, ...((settingsRes.data?.data as Partial<Settings>) ?? {}) },
    }
  }

  async upsert(table: TableName, rows: Row[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => mapKeys(r as unknown as Record<string, unknown>, toSnake))
      const { error } = await this.sb.from(TABLES[table]).upsert(chunk)
      if (error) throw new Error(`Ошибка сохранения: ${error.message}`)
    }
  }

  async remove(table: TableName, ids: string[]) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await this.sb.from(TABLES[table]).delete().in('id', ids.slice(i, i + 200))
      if (error) throw new Error(`Ошибка удаления: ${error.message}`)
    }
  }

  async saveSettings(s: Settings) {
    const { error } = await this.sb.from('app_settings').upsert({ id: 1, data: s })
    if (error) throw new Error(`Ошибка сохранения настроек: ${error.message}`)
  }

  async replaceAll(db: DB) {
    for (const t of Object.keys(TABLES) as TableName[]) {
      const { error } = await this.sb.from(TABLES[t]).delete().neq('id', '')
      if (error) throw new Error(`Ошибка очистки таблицы: ${error.message}`)
      await this.upsert(t, db[t] as Row[])
    }
    await this.saveSettings(db.settings)
  }
}

export function createRepo(): Repo {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return new SupabaseRepo(url, key)
  return new LocalRepo()
}
