import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Kanban,
  Calendar,
  Users,
  UserCog,
  Plug,
  Puzzle,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Megaphone,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Conversas', path: '/conversas' },
  { icon: Bot, label: 'Agente IA', path: '/agente-ia' },
  { icon: Kanban, label: 'CRM', path: '/crm' },
  { icon: Calendar, label: 'Agendamentos', path: '/agendamentos' },
  { icon: Users, label: 'Contatos', path: '/contatos' },
  { icon: Megaphone, label: 'Anúncios Meta', path: '/relatorios/anuncios' },
  { icon: UserCog, label: 'Usuários', path: '/usuarios' },
  { icon: Plug, label: 'Conexão', path: '/conexao' },
  { icon: Puzzle, label: 'Integrações', path: '/integracoes' },
  { icon: CreditCard, label: 'Minha Assinatura', path: '/minha-assinatura' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { usuario, signOut } = useAuth();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300',
        'bg-sidebar border-r border-sidebar-border',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">ZapCRM</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-sidebar-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-sidebar-foreground" />
          )}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex flex-col gap-1 p-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200',
                'hover:bg-sidebar-accent',
                isActive && 'bg-primary/10 text-primary',
                !isActive && 'text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
              {!collapsed && (
                <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
                  {item.label}
                </span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-2">
        {!collapsed && usuario && (
          <div className="mb-2 px-3 py-2">
            <p className="text-sm font-medium text-foreground truncate">{usuario.nome}</p>
            <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
            'text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive'
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
}
