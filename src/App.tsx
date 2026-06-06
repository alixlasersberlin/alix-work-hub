import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DesignVariantProvider } from "@/hooks/useDesignVariant";
import DesignVariantSwitcher from "@/components/DesignVariantSwitcher";
import AuroraSpotlight from "@/components/AuroraSpotlight";
import { Truck as TruckIcon, Banknote as BanknoteIcon, FileSignature, CreditCard, Loader2 } from "lucide-react";

// Eager: Auth-/Shell-Routen (klein & für initialen Render nötig)
import Login from "./pages/Login";
import AccountBlocked from "./pages/AccountBlocked";
import AccessDenied from "./pages/AccessDenied";
import MfaSetup from "./pages/MfaSetup";
import MfaChallenge from "./pages/MfaChallenge";
import MfaRecovery from "./pages/MfaRecovery";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

// Lazy: alle Hauptseiten → Route-basiertes Code-Splitting
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const OrdersAt = lazy(() => import("./pages/OrdersAt"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrdersInClarification = lazy(() => import("./pages/OrdersInClarification"));
const PriorityList = lazy(() => import("./pages/PriorityList"));
const HoldList = lazy(() => import("./pages/HoldList"));
const RoutePlanning = lazy(() => import("./pages/RoutePlanning"));
const Reparaturannahme = lazy(() => import("./pages/Reparaturannahme"));
const ReparaturLayout = lazy(() => import("./pages/Reparatur/Layout"));
const ReparaturDashboard = lazy(() => import("./pages/Reparatur/Dashboard"));
const ReparaturNew = lazy(() => import("./pages/Reparatur/New"));
const ReparaturList = lazy(() => import("./pages/Reparatur/List"));
const ReparaturDetail = lazy(() => import("./pages/Reparatur/Detail"));
const ReparaturWerkstatt = lazy(() => import("./pages/Reparatur/Werkstattannahme"));
const ReparaturTechnik = lazy(() => import("./pages/Reparatur/Technik"));
const ReparaturErsatzteile = lazy(() => import("./pages/Reparatur/Ersatzteile"));
const ReparaturFinance = lazy(() => import("./pages/Reparatur/FinanceUebergabe"));
const ReparaturTouren = lazy(() => import("./pages/Reparatur/TourenplanungUebergabe"));
const ReparaturArchiv = lazy(() => import("./pages/Reparatur/Archiv"));
const RoutePlanDetail = lazy(() => import("./pages/RoutePlanDetail"));
const RoutePlanForm = lazy(() => import("./pages/RoutePlanForm"));
const RoutePlanningSettings = lazy(() => import("./pages/RoutePlanningSettings"));
const Finance = lazy(() => import("./pages/Finance"));
const Ratenzahler = lazy(() => import("./pages/Ratenzahler"));
const AlixFlex = lazy(() => import("./pages/AlixFlex"));
const Invoices = lazy(() => import("./pages/Invoices"));
const OffenePosten = lazy(() => import("./pages/OffenePosten"));
const ZohoUnpaidInvoices = lazy(() => import("./pages/ZohoUnpaidInvoices"));
const FinanceDetail = lazy(() => import("./pages/FinanceDetail"));
const FinanceForm = lazy(() => import("./pages/FinanceForm"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ImportManagement = lazy(() => import("./pages/ImportManagement"));
const Backups = lazy(() => import("./pages/Backups"));
const Rollen = lazy(() => import("./pages/Rollen"));
const SystemMonitoring = lazy(() => import("./pages/SystemMonitoring"));
const LawyerList = lazy(() => import("./pages/LawyerList"));
const DeliveredList = lazy(() => import("./pages/DeliveredList"));
const PartialDeliveryList = lazy(() => import("./pages/PartialDeliveryList"));
const DeviceStatistics = lazy(() => import("./pages/DeviceStatistics"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ProductionOrders = lazy(() => import("./pages/ProductionOrders"));
const OrdersFreiBestellung = lazy(() => import("./pages/OrdersFreiBestellung"));
const ProductionOrderForm = lazy(() => import("./pages/ProductionOrderForm"));
const ProductionOrderDetail = lazy(() => import("./pages/ProductionOrderDetail"));
const ProductionTimeline = lazy(() => import("./pages/ProductionTimeline"));
const ProductionPortal = lazy(() => import("./pages/ProductionPortal"));
const ProductionFertig = lazy(() => import("./pages/ProductionFertig"));
const ProductionOrderIn = lazy(() => import("./pages/ProductionOrderIn"));
const OrderApprovalQueue = lazy(() => import("./pages/OrderApprovalQueue"));
const FactoryInvoice = lazy(() => import("./pages/FactoryInvoice"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Lager = lazy(() => import("./pages/Lager"));
const Lagergeraete = lazy(() => import("./pages/Lagergeraete"));
const Leihgeraete = lazy(() => import("./pages/Leihgeraete"));
const DoppelteReservierungen = lazy(() => import("./pages/DoppelteReservierungen"));
const EquipmentArea = lazy(() => import("./pages/EquipmentArea"));
const EquipmentUnterwegs = lazy(() => import("./pages/EquipmentUnterwegs"));
const EquipmentWarehouse = lazy(() => import("./pages/EquipmentWarehouse"));
const EquipmentProduktion = lazy(() => import("./pages/EquipmentProduktion"));
const EquipmentHold = lazy(() => import("./pages/EquipmentHold"));
const EquipmentAusgeliefert = lazy(() => import("./pages/EquipmentAusgeliefert"));
const Artikel = lazy(() => import("./pages/Artikel"));
const Katalog = lazy(() => import("./pages/Katalog"));
const Kategorie = lazy(() => import("./pages/Kategorie"));
const Wareneingang = lazy(() => import("./pages/Wareneingang"));
const ArtikelUebersicht = lazy(() => import("./pages/ArtikelUebersicht"));
const AngebotErstellen = lazy(() => import("./pages/AngebotErstellen"));
const Angebote = lazy(() => import("./pages/Angebote"));
const Anzahlungsrechnung = lazy(() => import("./pages/Anzahlungsrechnung"));
const Gutschriften = lazy(() => import("./pages/Gutschriften"));
const Freigabe = lazy(() => import("./pages/Freigabe"));
const VerkaufUebersicht = lazy(() => import("./pages/VerkaufUebersicht"));
const Operation = lazy(() => import("./pages/Operation"));
const Logfiles = lazy(() => import("./pages/Logfiles"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const Hilfe = lazy(() => import("./pages/Hilfe"));
const Dokumentation = lazy(() => import("./pages/Dokumentation"));
const Arbeitsanleitung = lazy(() => import("./pages/Arbeitsanleitung"));
const Papiere = lazy(() => import("./pages/Papiere"));
const VersandPlaceholder = lazy(() => import("./pages/VersandPlaceholder"));
const LeasingBank = lazy(() => import("./pages/LeasingBank"));
const FinanzierungBeantragen = lazy(() => import("./pages/FinanzierungBeantragen"));
const ZusagenBank = lazy(() => import("./pages/ZusagenBank"));
const AbsagenBank = lazy(() => import("./pages/AbsagenBank"));
const AnfragenOffen = lazy(() => import("./pages/AnfragenOffen"));
const Detailsuche = lazy(() => import("./pages/Detailsuche"));
const Geraetesperren = lazy(() => import("./pages/Geraetesperren"));
const Systemwartung = lazy(() => import("./pages/Systemwartung"));
const BugCapaLayoutLazy = lazy(() => import("./pages/BugCapa/_shared").then(m => ({ default: m.BugCapaLayout })));
const BugCapaDashboard = lazy(() => import("./pages/BugCapa/BugCapaDashboard"));
const BugCapaBugs = lazy(() => import("./pages/BugCapa/Bugs"));
const BugCapaCapas = lazy(() => import("./pages/BugCapa/Capas"));
const BugCapaReklamationen = lazy(() => import("./pages/BugCapa/Reklamationen"));
const BugCapaAudit = lazy(() => import("./pages/BugCapa/AuditFindings"));
const BugCapaMassnahmen = lazy(() => import("./pages/BugCapa/Massnahmen"));
const BugCapaBerichte = lazy(() => import("./pages/BugCapa/Berichte"));
const MdrCe = lazy(() => import("./pages/MdrCe"));
const Iso13485 = lazy(() => import("./pages/Iso13485"));
const ReviewsLayout = lazy(() => import("./pages/Reviews/_layout"));
const ReviewsOverview = lazy(() => import("./pages/Reviews/Overview"));
const ReviewsDelivered = lazy(() => import("./pages/Reviews/DeliveredOrders"));
const ReviewsSubmitted = lazy(() => import("./pages/Reviews/Submitted"));
const ReviewsClosedLayout = lazy(() => import("./pages/Reviews/Closed/_layout"));
const ReviewsClosed = lazy(() => import("./pages/Reviews/Closed"));
const ReviewsClosedWithReview = lazy(() => import("./pages/Reviews/Closed/WithReview"));
const ReviewsFrontendPreview = lazy(() => import("./pages/Reviews/FrontendPreview"));
const PublicReviewForm = lazy(() => import("./pages/PublicReview/ReviewForm"));
const ReviewThanks = lazy(() => import("./pages/PublicReview/ReviewThanks"));
const PortalLookup = lazy(() => import("./pages/Portal/Lookup"));
const PortalStatus = lazy(() => import("./pages/Portal/Status"));
const PortalAdmin = lazy(() => import("./pages/PortalAdmin"));
const MailCenterLayout = lazy(() => import("./pages/MailCenter/Layout"));
const MailCenterDashboard = lazy(() => import("./pages/MailCenter/Dashboard"));
const MailCenterCompose = lazy(() => import("./pages/MailCenter/Compose"));
const MailCenterVorlagen = lazy(() => import("./pages/MailCenter/Vorlagen"));
const MailCenterKampagnen = lazy(() => import("./pages/MailCenter/Kampagnen"));
const MailCenterAutomationen = lazy(() => import("./pages/MailCenter/Automationen"));
const MailCenterTracking = lazy(() => import("./pages/MailCenter/Tracking"));
const MailCenterDomains = lazy(() => import("./pages/MailCenter/Domains"));
const MailCenterBerichte = lazy(() => import("./pages/MailCenter/Berichte"));
const MailCenterEinstellungen = lazy(() => import("./pages/MailCenter/Einstellungen"));
import MaintenanceGate from "./components/MaintenanceGate";
import LeihgeraetReminder from "./components/LeihgeraetReminder";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ORDER_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'];
const PLANNING_ROLES = ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Österreich'];
const FINANCE_ROLES = ['Admin', 'Super Admin', 'Finance'];
const FINANCING_ROLES = ['Admin', 'Super Admin', 'Finance', 'Finanzierungen', 'Order'];
const ADMIN_ROLES = ['Admin', 'Super Admin'];
const IMPORT_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Read Only Audit'];
const SYSTEM_ROLES = ['Admin', 'Super Admin', 'Read Only Audit'];
const PRODUCTION_ROLES = ['Admin', 'Super Admin', 'Lieferant', 'FACTORY INVOICE', 'Order'];
const FACTORY_INVOICE_ROLES = ['Admin', 'Super Admin', 'FACTORY INVOICE'];
const PRODUCTION_VIEW_ROLES = ['Admin', 'Super Admin', 'FACTORY INVOICE', 'Order', 'Österreich'];
const ORDER_MGMT_ROLES = ['Admin', 'Super Admin', 'Order', 'Österreich'];
const WAREHOUSE_ROLES = ['Admin', 'Super Admin', 'Order', 'Österreich'];
const QM_ROLES = ['Admin', 'Super Admin', 'QM'];

function isSupplierOnly(roles: string[]) {
  return roles.includes('Lieferant') && !roles.some(r => ['Admin', 'Super Admin'].includes(r));
}

function FullscreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children, requiredRoles, allowEmails }: { children: React.ReactNode; requiredRoles?: string[]; allowEmails?: string[] }) {
  const { user, profile, roles, loading, blockReason, mfaState } = useAuth();

  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (blockReason) return <AccountBlocked />;

  if (mfaState === 'not_enrolled') return <Navigate to="/mfa-setup" replace />;
  if (mfaState === 'challenge_required') return <Navigate to="/mfa-challenge" replace />;
  if (mfaState !== 'verified') return <FullscreenLoader />;

  const emailAllowed = !!allowEmails && allowEmails.map(e => e.toLowerCase()).includes((profile?.email || '').toLowerCase());

  if (isSupplierOnly(roles)) {
    if (requiredRoles && !requiredRoles.includes('Lieferant') && !emailAllowed) {
      return <Navigate to="/production" replace />;
    }
  }

  if (requiredRoles && !requiredRoles.some(r => roles.includes(r)) && !emailAllowed) return <AccessDenied />;

  return <>{children}</>;
}

function MfaGate({ children, expect }: { children: React.ReactNode; expect: 'not_enrolled' | 'challenge_required' | 'any' }) {
  const { user, loading, mfaState, blockReason } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (blockReason) return <AccountBlocked />;
  if (mfaState === 'verified') return <Navigate to="/" replace />;
  if (expect !== 'any' && mfaState !== expect && mfaState !== 'unknown') {
    if (mfaState === 'not_enrolled') return <Navigate to="/mfa-setup" replace />;
    if (mfaState === 'challenge_required') return <Navigate to="/mfa-challenge" replace />;
  }
  return <>{children}</>;
}

function HomeRoute() {
  const { roles } = useAuth();
  if (isSupplierOnly(roles)) return <Navigate to="/production" replace />;
  // Nur-Finanzierungen-Nutzer landen direkt im Finanzierungs-Bereich
  if (roles.length > 0 && roles.every((r) => r === 'Finanzierungen', 'Order')) {
    return <Navigate to="/finanzierungen" replace />;
  }
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullscreenLoader />;

  return (
    <Suspense fallback={<FullscreenLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/passwort-setzen" element={<SetPassword />} />
        <Route path="/mfa-setup" element={<MfaGate expect="not_enrolled"><MfaSetup /></MfaGate>} />
        <Route path="/mfa-challenge" element={<MfaGate expect="challenge_required"><MfaChallenge /></MfaGate>} />
        <Route path="/mfa-recovery" element={<MfaGate expect="any"><MfaRecovery /></MfaGate>} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/detailsuche" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Detailsuche /></ProtectedRoute>} />
          <Route path="/geraetesperren" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Geraetesperren /></ProtectedRoute>} />
          <Route path="/kunden" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Customers /></ProtectedRoute>} />
          <Route path="/kunden/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><CustomerDetail /></ProtectedRoute>} />
          <Route path="/auftraege" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Orders /></ProtectedRoute>} />
          <Route path="/auftraege-at" element={<ProtectedRoute><OrdersAt /></ProtectedRoute>} />
          <Route path="/auftraege/in-klaerung" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><OrdersInClarification /></ProtectedRoute>} />
          <Route path="/auftraege/:id" element={<ProtectedRoute requiredRoles={[...ORDER_ROLES, 'Finanzierungen', 'Order']}><OrderDetail /></ProtectedRoute>} />
          <Route path="/verkauf/artikel" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Artikel /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/katalog" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Katalog /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/kategorie" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Kategorie /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/wareneingang" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Wareneingang /></ProtectedRoute>} />
          <Route path="/verkauf/artikel-uebersicht" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><ArtikelUebersicht /></ProtectedRoute>} />
          <Route path="/verkauf" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VerkaufUebersicht /></ProtectedRoute>} />
          <Route path="/verkauf/angebot/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order']}><AngebotErstellen /></ProtectedRoute>} />
          <Route path="/verkauf/angebote" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Angebote /></ProtectedRoute>} />
          <Route path="/verkauf/anzahlungsrechnung" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Anzahlungsrechnung /></ProtectedRoute>} />
          <Route path="/verkauf/gutschriften" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Gutschriften /></ProtectedRoute>} />
          <Route path="/verkauf/freigabe" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Freigabe /></ProtectedRoute>} />
          <Route path="/operation" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Operation /></ProtectedRoute>} />
          <Route path="/operation/logfiles" element={<ProtectedRoute requiredRoles={SYSTEM_ROLES}><Logfiles /></ProtectedRoute>} />
          <Route path="/operation/email-vorlagen" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><EmailTemplates /></ProtectedRoute>} />
          <Route path="/operation/systemwartung" element={<ProtectedRoute requiredRoles={['Super Admin']}><Systemwartung /></ProtectedRoute>} />
          <Route path="/portal-admin" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><PortalAdmin /></ProtectedRoute>} />
          <Route path="/hilfe" element={<ProtectedRoute><Hilfe /></ProtectedRoute>} />
          <Route path="/hilfe/dokumentation" element={<ProtectedRoute><Dokumentation /></ProtectedRoute>} />
          <Route path="/hilfe/arbeitsanleitung" element={<ProtectedRoute><Arbeitsanleitung /></ProtectedRoute>} />
          <Route path="/operation/hilfe" element={<Navigate to="/hilfe" replace />} />
          <Route path="/papiere" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Papiere /></ProtectedRoute>} />
          <Route path="/versand/lieferscheine" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VersandPlaceholder title="Lieferscheine" description="Versand & Lieferdokumente" icon={TruckIcon} /></ProtectedRoute>} />
          <Route path="/versand/ratenplan" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VersandPlaceholder title="Ratenplan" description="Übersicht aller Ratenpläne" icon={BanknoteIcon} /></ProtectedRoute>} />
          <Route path="/versand/mietkauf" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VersandPlaceholder title="Mietkauf" description="Mietkauf-Verträge" icon={FileSignature} /></ProtectedRoute>} />
          <Route path="/versand/sepa-mandat" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VersandPlaceholder title="SEPA Mandat" description="SEPA-Lastschriftmandate" icon={CreditCard} /></ProtectedRoute>} />
          <Route path="/prio-liste" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><PriorityList /></ProtectedRoute>} />
          <Route path="/prio-liste/hold" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><HoldList /></ProtectedRoute>} />
          <Route path="/anwaltsliste" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><LawyerList /></ProtectedRoute>} />
          <Route path="/geliefert" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><DeliveredList /></ProtectedRoute>} />
          <Route path="/teilgeliefert" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><PartialDeliveryList /></ProtectedRoute>} />
          <Route path="/geraetetypen" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><DeviceStatistics /></ProtectedRoute>} />
          <Route path="/tourenplanung" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><RoutePlanning /></ProtectedRoute>} />
          <Route path="/tourenplanung/einstellungen" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanningSettings /></ProtectedRoute>} />
          <Route path="/reparaturannahme" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><Reparaturannahme /></ProtectedRoute>} />
          <Route path="/tourenplanung/reparaturannahme" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><Reparaturannahme /></ProtectedRoute>} />
          <Route path="/reparatur" element={<ProtectedRoute><ReparaturLayout /></ProtectedRoute>}>
            <Route index element={<ReparaturDashboard />} />
            <Route path="neu" element={<ReparaturNew />} />
            <Route path="auftraege" element={<ReparaturList />} />
            <Route path="werkstattannahme" element={<ReparaturWerkstatt />} />
            <Route path="technik" element={<ReparaturTechnik />} />
            <Route path="ersatzteile" element={<ReparaturErsatzteile />} />
            <Route path="finance" element={<ReparaturFinance />} />
            <Route path="tourenplanung" element={<ReparaturTouren />} />
            <Route path="archiv" element={<ReparaturArchiv />} />
            <Route path=":id" element={<ReparaturDetail />} />
          </Route>

          <Route path="/tourenplanung/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
          <Route path="/tourenplanung/:id" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><RoutePlanDetail /></ProtectedRoute>} />
          <Route path="/tourenplanung/:id/bearbeiten" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Finance /></ProtectedRoute>} />
          <Route path="/finance/ratenzahler" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Ratenzahler /></ProtectedRoute>} />
          <Route path="/finance/alix-flex" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin']}><AlixFlex /></ProtectedRoute>} />
          <Route path="/finance/rechnungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Invoices /></ProtectedRoute>} />
          <Route path="/finance/offene-posten" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><OffenePosten /></ProtectedRoute>} />
          <Route path="/finance/unpaid-zoho" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><ZohoUnpaidInvoices /></ProtectedRoute>} />
          <Route path="/finance/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Finance']}><FinanceForm /></ProtectedRoute>} />
          <Route path="/finance/:id" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceDetail /></ProtectedRoute>} />
          <Route path="/finance/:id/bearbeiten" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Finance']}><FinanceForm /></ProtectedRoute>} />
          <Route path="/finanzierungen" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><LeasingBank /></ProtectedRoute>} />
          <Route path="/finanzierungen/leasing-bank" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><LeasingBank /></ProtectedRoute>} />
          <Route path="/finanzierungen/beantragen" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><FinanzierungBeantragen /></ProtectedRoute>} />
          <Route path="/finanzierungen/zusagen-bank" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><ZusagenBank /></ProtectedRoute>} />
          <Route path="/finanzierungen/absagen-bank" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><AbsagenBank /></ProtectedRoute>} />
          <Route path="/finanzierungen/anfragen-offen" element={<ProtectedRoute requiredRoles={FINANCING_ROLES}><AnfragenOffen /></ProtectedRoute>} />
          
          <Route path="/benutzer" element={<ProtectedRoute requiredRoles={ADMIN_ROLES}><UserManagement /></ProtectedRoute>} />
          <Route path="/import" element={<ProtectedRoute requiredRoles={IMPORT_ROLES}><ImportManagement /></ProtectedRoute>} />
          <Route path="/datensicherung" element={<ProtectedRoute requiredRoles={ADMIN_ROLES}><Backups /></ProtectedRoute>} />
          <Route path="/rollen" element={<ProtectedRoute requiredRoles={ADMIN_ROLES}><Rollen /></ProtectedRoute>} />
          <Route path="/system" element={<ProtectedRoute requiredRoles={SYSTEM_ROLES}><SystemMonitoring /></ProtectedRoute>} />
          <Route path="/order" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrders /></ProtectedRoute>} />
          <Route path="/order/freigabe" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><OrderApprovalQueue /></ProtectedRoute>} />
          <Route path="/order/frei-bestellung" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><OrdersFreiBestellung /></ProtectedRoute>} />
          <Route path="/order/timeline" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionTimeline /></ProtectedRoute>} />
          <Route path="/order/zulieferer" element={<ProtectedRoute requiredRoles={ADMIN_ROLES}><Suppliers /></ProtectedRoute>} />
          <Route path="/order/neu" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrderForm /></ProtectedRoute>} />
          <Route path="/order/reklamation" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrders mode="reclamation" /></ProtectedRoute>} />
          <Route path="/order/reklamation/neu" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrderForm mode="reclamation" /></ProtectedRoute>} />
          <Route path="/order/reklamation/:id" element={<ProtectedRoute requiredRoles={PRODUCTION_VIEW_ROLES}><ProductionOrderDetail /></ProtectedRoute>} />
          <Route path="/order/reklamation/:id/bearbeiten" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrderForm mode="reclamation" /></ProtectedRoute>} />
          <Route path="/order/:id" element={<ProtectedRoute requiredRoles={PRODUCTION_VIEW_ROLES}><ProductionOrderDetail /></ProtectedRoute>} />
          <Route path="/order/:id/bearbeiten" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><ProductionOrderForm /></ProtectedRoute>} />

          <Route path="/production" element={<ProtectedRoute requiredRoles={PRODUCTION_ROLES}><ProductionPortal /></ProtectedRoute>} />
          <Route path="/production/fertig" element={<ProtectedRoute requiredRoles={PRODUCTION_ROLES}><ProductionFertig /></ProtectedRoute>} />
          <Route path="/production/order-in" element={<ProtectedRoute requiredRoles={PRODUCTION_ROLES}><ProductionOrderIn /></ProtectedRoute>} />
          <Route path="/production/factory-invoice" element={<ProtectedRoute requiredRoles={FACTORY_INVOICE_ROLES} allowEmails={["natalia.p@alix-operation.de"]}><FactoryInvoice /></ProtectedRoute>} />
          <Route path="/lager" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><Lager /></ProtectedRoute>} />
          <Route path="/lager/lagergeraete" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><Lagergeraete filterType="Neugerät" pageTitle="Lagergeräte" pageSubtitle="Erfassung und Übersicht aller Neugeräte im Lager" addLabel="Neues Lagergerät" dialogTitle="Lagergerät" emptyLabel="Noch keine Lagergeräte erfasst." rowAccentClass="bg-emerald-500/10 hover:bg-emerald-500/15" /></ProtectedRoute>} />
          <Route path="/lager/leihgeraete" element={<ProtectedRoute><Leihgeraete /></ProtectedRoute>} />
          <Route path="/lager/doppelte-reservierungen" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><DoppelteReservierungen /></ProtectedRoute>} />
          <Route path="/lager/equipment-area" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentArea /></ProtectedRoute>} />
          <Route path="/lager/equipment-area/warehouse" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentWarehouse /></ProtectedRoute>} />
          <Route path="/lager/equipment-area/unterwegs" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentUnterwegs /></ProtectedRoute>} />
          <Route path="/lager/equipment-area/produktion" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentProduktion /></ProtectedRoute>} />
          <Route path="/lager/equipment-area/hold" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentHold /></ProtectedRoute>} />
          <Route path="/lager/equipment-area/ausgeliefert" element={<ProtectedRoute requiredRoles={WAREHOUSE_ROLES}><EquipmentAusgeliefert /></ProtectedRoute>} />

          <Route path="/bug-capa" element={<BugCapaLayoutLazy />}>
            <Route index element={<BugCapaDashboard />} />
            <Route path="bugs" element={<BugCapaBugs />} />
            <Route path="capa" element={<BugCapaCapas />} />
            <Route path="reklamationen" element={<BugCapaReklamationen />} />
            <Route path="audit" element={<BugCapaAudit />} />
            <Route path="massnahmen" element={<BugCapaMassnahmen />} />
            <Route path="berichte" element={<BugCapaBerichte />} />
          </Route>

          <Route path="/mailcenter" element={<ProtectedRoute><MailCenterLayout /></ProtectedRoute>}>
            <Route index element={<MailCenterDashboard />} />
            <Route path="schreiben" element={<MailCenterCompose />} />
            <Route path="vorlagen" element={<MailCenterVorlagen />} />
            <Route path="kampagnen" element={<MailCenterKampagnen />} />
            <Route path="automationen" element={<MailCenterAutomationen />} />
            <Route path="tracking" element={<MailCenterTracking />} />
            <Route path="domains" element={<MailCenterDomains />} />
            <Route path="berichte" element={<MailCenterBerichte />} />
            <Route path="einstellungen" element={<MailCenterEinstellungen />} />
          </Route>

          <Route path="/mdr-ce" element={<ProtectedRoute requiredRoles={['Super Admin']}><MdrCe /></ProtectedRoute>} />
          <Route path="/mdr-ce/iso-13485" element={<ProtectedRoute requiredRoles={['Super Admin']}><Iso13485 /></ProtectedRoute>} />

          <Route path="/bewertungen" element={<ProtectedRoute><ReviewsLayout /></ProtectedRoute>}>
            <Route index element={<ReviewsOverview />} />
            <Route path="geliefert" element={<ReviewsDelivered />} />
            <Route path="abgegeben" element={<ReviewsSubmitted />} />
            <Route path="geschlossen" element={<ReviewsClosedLayout />}>
              <Route index element={<ReviewsClosed />} />
              <Route path="mit-bewertung" element={<ReviewsClosedWithReview />} />
            </Route>
            <Route path="frontend" element={<ReviewsFrontendPreview />} />
          </Route>

        </Route>
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/bewertung/danke" element={<ReviewThanks />} />
        <Route path="/bewertung/:token" element={<PublicReviewForm />} />
        <Route path="/portal" element={<PortalLookup />} />
        <Route path="/portal/status" element={<PortalStatus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <DesignVariantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <MaintenanceGate>
                <AppRoutes />
                <AuroraSpotlight />
                <LeihgeraetReminder />
              </MaintenanceGate>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </DesignVariantProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
