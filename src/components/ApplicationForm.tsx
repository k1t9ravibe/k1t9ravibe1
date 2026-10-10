import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { REGION_NAMES, settlementsOf } from '../data/regions'
import { PREMISE_TYPES, type Application, type PremiseType } from '../types'
import { useStore, type ApplicationInput } from '../store'
import { fmtMoney, fmtNum, fmtPct, parseNumber } from '../lib/format'
import { NO_DATA_TEXT } from '../lib/stats'
import { Button, Field, Modal, Select } from './ui'

interface FormState {
  region: string
  settlement: string
  premiseType: PremiseType | ''
  address: string
  area: string
  monthlyCost: string
  supplier: string
  notes: string
}

const toState = (a?: Application): FormState =>
  a
    ? { ...a, area: String(a.area), monthlyCost: String(a.monthlyCost) }
    : { region: '', settlement: '', premiseType: '', address: '', area: '', monthlyCost: '', supplier: '', notes: '' }

function validate(f: FormState) {
  const e: Partial<Record<keyof FormState, string>> = {}
  if (!f.region) e.region = 'Выберите регион'
  if (!f.settlement.trim()) e.settlement = 'Укажите населённый пункт'
  if (!f.premiseType) e.premiseType = 'Выберите тип помещения'
  if (f.address.trim().length < 5) e.address = 'Укажите адрес помещения'
  const area = parseNumber(f.area)
  if (!Number.isFinite(area) || area <= 0) e.area = 'Площадь должна быть положительным числом'
  else if (area > 100000) e.area = 'Проверьте площадь: значение больше 100 000 м²'
  const cost = parseNumber(f.monthlyCost)
  if (!Number.isFinite(cost) || cost <= 0) e.monthlyCost = 'Стоимость должна быть положительным числом'
  else if (cost > 10_000_000_000) e.monthlyCost = 'Слишком большое значение'
  if (f.supplier.trim().length < 2) e.supplier = 'Укажите наименование поставщика'
  return e
}

