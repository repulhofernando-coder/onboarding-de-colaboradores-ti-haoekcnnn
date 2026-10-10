import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES_INFO, type UserRole } from '@/types/onboarding'
import MundoOpenLogo from '@/components/MundoOpenLogo'
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Layers,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Shield,
  FileText,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  allowedRoles?: UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
  { label: 'Onboardings', path: '/onboardings', icon: ListTodo },
  { label: 'Colaboradores', path: '/colaboradores', icon: Users },
  { label: 'Modelos de Tarefas', path: '/modelos', icon: Layers, allowedRoles: ['admin', 'rh'] },
  { label: 'Avaliações', path: '/avaliacoes', icon: ClipboardCheck },
  { label: 'Auditoria & Logs', path: '/logs', icon: FileText, allowedRoles: ['admin'] },
  { label: 'Usuários', path: '/usuarios', icon: Shield, allowedRoles: ['admin', 'rh'] },
]

export default function Layout() {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Obter título da página dinamicamente
  const getPageTitle = () => {
    const p = location.pathname
    if (p === '/') return 'Visão Geral'
    if (p.startsWith('/onboardings/nova')) return 'Novo Onboarding'
    if (p.startsWith('/onboardings')) return 'Lista de Onboardings'
    if (p.startsWith('/colaboradores/')) return 'Detalhes do Onboarding'
    if (p.startsWith('/colaboradores')) return 'Colaboradores em Onboarding'
    if (p.startsWith('/modelos')) return 'Modelos de Tarefas por Setor'
    if (p.startsWith('/avaliacoes')) return 'Avaliações Finais dos Gestores'
    if (p.startsWith('/logs')) return 'Logs de Auditoria'
    if (p.startsWith('/usuarios')) return 'Gestão de Usuários'
    return 'Onboarding de Colaboradores'
  }

  const userInitials = (user?.name || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col antialiased text-[#1A2233]">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-gray-200/90 flex flex-col transition-transform duration-250 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Mundo Open */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-gray-100">
          <div className="flex flex-col">
            <MundoOpenLogo variant="full" size="md" subtitle="Onboarding de Colaboradores" />
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.allowedRoles || item.allowedRoles.includes(role))
            .map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              )
            })}
        </nav>

        {/* User Card & Sair in Sidebar Bottom */}
        <div className="p-3 border-t border-gray-100">
          <div className="bg-gray-50/80 rounded-lg p-2.5 mb-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900 truncate">
                {user?.name || user?.email}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-500">
                {role === 'admin' ? (
                  <Shield className="w-3 h-3 text-purple-600" />
                ) : role === 'rh' ? (
                  <UserCheck className="w-3 h-3 text-brand-600" />
                ) : (
                  <ShieldCheck className="w-3 h-3 text-teal-600" />
                )}
                <span>{ROLES_INFO[role]?.nome || 'Usuário'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-200/90 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-gray-600"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-brand-700/70 hidden sm:block">
                Mundo Open &gt; Onboarding
              </span>
              <h1 className="text-base sm:text-lg font-bold text-[#1A2233] leading-none">
                {getPageTitle()}
              </h1>
            </div>
          </div>
          {/* User Menu on Header */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-gray-800">
                {user?.name || user?.email}
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                {ROLES_INFO[role]?.nome || 'Usuário'}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label="Menu do usuário"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {userInitials}
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="font-semibold text-gray-900">{user?.name}</div>
                  <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                  <div
                    className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      ROLES_INFO[role]?.badgeClass || 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    Papel: {ROLES_INFO[role]?.nome || 'Usuário'}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>{' '}
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
