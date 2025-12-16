import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";
import { OnboardingComplete } from "./components/onboarding/OnboardingComplete";
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
import IntegracaoGoogleCalendar from "./pages/IntegracaoGoogleCalendar";
import Configuracoes from "./pages/Configuracoes";
import RelatorioAnuncios from "./pages/RelatorioAnuncios";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminContas from "./pages/admin/AdminContas";
import AdminContaDetalhe from "./pages/admin/AdminContaDetalhe";
import AdminPlanos from "./pages/admin/AdminPlanos";

const queryClient = new QueryClient();

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, usuario, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route 
        path="/auth" 
        element={
          user ? (
            usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />
          ) : (
            <Auth />
          )
        } 
      />
      
      {/* Rotas Admin */}
      <Route 
        path="/admin" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          !usuario?.isSuperAdmin ? <Navigate to="/dashboard" replace /> :
          <AdminDashboard />
        } 
      />
      <Route 
        path="/admin/contas" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          !usuario?.isSuperAdmin ? <Navigate to="/dashboard" replace /> :
          <AdminContas />
        } 
      />
      <Route 
        path="/admin/contas/:id" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          !usuario?.isSuperAdmin ? <Navigate to="/dashboard" replace /> :
          <AdminContaDetalhe />
        } 
      />
      <Route 
        path="/admin/planos" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          !usuario?.isSuperAdmin ? <Navigate to="/dashboard" replace /> :
          <AdminPlanos />
        } 
      />
      
      {/* Rotas CRM */}
      <Route 
        path="/dashboard" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Dashboard />
        } 
      />
      <Route 
        path="/conversas" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Conversas />
        } 
      />
      <Route 
        path="/agente-ia" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <AgenteIA />
        } 
      />
      <Route 
        path="/agente-ia/:id" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <AgenteIAEditar />
        } 
      />
      <Route 
        path="/crm" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <CRM />
        } 
      />
      <Route 
        path="/crm/configuracoes" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <CRMConfiguracoes />
        } 
      />
      <Route 
        path="/agendamentos" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Agendamentos />
        } 
      />
      <Route 
        path="/prospeccao" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Prospeccao />
        } 
      />
      <Route 
        path="/contatos" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Contatos />
        } 
      />
      <Route 
        path="/usuarios" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Usuarios />
        } 
      />
      <Route 
        path="/conexao" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Conexao />
        } 
      />
      <Route 
        path="/integracoes" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Integracoes />
        } 
      />
      <Route 
        path="/integracoes/google-calendar" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <IntegracaoGoogleCalendar />
        } 
      />
      <Route 
        path="/configuracoes" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <Configuracoes />
        } 
      />
      <Route 
        path="/relatorios/anuncios" 
        element={
          !user ? <Navigate to="/auth" replace /> :
          usuario?.isSuperAdmin ? <Navigate to="/admin" replace /> :
          <RelatorioAnuncios />
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OnboardingProvider>
            <AppRoutes />
            <OnboardingComplete />
          </OnboardingProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