export function ApplicationForm({ app, onClose, onSaved }: { app?: Application; onClose: () => void; onSaved: (a: Application) => void }) {
  const { preview, createApplication, updateApplication } = useStore()
  const [f, setF] = useState<FormState>(() => toState(app))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const errors = validate(f)
  const err = (k: keyof FormState) => (touched ? errors[k] : undefined)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const area = parseNumber(f.area)
  const cost = parseNumber(f.monthlyCost)
  const canCalc = f.region && f.settlement && f.premiseType && area > 0 && cost > 0
  const calc = useMemo(
    () => (canCalc ? preview({ region: f.region, settlement: f.settlement.trim(), premiseType: f.premiseType as PremiseType, area, monthlyCost: cost }) : null),
    [canCalc, f.region, f.settlement, f.premiseType, area, cost, preview],
  )

  const settlements = settlementsOf(f.region)

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length) return
    const input: ApplicationInput = {
      region: f.region,
      settlement: f.settlement.trim(),
      premiseType: f.premiseType as PremiseType,
      address: f.address.trim(),
      area,
      monthlyCost: cost,
      supplier: f.supplier.trim(),
      notes: f.notes.trim(),
    }
    setSaving(true)
    try {
      const saved = app ? await updateApplication(app.id, input) : await createApplication(input)
      onSaved(saved)
    } catch {
      /* ошибка уже показана уведомлением */
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={app ? `Редактирование заявки ${app.number}` : 'Создание заявки на аренду'}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Сохранение…' : app ? 'Сохранить и пересчитать' : 'Создать заявку'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Регион *" error={err('region')}>
            <Select
              className={err('region') ? 'input-error' : ''}
              value={f.region}
              placeholder="Выберите регион"
              options={REGION_NAMES}
              onChange={(e) => {
                const r = e.target.value
                const s = settlementsOf(r)
                setF((p) => ({ ...p, region: r, settlement: s.length === 1 ? s[0] : '' }))
              }}
            />
          </Field>
          <Field label="Населённый пункт *" error={err('settlement')}>
            <input className={`input ${err('settlement') ? 'input-error' : ''}`} list="settlements" value={f.settlement} onChange={(e) => set('settlement', e.target.value)} placeholder="Выберите или введите" disabled={!f.region} />
            <datalist id="settlements">
              {settlements.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Тип помещения *" error={err('premiseType')}>
            <Select className={err('premiseType') ? 'input-error' : ''} value={f.premiseType} placeholder="Выберите тип" options={PREMISE_TYPES} onChange={(e) => set('premiseType', e.target.value as PremiseType)} />
          </Field>
          <Field label="Адрес помещения *" error={err('address')}>
            <input className={`input ${err('address') ? 'input-error' : ''}`} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Город, улица, дом" />
          </Field>
          <Field label="Площадь помещения, м² *" error={err('area')}>
            <input className={`input tabular ${err('area') ? 'input-error' : ''}`} inputMode="decimal" value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="300" />
          </Field>
          <Field label="Ежемесячная стоимость аренды, ₸ *" error={err('monthlyCost')}>
            <input className={`input tabular ${err('monthlyCost') ? 'input-error' : ''}`} inputMode="decimal" value={f.monthlyCost} onChange={(e) => set('monthlyCost', e.target.value)} placeholder="750 000" />
          </Field>
          <Field label="Наименование потенциального поставщика *" error={err('supplier')} className="col-span-2">
            <input className={`input ${err('supplier') ? 'input-error' : ''}`} value={f.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="ТОО «…»" />
          </Field>
          <Field label="Дополнительная информация" className="col-span-2">
            <textarea className="input" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Назначение помещения, особые условия, коммунальные платежи и т. п." />
          </Field>
        </div>

        <CalcPanel calc={calc} />
      </div>
    </Modal>
  )
}

function CalcPanel({ calc }: { calc: ReturnType<ReturnType<typeof useStore>['preview']> | null }) {
  return (
    <div className="rounded-lg border border-line bg-brand-50/60 p-4">
      <div className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Автоматический расчёт</div>
      {!calc ? (
        <p className="text-sm text-slate-500">Заполните регион, населённый пункт, тип, площадь и стоимость — расчёт выполнится автоматически.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <Row label="Цена за 1 м²" value={`${fmtNum(calc.pricePerM2, 2)} ₸`} strong />
          <Row label="Ценовой ориентир (медиана)" value={calc.benchmark.median != null ? `${fmtNum(calc.benchmark.median, 2)} ₸` : '—'} />
          <Row label="Отклонение" value={fmtPct(calc.deviation)} tone={calc.verdict === 'over' ? 'over' : calc.verdict === 'within' ? 'ok' : undefined} strong />
          <div className="border-t border-line pt-2 text-xs text-slate-500">
            {calc.benchmark.median != null ? (
              <>
                База сравнения: {calc.benchmark.basis}. Объектов: {calc.benchmark.count}.
                {calc.benchmark.marketMedian != null && <> Медиана рыночных предложений: {fmtMoney(calc.benchmark.marketMedian)}/м² (справочно).</>}
              </>
            ) : (
              <>Найдено сопоставимых объектов: {calc.benchmark.count}</>
            )}
          </div>
          {calc.verdict === 'over' && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-over-bg p-2.5 text-xs text-over">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                <b>Внимание!</b> Заявленная стоимость превышает ценовой ориентир на {fmtNum(calc.deviation, 2)}%. Заявку можно сохранить — ориентир носит рекомендательный характер.
              </span>
            </div>
          )}
          {calc.verdict === 'within' && (
            <div className="flex gap-2 rounded-md border border-green-200 bg-ok-bg p-2.5 text-xs text-ok">
              <CheckCircle2 size={16} className="shrink-0" /> Стоимость в пределах ценового ориентира.
            </div>
          )}
          {calc.verdict === 'nodata' && (
            <div className="flex gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
              <Info size={16} className="shrink-0" /> {NO_DATA_TEXT}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'over' | 'ok' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular ${strong ? 'text-base font-semibold' : ''} ${tone === 'over' ? 'text-over' : tone === 'ok' ? 'text-ok' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}
