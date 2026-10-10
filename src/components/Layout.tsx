import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, Database, FileText, FolderOpen, LayoutDashboard, Search, Settings, HardDrive, Cloud } from 'lucide-react'
import { useStore } from '../store'
import { Toasts } from './ui'

const NAV = [
  { to: '/', label: 'Главная', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Заявки', icon: FolderOpen },
  { to: '/prices', label: 'База цен', icon: Database },
  { to: '/market', label: 'Рыночный мониторинг', icon: Search },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/reports', label: 'Справки', icon: FileText },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

export function Layout() {
  const { repo, db } = useStore()
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-brand-900 text-white">
        <div className="p-3">
          <div className="flex items-center gap-2.5 rounded-lg border-2 border-white px-2.5 py-2">
            <img src={`${import.meta.env.BASE_URL}kt-emblem.png`} alt="Казахтелеком" className="size-9 shrink-0 object-contain" />
            <div className="text-[12px] leading-tight font-semibold text-white">
              Система мониторинга стоимости аренды <span className="font-normal whitespace-nowrap text-white/70">ver 0.1</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 pb-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${isActive ? 'bg-white font-semibold text-brand-900' : 'text-white hover:bg-white/10'}`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/15 p-3 text-xs text-white/70">
          <div className="flex items-center gap-1.5">
            {repo.kind === 'supabase' ? <Cloud size={13} /> : <HardDrive size={13} />}
            {repo.label}
          </div>
          <div className="mt-1">Пользователь: {db.settings.userName}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-6">
          <div className="text-lg font-semibold text-brand-800">Мониторинг стоимости аренды</div>
          <div className="text-xs text-slate-500">Закупки способом из одного источника · {db.settings.organization}</div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  )
}
