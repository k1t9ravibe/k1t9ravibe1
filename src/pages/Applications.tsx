import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { useStore } from '../store'
import { ApplicationsTable, EMPTY_FILTERS, FiltersBar, applyFilters, type AppFilters } from '../components/ApplicationsTable'
import { useApplicationPanels } from '../components/useApplicationPanels'
import { Button, PageHeader } from '../components/ui'
import { exportRows } from '../lib/excel'
import { fmtDate } from '../lib/format'

export function Applications() {
  const { db, notify } = useStore()
  const [f, setF] = useState<AppFilters>(EMPTY_FILTERS)
  const panels = useApplicationPanels()
  const rows = applyFilters(db.applications, f)

  const exportXlsx = async () => {
    try {
      await exportRows(
        'Заявки на аренду',
        ['№ заявки', 'Дата', 'Регион', 'Населённый пункт', 'Тип помещения', 'Адрес', 'Площадь, м²', 'Стоимость в месяц, ₸', 'Цена за 1 м², ₸', 'Ценовой ориентир, ₸', 'Отклонение, %', 'Статус', 'Поставщик', 'Демо'],
        rows.map((a) => [a.number, fmtDate(a.createdAt), a.region, a.settlement, a.premiseType, a.address, a.area, a.monthlyCost, a.pricePerM2, a.benchmark.median, a.deviation, a.status, a.supplier, a.demo ? 'да' : '']),
        'zayavki.xlsx',
      )
    } catch (e) {
      notify('error', `Не удалось сформировать файл: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <PageHeader
        title="Заявки"
        description="Формирование и просмотр заявок на аренду помещений с автоматической проверкой стоимости за 1 м²"
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={exportXlsx}>
              Выгрузить в Excel
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={panels.create}>
              Создать заявку
            </Button>
          </>
        }
      />
      <FiltersBar f={f} onChange={setF} withSearch />
      <ApplicationsTable apps={rows} onOpen={panels.open} extended />
      <div className="mt-2 text-right text-xs text-slate-500">Найдено заявок: {rows.length}</div>
      {panels.element}
    </>
  )
}
