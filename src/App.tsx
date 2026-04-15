import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import AccountBlocked from "./pages/AccountBlocked";
import AccessDenied from "./pages/AccessDenied";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import PriorityList from "./pages/PriorityList";
import RoutePlanning from "./pages/RoutePlanning";
import RoutePlanDetail from "./pages/RoutePlanDetail";
import RoutePlanForm from "./pages/RoutePlanForm";
import Finance from "./pages/Finance";
import FinanceDetail from "./pages/FinanceDetail";
import FinanceForm from "./pages/FinanceForm";
import UserManagement from "./pages/UserManagement";
import ImportManagement from "./pages/ImportManagement";
import SystemMonitoring from "./pages/SystemMonitoring";
import LawyerList from "./pages/LawyerList";
import DeliveredList from "./pages/DeliveredList";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const ORDER_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'];
const PLANNING_ROLES = ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'];
const FINANCE_ROLES = ['Admin', 'Super Admin', 'Finance'];
const ADMIN_ROLES = ['Admin', 'Super Admin'];
const IMPORT_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Read Only Audit'];
const SYSTEM_ROLES = ['Admin', 'Super Admin', 'Read Only Audit'];

function ProtectedRoute({ children, requiredRoles }: { children: React.ReactNode; requiredRoles?: string[] }) {
  const { user, roles, loading, blockReason } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (blockReason) return <AccountBlocked />;
  if (requiredRoles && !requiredRoles.some(r => roles.includes(r))) return <AccessDenied />;

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
      <Route path="/passwort-setzen" element={<SetPassword />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Customers /></ProtectedRoute>} />
        <Route path="/kunden/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><CustomerDetail /></ProtectedRoute>} />
        <Route path="/auftraege" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Orders /></ProtectedRoute>} />
        <Route path="/auftraege/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><OrderDetail /></ProtectedRoute>} />
        <Route path="/prio-liste" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><PriorityList /></ProtectedRoute>} />
        <Route path="/anwaltsliste" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><LawyerList /></ProtectedRoute>} />
        <Route path="/geliefert" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><DeliveredList /></ProtectedRoute>} />
        <Route path="/tourenplanung" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><RoutePlanning /></ProtectedRoute>} />
        <Route path="/tourenplanung/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
        <Route path="/tourenplanung/:id" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><RoutePlanDetail /></ProtectedRoute>} />
        <Route path="/tourenplanung/:id/bearbeiten" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Finance /></ProtectedRoute>} />
        <Route path="/finance/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Finance']}><FinanceForm /></ProtectedRoute>} />
        <Route path="/finance/:id" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceDetail /></ProtectedRoute>} />
        <Route path="/finance/:id/bearbeiten" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Finance']}><FinanceForm /></ProtectedRoute>} />
        <Route path="/benutzer" element={<ProtectedRoute requiredRoles={ADMIN_ROLES}><UserManagement /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute requiredRoles={IMPORT_ROLES}><ImportManagement /></ProtectedRoute>} />
        <Route path="/system" element={<ProtectedRoute requiredRoles={SYSTEM_ROLES}><SystemMonitoring /></ProtectedRoute>} />
      </Route>
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
