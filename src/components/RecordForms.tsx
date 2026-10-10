import { useRef, useState } from 'react'
import { FileSpreadsheet, FileUp } from 'lucide-react'
import { REGION_NAMES, settlementsOf } from '../data/regions'
import { PREMISE_TYPES, PRICE_SOURCES, type MarketOffer, type PremiseType, type PriceRecord } from '../types'
import { fmtNum, parseNumber, todayIso } from '../lib/format'
import { downloadTemplate, readSheet, validateImport, type ParsedRow } from '../lib/excel'
import { isNotified, useStore } from '../store'
import { Button, Field, Modal, Select } from './ui'

type Kind = 'prices' | 'offers'

interface F {
  region: string
  settlement: string
  premiseType: PremiseType | ''
  area: string
  monthlyCost: string
  date: string
  source: string
  address: string
  url: string
}

export function RecordForm({ kind, record, onClose }: { kind: Kind; record?: PriceRecord | MarketOffer; onClose: () => void }) {
  const store = useStore()
  const [f, setF] = useState<F>(() =>
    record
      ? {
          region: record.region,
          settlement: record.settlement,
          premiseType: record.premiseType,
          area: String(record.area),
          monthlyCost: String(record.monthlyCost),
          date: 'purchaseDate' in record ? record.purchaseDate : record.listedAt,
          source: record.source,
          address: record.address ?? '',
          url: 'url' in record ? record.url : '',
        }
      : { region: '', settlement: '', premiseType: '', area: '', monthlyCost: '', date: todayIso(), source: kind === 'prices' ? PRICE_SOURCES[0] : 'Ручной ввод', address: '', url: '' },
  )
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((s) => ({ ...s, [k]: v }))
  const area = parseNumber(f.area)
  const cost = parseNumber(f.monthlyCost)

  const e: Partial<Record<keyof F, string>> = {}
  if (!f.region) e.region = 'Выберите регион'
  if (!f.settlement.trim()) e.settlement = 'Укажите населённый пункт'
  if (!f.premiseType) e.premiseType = 'Выберите тип'
  if (!(area > 0)) e.area = 'Положительное число'
  if (!(cost > 0)) e.monthlyCost = 'Положительное число'
  if (!f.date) e.date = 'Укажите дату'
  else if (f.date > todayIso()) e.date = 'Дата не может быть в будущем'
  if (!f.source.trim()) e.source = 'Укажите источник'
  if (kind === 'offers' && f.address.trim().length < 5) e.address = 'Укажите адрес'
  if (f.url && !/^https?:\/\//i.test(f.url)) e.url = 'Ссылка должна начинаться с http:// или https://'
  const err = (k: keyof F) => (touched ? e[k] : undefined)

  const submit = async () => {
    setTouched(true)
    if (Object.keys(e).length) return
    setSaving(true)
    const common = { region: f.region, settlement: f.settlement.trim(), premiseType: f.premiseType as PremiseType, area, monthlyCost: cost, source: f.source.trim() }
    try {
      if (kind === 'prices') await store.savePrice({ ...common, purchaseDate: f.date, address: f.address.trim() }, record?.id)
      else await store.saveOffer({ ...common, listedAt: f.date, address: f.address.trim(), url: f.url.trim() }, record?.id)
      store.notify('success', record ? 'Запись обновлена' : 'Запись добавлена')
      onClose()
    } catch (x) {
      if (!isNotified(x)) store.notify('error', (x as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const title = kind === 'prices' ? (record ? 'Редактирование записи базы цен' : 'Новая запись базы цен') : record ? 'Редактирование предложения' : 'Новое рыночное предложение'

  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Регион *" error={err('region')}>
          <Select value={f.region} placeholder="Выберите регион" options={REGION_NAMES} onChange={(x) => { const s = settlementsOf(x.target.value); setF((p) => ({ ...p, region: x.target.value, settlement: s.length === 1 ? s[0] : '' })) }} />
        </Field>
        <Field label="Населённый пункт *" error={err('settlement')}>
          <input className="input" list="rf-settlements" value={f.settlement} onChange={(x) => set('settlement', x.target.value)} disabled={!f.region} />
          <datalist id="rf-settlements">{settlementsOf(f.region).map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Тип помещения *" error={err('premiseType')}>
          <Select value={f.premiseType} placeholder="Выберите тип" options={PREMISE_TYPES} onChange={(x) => set('premiseType', x.target.value as PremiseType)} />
        </Field>
        <Field label={kind === 'prices' ? 'Дата закупки *' : 'Дата объявления *'} error={err('date')}>
          <input type="date" className="input" value={f.date} max={todayIso()} onChange={(x) => set('date', x.target.value)} />
        </Field>
        <Field label="Площадь, м² *" error={err('area')}>
          <input className="input tabular" inputMode="decimal" value={f.area} onChange={(x) => set('area', x.target.value)} />
        </Field>
        <Field label="Ежемесячная стоимость, ₸ *" error={err('monthlyCost')} hint={area > 0 && cost > 0 ? `Цена за 1 м²: ${fmtNum(cost / area, 2)} ₸` : undefined}>
          <input className="input tabular" inputMode="decimal" value={f.monthlyCost} onChange={(x) => set('monthlyCost', x.target.value)} />
        </Field>
        <Field label={kind === 'offers' ? 'Адрес объекта *' : 'Адрес'} error={err('address')} className="col-span-2">
          <input className="input" value={f.address} onChange={(x) => set('address', x.target.value)} />
        </Field>
        <Field label="Источник данных *" error={err('source')} className={kind === 'offers' ? '' : 'col-span-2'}>
          <input className="input" list="rf-sources" value={f.source} onChange={(x) => set('source', x.target.value)} />
          <datalist id="rf-sources">
            {(kind === 'prices' ? PRICE_SOURCES : ['Ручной ввод', 'Krisha.kz (вручную)', 'OLX.kz (вручную)', 'Коммерческое предложение', 'Импорт из Excel']).map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        {kind === 'offers' && (
          <Field label="Ссылка на объявление" error={err('url')}>
            <input className="input" value={f.url} onChange={(x) => set('url', x.target.value)} placeholder="https://krisha.kz/a/show/…" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

export function ImportDialog({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const store = useStore()
  const ref = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<{ ok: ParsedRow[]; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File) => {
    setFileName(file.name)
    setParsed(null)
    setBusy(true)
    try {
      const rows = await readSheet(file)
      if (!rows.length) throw new Error('В файле нет строк с данными')
      setParsed(validateImport(rows, kind))
    } catch (x) {
      store.notify('error', (x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    if (!parsed?.ok.length) return
    setBusy(true)
    try {
      const n =
        kind === 'prices'
          ? await store.importPrices(parsed.ok.map((r) => ({ region: r.region, settlement: r.settlement, premiseType: r.premiseType, area: r.area, monthlyCost: r.monthlyCost, purchaseDate: r.date, source: r.source, address: r.address })))
          : await store.importOffers(parsed.ok.map((r) => ({ region: r.region, settlement: r.settlement, premiseType: r.premiseType, area: r.area, monthlyCost: r.monthlyCost, listedAt: r.date, source: r.source, address: r.address || `${r.settlement}`, url: r.url })))
      store.notify('success', `Загружено записей: ${n}`)
      onClose()
    } catch (x) {
      if (!isNotified(x)) store.notify('error', (x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={kind === 'prices' ? 'Импорт базы цен из Excel' : 'Импорт рыночных предложений из Excel'}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={doImport} disabled={busy || !parsed?.ok.length}>
            Загрузить {parsed?.ok.length ? `(${parsed.ok.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Файл .xlsx, первая строка — заголовки. Обязательные колонки: Регион, Населённый пункт, Тип помещения, Площадь, Ежемесячная стоимость, Дата
          {kind === 'prices' ? ' закупки' : ' объявления'}. Цена за 1 м² рассчитывается автоматически.
        </p>
        <div className="flex gap-2">
          <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={(x) => { const f = x.target.files?.[0]; if (f) onFile(f); x.target.value = '' }} />
          <Button variant="primary" icon={<FileUp size={15} />} onClick={() => ref.current?.click()} disabled={busy}>
            Выбрать файл
          </Button>
          <Button icon={<FileSpreadsheet size={15} />} onClick={() => downloadTemplate(kind).catch((x) => store.notify('error', (x as Error).message))}>
            Скачать шаблон
          </Button>
        </div>
        {fileName && <div className="text-slate-600">Файл: {fileName}{busy && ' — обработка…'}</div>}
        {parsed && (
          <div className="space-y-2">
            <div className="rounded-md border border-green-200 bg-ok-bg px-3 py-2 text-ok">Корректных строк: {parsed.ok.length}</div>
            {parsed.errors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-over-bg px-3 py-2 text-over">
                <div className="mb-1 font-medium">Строки с ошибками будут пропущены ({parsed.errors.length}):</div>
                <ul className="max-h-40 list-disc overflow-auto pl-5 text-xs">{parsed.errors.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
