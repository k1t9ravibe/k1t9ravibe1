import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildSeed } from './data/seed'
import { createRepo, type Repo } from './lib/storage'
import { computeBenchmark, evaluate, pricePerM2 } from './lib/stats'
import { uid } from './lib/format'
import type {
  Application,
  AppStatus,
  Attachment,
  DB,
  MarketOffer,
  PremiseType,
  PriceRecord,
  Settings,
  TableName,
} from './types'

export interface ApplicationInput {
  region: string
  settlement: string
  premiseType: PremiseType
  address: string
  area: number
  monthlyCost: number
  supplier: string
  notes: string
}

export type PriceInput = Omit<PriceRecord, 'id' | 'pricePerM2' | 'demo'>
export type OfferInput = Omit<MarketOffer, 'id' | 'pricePerM2' | 'demo'>

interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

interface Store {
  db: DB
  repo: Repo
  ready: boolean
  loadError: string | null
  toasts: Toast[]
  notify(kind: Toast['kind'], text: string): void
  dismiss(id: string): void
  /** Предварительный расчёт без сохранения — для формы заявки */
  preview(input: Pick<ApplicationInput, 'region' | 'settlement' | 'premiseType' | 'area' | 'monthlyCost'>): Pick<
    Application,
    'pricePerM2' | 'benchmark' | 'deviation' | 'verdict'
  >
  createApplication(input: ApplicationInput): Promise<Application>
  updateApplication(id: string, input: ApplicationInput): Promise<Application>
  recalcApplication(id: string): Promise<void>
  setStatus(id: string, status: AppStatus): Promise<void>
  requestJustification(id: string, remark: string): Promise<void>
  respondJustification(id: string, response: string, attachments: Attachment[]): Promise<void>
  removeAttachment(appId: string, attId: string): Promise<void>
  deleteApplication(id: string): Promise<void>
  savePrice(input: PriceInput, id?: string): Promise<void>
  importPrices(rows: PriceInput[]): Promise<number>
  deletePrices(ids: string[]): Promise<void>
  saveOffer(input: OfferInput, id?: string): Promise<void>
  importOffers(rows: OfferInput[]): Promise<number>
  deleteOffers(ids: string[]): Promise<void>
  saveSettings(s: Settings): Promise<void>
  resetDemo(): Promise<void>
  clearDemo(): Promise<void>
}

const Ctx = createContext<Store | null>(null)

/** Ошибка, о которой пользователь уже уведомлён */
export const isNotified = (e: unknown) => !!(e as { notified?: boolean })?.notified
function notified(e: unknown, notify: (k: 'error', t: string) => void) {
  notify('error', (e as Error).message)
  ;(e as { notified?: boolean }).notified = true
  return e
}

const EMPTY: DB = { applications: [], priceRecords: [], marketOffers: [], settings: buildSeed().settings }

