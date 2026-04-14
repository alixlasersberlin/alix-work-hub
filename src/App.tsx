import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import SetPassword from "./pages/SetPassword";
import AccountBlocked from "./pages/AccountBlocked";
import AccessDenied from "./pages/AccessDenied";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import RoutePlanning from "./pages/RoutePlanning";
import RoutePlanDetail from "./pages/RoutePlanDetail";
import RoutePlanForm from "./pages/RoutePlanForm";
import Finance from "./pages/Finance";
import FinanceDetail from "./pages/FinanceDetail";
import FinanceForm from "./pages/FinanceForm";
import UserManagement from "./pages/UserManagement";
import ImportManagement from "./pages/ImportManagement";
import SystemMonitoring from "./pages/SystemMonitoring";
import NotFound from "./pages/NotFound";
import { Loader2, ShieldCheck } from "lucide-react";

const queryClient = new QueryClient();

const ORDER_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Tourenplanung', 'Finance'];
const PLANNING_ROLES = ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung'];
const FINANCE_ROLES = ['Admin', 'Super Admin', 'Finance'];
const ADMIN_ROLES = ['Admin', 'Super Admin'];
const IMPORT_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Read Only Audit'];
const SYSTEM_ROLES = ['Admin', 'Super Admin', 'Read Only Audit'];

function OtpGate({ children }: { children: React.ReactNode }) {
  const { isOtpVerified, otpState } = useAuth();

  if (isOtpVerified) return <>{children}</>;

  // Show a waiting screen if OTP is not yet verified but user is logged in
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground mb-2">OTP-Verifikation erforderlich</h1>
        <p className="text-sm text-muted-foreground">Bitte schließen Sie die Zwei-Faktor-Authentifizierung ab.</p>
      </div>
    </div>
  );
}

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
      <Route element={<ProtectedRoute><OtpGate><AppLayout /></OtpGate></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kunden" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Customers /></ProtectedRoute>} />
        <Route path="/kunden/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><CustomerDetail /></ProtectedRoute>} />
        <Route path="/auftraege" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Orders /></ProtectedRoute>} />
        <Route path="/auftraege/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><OrderDetail /></ProtectedRoute>} />
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
