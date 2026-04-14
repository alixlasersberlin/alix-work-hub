import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import RoutePlanning from "./pages/RoutePlanning";
import Finance from "./pages/Finance";
import UserManagement from "./pages/UserManagement";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRoles && !requiredRoles.some(r => roles.includes(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auftraege" element={
          <ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance']}>
            <Orders />
          </ProtectedRoute>
        } />
        <Route path="/tourenplanung" element={
          <ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung']}>
            <RoutePlanning />
          </ProtectedRoute>
        } />
        <Route path="/finance" element={
          <ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Finance']}>
            <Finance />
          </ProtectedRoute>
        } />
        <Route path="/benutzer" element={
          <ProtectedRoute requiredRoles={['Admin', 'Super Admin']}>
            <UserManagement />
          </ProtectedRoute>
        } />
      </Route>
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
