import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Bot, 
  Kanban, 
  Calendar,
  Target,
  Users,
  Link2,
  Settings,
  LogOut,
  X,
  Plug
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: MessageSquare, label: 'Conversas', path: '/conversas' },
  { icon: Bot, label: 'Agente de IA', path: '/agente-ia' },
  { icon: Kanban, label: 'CRM', path: '/crm' },
  { icon: Calendar, label: 'Agendamentos', path: '/agendamentos' },
  { icon: Target, label: 'Prospecção', path: '/prospeccao' },
  { icon: Users, label: 'Contatos', path: '/contatos' },
  { icon: Link2, label: 'Conexão', path: '/conexao' },
  { icon: Plug, label: 'Integrações', path: '/integracoes' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { usuario, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar">
        <SheetHeader className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sidebar-foreground font-bold text-xl">
              ZapCRM
            </SheetTitle>
          </div>
        </SheetHeader>
        
        <div className="flex flex-col h-[calc(100%-65px)]">
          {/* Menu Items */}
          <nav className="flex-1 py-4 overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => onOpenChange(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={usuario?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {usuario?.nome?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {usuario?.nome || 'Usuário'}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {usuario?.email || ''}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
