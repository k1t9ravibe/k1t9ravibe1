import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileUp, Info, MessageSquareWarning, Pencil, RefreshCw, Trash2, Paperclip } from 'lucide-react'
import { APP_STATUSES, type Application, type AppStatus, type Attachment } from '../types'
import { isNotified, useStore } from '../store'
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtPct, fmtSize, uid } from '../lib/format'
import { NO_DATA_TEXT } from '../lib/stats'
import { Button, DemoTag, Drawer, Select, StatusBadge, VerdictBadge } from './ui'

const MAX_FILE = 2 * 1024 * 1024

function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ id: uid(), name: file.name, size: file.size, type: file.type, dataUrl: String(r.result), uploadedAt: new Date().toISOString() })
    r.onerror = () => reject(new Error(`Не удалось прочитать файл «${file.name}»`))
    r.readAsDataURL(file)
  })
}

export function ApplicationDrawer({ app, onClose, onEdit }: { app: Application; onClose: () => void; onEdit: (a: Application) => void }) {
  const store = useStore()
  const [busy, setBusy] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [remark, setRemark] = useState('')
  const [response, setResponse] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const bm = app.benchmark

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) store.notify('success', ok)
      return true
    } catch (e) {
      if (!isNotified(e)) store.notify('error', (e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const openRequest = () => {
    setRemark(
      app.verdict === 'over'
        ? `Заявленная стоимость аренды (${fmtNum(app.pricePerM2, 2)} ₸/м²) превышает ценовой ориентир (${fmtNum(bm.median, 2)} ₸/м²) на ${fmtNum(app.deviation, 2)}%. Просим представить обоснование цены и подтверждающие документы (коммерческие предложения, отчёт об оценке и т. п.).`
        : 'Просим представить обоснование стоимости аренды и подтверждающие документы.',
    )
    setShowRequest(true)
  }

  const sendRequest = async () => {
    if (remark.trim().length < 10) return store.notify('error', 'Текст замечания слишком короткий')
    if (await run(() => store.requestJustification(app.id, remark.trim()), 'Запрос обоснования направлен Заказчику')) setShowRequest(false)
  }

  const sendResponse = async () => {
    if (response.trim().length < 10) return store.notify('error', 'Опишите обоснование подробнее (не менее 10 символов)')
    const tooBig = files.find((f) => f.size > MAX_FILE)
    if (tooBig) return store.notify('error', `Файл «${tooBig.name}» больше 2 МБ`)
    const ok = await run(async () => {
      const atts = await Promise.all(files.map(readFile))
      await store.respondJustification(app.id, response.trim(), atts)
    }, 'Обоснование сохранено в карточке заявки')
    if (ok) {
      setResponse('')
      setFiles([])
    }
  }

  const remove = async () => {
    if (!window.confirm(`Удалить заявку ${app.number}? Действие необратимо.`)) return
    if (await run(() => store.deleteApplication(app.id), 'Заявка удалена')) onClose()
  }

  const j = app.justification

  return (
    <Drawer
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          Заявка {app.number} {app.demo && <DemoTag />}
        </span>
      }
      subtitle={`Создана ${fmtDateTime(app.createdAt)} · изменена ${fmtDateTime(app.updatedAt)}`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={app.status} />
        <VerdictBadge verdict={app.verdict} deviation={app.deviation} />
      </div>

      {app.verdict === 'over' && (
        <div className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-over-bg p-3 text-sm text-over">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <b>Внимание! Заявленная стоимость аренды превышает ценовой ориентир по данному региону на {fmtNum(app.deviation, 2)}%.</b>
            <div className="mt-1 text-xs text-red-800/80">Ценовой ориентир носит рекомендательный характер и не блокирует заявку.</div>
          </div>
        </div>
      )}
      {app.verdict === 'within' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-ok-bg p-3 text-sm text-ok">
          <CheckCircle2 size={18} /> Стоимость аренды находится в пределах ценового ориентира.
        </div>
      )}
      {app.verdict === 'nodata' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <Info size={18} /> {NO_DATA_TEXT}.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button icon={<Pencil size={15} />} onClick={() => onEdit(app)} disabled={busy}>
          Редактировать
        </Button>
        <Button icon={<RefreshCw size={15} />} onClick={() => run(() => store.recalcApplication(app.id), 'Расчёт обновлён по актуальной базе цен')} disabled={busy}>
          Пересчитать
        </Button>
        <Button variant={app.verdict === 'over' ? 'primary' : 'secondary'} icon={<MessageSquareWarning size={15} />} onClick={openRequest} disabled={busy}>
          Запросить обоснование цены
        </Button>
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove} disabled={busy}>
          Удалить
        </Button>
      </div>

      {showRequest && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <div className="label">Замечание Заказчику</div>
          <textarea className="input" rows={4} value={remark} onChange={(e) => setRemark(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <Button onClick={() => setShowRequest(false)}>Отмена</Button>
            <Button variant="primary" onClick={sendRequest} disabled={busy}>
              Направить
            </Button>
          </div>
        </div>
      )}

      <Section title="Сведения о помещении">
        <Dl
          items={[
            ['Регион', app.region],
            ['Населённый пункт', app.settlement],
            ['Тип помещения', app.premiseType],
            ['Адрес', app.address],
            ['Площадь', `${fmtNum(app.area, 2)} м²`],
            ['Ежемесячная стоимость', fmtMoney(app.monthlyCost)],
            ['Поставщик', app.supplier],
            ...(app.notes ? ([['Доп. информация', app.notes]] as [string, string][]) : []),
          ]}
        />
      </Section>

      <Section title="Расчёт и сравнение с базой цен">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Metric label="Цена за 1 м²" value={`${fmtNum(app.pricePerM2, 2)} ₸`} />
          <Metric label="Ценовой ориентир" value={bm.median != null ? `${fmtNum(bm.median, 2)} ₸` : '—'} />
          <Metric label="Отклонение" value={fmtPct(app.deviation)} tone={app.verdict} />
        </div>
        <Dl
          items={[
            ['Формула', `${fmtMoney(app.monthlyCost)} / ${fmtNum(app.area, 2)} м² = ${fmtNum(app.pricePerM2, 2)} ₸/м²`],
            ['База сравнения', bm.basis],
            ['Сопоставимых объектов', String(bm.count)],
            ['Средняя / мин. / макс.', bm.median != null ? `${fmtNum(bm.mean, 2)} / ${fmtNum(bm.min)} / ${fmtNum(bm.max)} ₸` : '—'],
            ['Рыночные предложения (справочно)', bm.marketMedian != null ? `медиана ${fmtNum(bm.marketMedian)} ₸/м², объявлений: ${bm.marketCount}` : 'нет данных'],
            ['Дата расчёта', fmtDateTime(bm.calculatedAt)],
          ]}
        />
      </Section>

      <Section title="Статус заявки">
        <div className="flex items-center gap-2">
          <Select className="max-w-xs" value={app.status} options={APP_STATUSES} onChange={(e) => run(() => store.setStatus(app.id, e.target.value as AppStatus), 'Статус обновлён')} disabled={busy} />
          <span className="text-xs text-slate-500">При согласовании ставка автоматически добавляется в базу цен</span>
        </div>
      </Section>

      {j && (
        <Section title="Обоснование цены">
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 text-xs text-amber-800">
                Замечание специалиста · {j.requestedBy} · {fmtDateTime(j.requestedAt)}
              </div>
              <div className="whitespace-pre-wrap text-slate-800">{j.remark}</div>
            </div>
            {j.response && (
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                <div className="mb-1 text-xs text-violet-700">
                  Пояснение Заказчика · {j.respondedBy} · {fmtDateTime(j.respondedAt)}
                </div>
                <div className="whitespace-pre-wrap text-slate-800">{j.response}</div>
              </div>
            )}
            {j.attachments.length > 0 && (
              <ul className="space-y-1">
                {j.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded border border-line px-2 py-1.5">
                    <Paperclip size={14} className="text-slate-400" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-slate-500">{fmtSize(a.size)}</span>
                    <a href={a.dataUrl} download={a.name} className="text-brand-600 hover:text-brand-800" title="Скачать">
                      <Download size={15} />
                    </a>
                    <button className="text-slate-400 hover:text-over" title="Удалить" onClick={() => window.confirm(`Удалить «${a.name}»?`) && run(() => store.removeAttachment(app.id, a.id))}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-md border border-line p-3">
              <div className="label">{j.response ? 'Дополнить пояснение (Заказчик)' : 'Пояснение Заказчика'}</div>
              <textarea className="input" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Обоснование стоимости аренды" />
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []))
                    e.target.value = ''
                  }}
                />
                <Button icon={<FileUp size={15} />} onClick={() => fileRef.current?.click()}>
                  Прикрепить документы
                </Button>
                <span className="flex-1 truncate text-xs text-slate-500">{files.length ? files.map((f) => f.name).join(', ') : 'PDF, DOC, XLS, изображения — до 2 МБ'}</span>
                <Button variant="primary" onClick={sendResponse} disabled={busy}>
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section title="История">
        <ol className="space-y-1.5 text-sm">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-28 shrink-0 text-xs text-slate-500 tabular">{fmtDateTime(h.at)}</span>
              <span>
                <span className="text-slate-500">{h.author}:</span> {h.text}
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <p className="text-xs text-slate-400">Дата заявки: {fmtDate(app.createdAt)}</p>
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Dl({ items }: { items: [string, string][] }) {
  return (
    <dl className="divide-y divide-line/70 rounded-md border border-line text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[200px_1fr] gap-3 px-3 py-1.5">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: Application['verdict'] }) {
  const c = tone === 'over' ? 'text-over bg-over-bg border-red-200' : tone === 'within' ? 'text-ok bg-ok-bg border-green-200' : 'text-slate-900 bg-brand-50 border-line'
  return (
    <div className={`rounded-md border p-2.5 ${c}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular">{value}</div>
    </div>
  )
}
