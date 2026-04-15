import { useState, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
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
  const { isOtpVerified, otpState, otpChallenge, otpError, sendOtp, verifyOtp, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  // Auto-send OTP on mount if not yet sent
  useEffect(() => {
    if (!isOtpVerified && otpState === 'none' && !hasSent) {
      setHasSent(true);
      sendOtp('login');
    }
  }, [isOtpVerified, otpState, hasSent, sendOtp]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) return;
    setVerifying(true);
    await verifyOtp(code);
    setVerifying(false);
  }, [code, verifyOtp]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && otpState === 'pending') {
      handleVerify();
    }
  }, [code, otpState, handleVerify]);

  if (isOtpVerified) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground mb-2">Zwei-Faktor-Authentifizierung</h1>

        {otpState === 'sending' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Sicherheitscode wird gesendet…</p>
          </div>
        )}

        {otpState === 'pending' && otpChallenge && (
          <div className="mt-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Ein 6-stelliger Code wurde per {otpChallenge.channel === 'sms' ? 'SMS' : 'E-Mail'} an{' '}
              <span className="font-mono text-foreground">{otpChallenge.destination_hint}</span> gesendet.
            </p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} disabled={verifying}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {otpError && (
              <p className="text-sm text-destructive">{otpError}</p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={handleVerify} disabled={code.length !== 6 || verifying} className="w-full">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Bestätigen
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setCode(""); sendOtp('login'); }} disabled={verifying}>
                Code erneut senden
              </Button>
            </div>
          </div>
        )}

        {otpState === 'blocked' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-destructive">{otpError || 'OTP-Verifikation vorübergehend gesperrt.'}</p>
            <Button variant="outline" onClick={() => signOut()}>Abmelden</Button>
          </div>
        )}

        {otpState === 'error' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-destructive">{otpError || 'Ein Fehler ist aufgetreten.'}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => sendOtp('login')}>Erneut versuchen</Button>
              <Button variant="ghost" onClick={() => signOut()}>Abmelden</Button>
            </div>
          </div>
        )}

        {otpState === 'none' && !hasSent && (
          <div className="mt-6">
            <Button onClick={() => sendOtp('login')}>Sicherheitscode anfordern</Button>
          </div>
        )}

        <div className="mt-8">
          <button onClick={() => signOut()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Anderes Konto verwenden
          </button>
        </div>
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
        <Route path="/prio-liste" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><PriorityList /></ProtectedRoute>} />
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
