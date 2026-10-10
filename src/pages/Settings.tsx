import { useState } from 'react'
import { Database, Plug, RotateCcw, Save, Trash2 } from 'lucide-react'
import { isNotified, useStore } from '../store'
import type { Settings as S } from '../types'
import { fmtNum } from '../lib/format'
import { Button, Card, Field, PageHeader } from '../components/ui'

export function Settings() {
  const store = useStore()
  const { db, repo } = store
  const [s, setS] = useState({ ...db.settings, minObjects: String(db.settings.minObjects), periodMonths: String(db.settings.periodMonths), tolerancePct: String(db.settings.tolerancePct) })
  const [busy, setBusy] = useState(false)

  const minObjects = Number(s.minObjects)
  const periodMonths = Number(s.periodMonths)
  const tolerancePct = Number(s.tolerancePct.replace(',', '.'))
  const errors = {
    minObjects: Number.isInteger(minObjects) && minObjects >= 1 && minObjects <= 50 ? '' : 'Целое число от 1 до 50',
    periodMonths: Number.isInteger(periodMonths) && periodMonths >= 1 && periodMonths <= 60 ? '' : 'Целое число от 1 до 60',
    tolerancePct: Number.isFinite(tolerancePct) && tolerancePct >= 0 && tolerancePct <= 100 ? '' : 'Число от 0 до 100',
    userName: s.userName.trim() ? '' : 'Укажите имя',
    organization: s.organization.trim() ? '' : 'Укажите организацию',
  }
  const invalid = Object.values(errors).some(Boolean)

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      store.notify('success', ok)
    } catch (e) {
      if (!isNotified(e)) store.notify('error', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (invalid) return store.notify('error', 'Проверьте корректность значений')
    const next: S = { minObjects, periodMonths, tolerancePct, userName: s.userName.trim(), organization: s.organization.trim() }
    run(() => store.saveSettings(next), 'Настройки сохранены. Новые параметры применяются к новым расчётам и при пересчёте заявок.')
  }

  const demoCount = db.applications.filter((a) => a.demo).length + db.priceRecords.filter((a) => a.demo).length + db.marketOffers.filter((a) => a.demo).length

  return (
    <>
      <PageHeader title="Настройки" description="Параметры расчёта ценовых ориентиров, пользователь и управление данными" />
      <div className="grid grid-cols-2 gap-4">
        <Card title="Параметры расчёта ценового ориентира" actions={<Button variant="primary" icon={<Save size={15} />} onClick={save} disabled={busy || invalid}>Сохранить</Button>}>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Период данных, мес." error={errors.periodMonths} hint="Глубина выборки фактических ставок">
              <input className="input" inputMode="numeric" value={s.periodMonths} onChange={(e) => setS({ ...s, periodMonths: e.target.value })} />
            </Field>
            <Field label="Минимум объектов" error={errors.minObjects} hint="Для формирования ориентира">
              <input className="input" inputMode="numeric" value={s.minObjects} onChange={(e) => setS({ ...s, minObjects: e.target.value })} />
            </Field>
            <Field label="Допустимое отклонение, %" error={errors.tolerancePct} hint="0 — любое превышение">
              <input className="input" inputMode="decimal" value={s.tolerancePct} onChange={(e) => setS({ ...s, tolerancePct: e.target.value })} />
            </Field>
            <Field label="Пользователь (специалист)" error={errors.userName} className="col-span-3">
              <input className="input" value={s.userName} onChange={(e) => setS({ ...s, userName: e.target.value })} />
            </Field>
            <Field label="Организация" error={errors.organization} className="col-span-3">
              <input className="input" value={s.organization} onChange={(e) => setS({ ...s, organization: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 rounded-md bg-brand-50 p-3 text-xs leading-relaxed text-slate-600">
            <b className="text-slate-800">Методика.</b> Ценовой ориентир — медиана фактических ставок аренды за 1 м² по сопоставимым объектам за выбранный период. Сопоставимость определяется последовательно: населённый пункт + тип + диапазон площади → населённый пункт + тип → регион + тип. Используется первый уровень, где набирается минимальное число объектов; иначе выводится сообщение «Недостаточно данных для формирования ценового ориентира». Рыночные предложения показываются справочно и в ориентир не включаются. Превышение не блокирует заявку.
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Хранение данных">
            <div className="flex items-start gap-3 text-sm">
              <Database size={18} className="mt-0.5 text-brand-600" />
              <div className="flex-1">
                <div className="font-medium">{repo.label}</div>
                <div className="mt-1 text-slate-600">
                  Заявок: {fmtNum(db.applications.length)} · записей базы цен: {fmtNum(db.priceRecords.length)} · рыночных предложений: {fmtNum(db.marketOffers.length)}
                </div>
                {repo.kind === 'local' && (
                  <p className="mt-2 text-xs text-slate-500">
                    Данные сохраняются в браузере и не исчезают после обновления страницы. Для совместной работы подключите Supabase (PostgreSQL): выполните скрипт <code>supabase/schema.sql</code> и задайте переменные <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code>.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Демонстрационный режим">
            <p className="mb-3 text-sm text-slate-600">Демонстрационных записей: {fmtNum(demoCount)}. Все тестовые данные помечены меткой «демо».</p>
            <div className="flex gap-2">
              <Button icon={<RotateCcw size={15} />} disabled={busy} onClick={() => window.confirm('Восстановить исходные демонстрационные данные? Все текущие данные будут заменены.') && run(() => store.resetDemo(), 'Демонстрационные данные восстановлены')}>
                Восстановить демо-данные
              </Button>
              <Button variant="danger" icon={<Trash2 size={15} />} disabled={busy || !demoCount} onClick={() => window.confirm('Удалить все демонстрационные данные? Пользовательские записи сохранятся.') && run(() => store.clearDemo(), 'Демонстрационные данные удалены')}>
                Удалить демо-данные
              </Button>
            </div>
          </Card>

          <Card title="Интеграции">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Plug size={15} className="text-slate-400" />
                <span className="flex-1">Krisha.kz — рыночные предложения</span>
                <span className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">Планируется</span>
              </li>
              <li className="flex items-center gap-2">
                <Plug size={15} className="text-slate-400" />
                <span className="flex-1">Автоматическая загрузка завершённых закупок</span>
                <span className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600">Планируется</span>
              </li>
              <li className="flex items-center gap-2">
                <Plug size={15} className="text-ok" />
                <span className="flex-1">Пополнение базы цен из согласованных заявок</span>
                <span className="rounded border border-green-200 bg-ok-bg px-2 py-0.5 text-xs text-ok">Работает</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