export function StoreProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => createRepo(), [])
  const [db, setDb] = useState<DB>(EMPTY)
  const dbRef = useRef(db)
  dbRef.current = db
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const notify = useCallback(
    (kind: Toast['kind'], text: string) => {
      const id = uid()
      setToasts((t) => [...t, { id, kind, text }])
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500)
    },
    [dismiss],
  )

  useEffect(() => {
    repo
      .load()
      .then((d) => {
        setDb(d)
        setReady(true)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [repo])

  /** Сохранение строк в хранилище и затем в состоянии; при ошибке — уведомление и исключение */
  const commit = useCallback(
    async (table: TableName, rows: { id: string }[]) => {
      try {
        await repo.upsert(table, rows)
      } catch (e) {
        throw notified(e, notify)
      }
      setDb((prev) => {
        const list = [...(prev[table] as { id: string }[])]
        const idx = new Map(list.map((r, i) => [r.id, i]))
        for (const r of rows) {
          const i = idx.get(r.id)
          if (i == null) list.unshift(r)
          else list[i] = r
        }
        return { ...prev, [table]: list }
      })
    },
    [repo, notify],
  )

  const drop = useCallback(
    async (table: TableName, ids: string[]) => {
      try {
        await repo.remove(table, ids)
      } catch (e) {
        throw notified(e, notify)
      }
      const set = new Set(ids)
      setDb((prev) => ({ ...prev, [table]: (prev[table] as { id: string }[]).filter((r) => !set.has(r.id)) }))
    },
    [repo, notify],
  )

  const preview: Store['preview'] = useCallback((input) => {
    const { priceRecords, marketOffers, settings } = dbRef.current
    const ppm = pricePerM2(input.monthlyCost, input.area)
    const benchmark = computeBenchmark(input, priceRecords, marketOffers, settings)
    return { pricePerM2: ppm, benchmark, ...evaluate(ppm, benchmark, settings.tolerancePct) }
  }, [])

  const getApp = (id: string) => {
    const a = dbRef.current.applications.find((x) => x.id === id)
    if (!a) throw new Error('Заявка не найдена')
    return a
  }
  const user = () => dbRef.current.settings.userName
  const stamp = (a: Application, text: string, author = user()): Application => {
    const at = new Date().toISOString()
    return { ...a, updatedAt: at, history: [...a.history, { at, author, text }] }
  }

  const nextNumber = () => {
    const year = new Date().getFullYear()
    const max = dbRef.current.applications.reduce((m, a) => {
      const match = /^АР-(\d{4})-(\d+)$/.exec(a.number)
      return match && Number(match[1]) === year ? Math.max(m, Number(match[2])) : m
    }, 0)
    return `АР-${year}-${String(max + 1).padStart(4, '0')}`
  }

  const verdictText = (a: Pick<Application, 'verdict' | 'deviation'>) =>
    a.verdict === 'over'
      ? `превышение ориентира на ${a.deviation}%`
      : a.verdict === 'within'
        ? 'в пределах ориентира'
        : 'ориентир не сформирован (недостаточно данных)'

  const createApplication: Store['createApplication'] = async (input) => {
    const now = new Date().toISOString()
    const calc = preview(input)
    const app: Application = {
      id: uid(),
      number: nextNumber(),
      createdAt: now,
      updatedAt: now,
      ...input,
      ...calc,
      status: 'На рассмотрении',
      history: [{ at: now, author: user(), text: `Заявка создана; результат проверки: ${verdictText(calc)}` }],
      demo: false,
    }
    await commit('applications', [app])
    return app
  }

  const updateApplication: Store['updateApplication'] = async (id, input) => {
    const calc = preview(input)
    const app = stamp({ ...getApp(id), ...input, ...calc }, `Данные заявки изменены, выполнен пересчёт: ${verdictText(calc)}`)
    await commit('applications', [app])
    return app
  }

  const recalcApplication: Store['recalcApplication'] = async (id) => {
    const a = getApp(id)
    const calc = preview(a)
    await commit('applications', [stamp({ ...a, ...calc }, `Выполнен пересчёт по актуальной базе цен: ${verdictText(calc)}`)])
  }

  const setStatus: Store['setStatus'] = async (id, status) => {
    const a = getApp(id)
    await commit('applications', [stamp({ ...a, status }, `Статус изменён: ${status}`)])
    // Согласованная заявка пополняет базу фактических цен
    if (status === 'Согласовано') {
      const rec: PriceRecord = {
        id: `app-${a.id}`,
        region: a.region,
        settlement: a.settlement,
        premiseType: a.premiseType,
        area: a.area,
        monthlyCost: a.monthlyCost,
        pricePerM2: a.pricePerM2,
        purchaseDate: new Date().toISOString().slice(0, 10),
        source: `Завершённая закупка (заявка ${a.number})`,
        address: a.address,
        demo: a.demo,
      }
      await commit('priceRecords', [rec])
      notify('info', `Ставка по заявке ${a.number} добавлена в базу цен`)
    } else if (dbRef.current.priceRecords.some((r) => r.id === `app-${a.id}`)) {
      await drop('priceRecords', [`app-${a.id}`])
    }
  }

  const requestJustification: Store['requestJustification'] = async (id, remark) => {
    const a = getApp(id)
    const at = new Date().toISOString()
    const next = stamp(
      {
        ...a,
        status: 'Запрошено обоснование',
        justification: { requestedAt: at, requestedBy: user(), remark, attachments: a.justification?.attachments ?? [] },
      },
      'Направлен запрос обоснования цены',
    )
    await commit('applications', [next])
  }

  const respondJustification: Store['respondJustification'] = async (id, response, attachments) => {
    const a = getApp(id)
    if (!a.justification) throw new Error('Обоснование не запрашивалось')
    const at = new Date().toISOString()
    const next = stamp(
      {
        ...a,
        status: 'Обоснование представлено',
        justification: {
          ...a.justification,
          response,
          respondedAt: at,
          respondedBy: 'Заказчик',
          attachments: [...a.justification.attachments, ...attachments],
        },
      },
      `Представлено обоснование цены${attachments.length ? ` (документов: ${attachments.length})` : ''}`,
      'Заказчик',
    )
    await commit('applications', [next])
  }

  const removeAttachment: Store['removeAttachment'] = async (appId, attId) => {
    const a = getApp(appId)
    if (!a.justification) return
    const att = a.justification.attachments.find((x) => x.id === attId)
    await commit('applications', [
      stamp(
        { ...a, justification: { ...a.justification, attachments: a.justification.attachments.filter((x) => x.id !== attId) } },
        `Удалён документ «${att?.name ?? ''}»`,
      ),
    ])
  }

  const deleteApplication: Store['deleteApplication'] = async (id) => {
    await drop('applications', [id])
    if (dbRef.current.priceRecords.some((r) => r.id === `app-${id}`)) await drop('priceRecords', [`app-${id}`])
  }

  const toPrice = (input: PriceInput, id?: string): PriceRecord => {
    const prev = id ? dbRef.current.priceRecords.find((r) => r.id === id) : undefined
    return { ...input, id: id ?? uid(), pricePerM2: pricePerM2(input.monthlyCost, input.area), demo: prev?.demo ?? false }
  }
  const toOffer = (input: OfferInput, id?: string): MarketOffer => {
    const prev = id ? dbRef.current.marketOffers.find((r) => r.id === id) : undefined
    return { ...input, id: id ?? uid(), pricePerM2: pricePerM2(input.monthlyCost, input.area), demo: prev?.demo ?? false }
  }

  const store: Store = {
    db,
    repo,
    ready,
    loadError,
    toasts,
    notify,
    dismiss,
    preview,
    createApplication,
    updateApplication,
    recalcApplication,
    setStatus,
    requestJustification,
    respondJustification,
    removeAttachment,
    deleteApplication,
    savePrice: (input, id) => commit('priceRecords', [toPrice(input, id)]),
    importPrices: async (rows) => {
      await commit('priceRecords', rows.map((r) => toPrice(r)))
      return rows.length
    },
    deletePrices: (ids) => drop('priceRecords', ids),
    saveOffer: (input, id) => commit('marketOffers', [toOffer(input, id)]),
    importOffers: async (rows) => {
      await commit('marketOffers', rows.map((r) => toOffer(r)))
      return rows.length
    },
    deleteOffers: (ids) => drop('marketOffers', ids),
    saveSettings: async (s) => {
      try {
        await repo.saveSettings(s)
      } catch (e) {
        throw notified(e, notify)
      }
      setDb((prev) => ({ ...prev, settings: s }))
    },
    resetDemo: async () => {
      const seed = buildSeed()
      seed.settings = dbRef.current.settings
      try {
        await repo.replaceAll(seed)
      } catch (e) {
        throw notified(e, notify)
      }
      setDb(seed)
    },
    clearDemo: async () => {
      const cur = dbRef.current
      const next: DB = {
        applications: cur.applications.filter((x) => !x.demo),
        priceRecords: cur.priceRecords.filter((x) => !x.demo),
        marketOffers: cur.marketOffers.filter((x) => !x.demo),
        settings: cur.settings,
      }
      try {
        await repo.replaceAll(next)
      } catch (e) {
        throw notified(e, notify)
      }
      setDb(next)
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore вне StoreProvider')
  return s
}
