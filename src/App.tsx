import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Conversas from "./pages/Conversas";
import AgenteIA from "./pages/AgenteIA";
import AgenteIAEditar from "./pages/AgenteIAEditar";
import CRM from "./pages/CRM";
import CRMConfiguracoes from "./pages/CRMConfiguracoes";
import Agendamentos from "./pages/Agendamentos";
import Prospeccao from "./pages/Prospeccao";
import Contatos from "./pages/Contatos";
import Usuarios from "./pages/Usuarios";
import Conexao from "./pages/Conexao";
import Integracoes from "./pages/Integracoes";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/conversas" element={<ProtectedRoute><Conversas /></ProtectedRoute>} />
            <Route path="/agente-ia" element={<ProtectedRoute><AgenteIA /></ProtectedRoute>} />
            <Route path="/agente-ia/:id" element={<ProtectedRoute><AgenteIAEditar /></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
            <Route path="/crm/configuracoes" element={<ProtectedRoute><CRMConfiguracoes /></ProtectedRoute>} />
            <Route path="/agendamentos" element={<ProtectedRoute><Agendamentos /></ProtectedRoute>} />
            <Route path="/prospeccao" element={<ProtectedRoute><Prospeccao /></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><Contatos /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
            <Route path="/conexao" element={<ProtectedRoute><Conexao /></ProtectedRoute>} />
            <Route path="/integracoes" element={<ProtectedRoute><Integracoes /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
