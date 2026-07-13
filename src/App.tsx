import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useSyncRevenueMaskGlobal } from "@/lib/revenue-mask";
import { TenantProvider } from "@/contexts/TenantContext";
import { ThemeProvider } from "@/hooks/useTheme";
import { DesignVariantProvider } from "@/hooks/useDesignVariant";
import { ExperienceModeProvider } from "@/hooks/useExperienceMode";
import AuroraSpotlight from "@/components/AuroraSpotlight";
import { CursorSpotlight } from "@/components/aurora/CursorSpotlight";
import { GlobalCommandBar } from "@/components/infinity/GlobalCommandBar";
import { CopilotBar } from "@/components/infinity/CopilotBar";
import { AIBackground } from "@/components/infinity/AIBackground";
import { ShortcutsOverlay } from "@/components/infinity/ShortcutsOverlay";
import { TopProgressBar } from "@/components/infinity/TopProgressBar";
import { Truck as TruckIcon, Banknote as BanknoteIcon, FileSignature, CreditCard, Loader2 } from "lucide-react";

// Eager: Auth-/Shell-Routen (klein & für initialen Render nötig)
import Login from "./pages/Login";
import CovertLogin from "./pages/CovertLogin";
import Landing from "./pages/Landing";
import AccountBlocked from "./pages/AccountBlocked";
import AccessDenied from "./pages/AccessDenied";
import MfaSetup from "./pages/MfaSetup";
import MfaChallenge from "./pages/MfaChallenge";
import MfaRecovery from "./pages/MfaRecovery";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import { isMfaMandatory } from "@/lib/mfa-required";

// Lazy: alle Hauptseiten → Route-basiertes Code-Splitting
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const VerkaufDashboard = lazy(() => import("./pages/VerkaufDashboard"));
const BestellungenDashboard = lazy(() => import("./pages/BestellungenDashboard"));
const AtDashboard = lazy(() => import("./pages/AtDashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const DoppelteKunden = lazy(() => import("./pages/DoppelteKunden"));
const Orders = lazy(() => import("./pages/Orders"));
const OrdersAt = lazy(() => import("./pages/OrdersAt"));
const OrdersCh = lazy(() => import("./pages/OrdersCh"));
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
const ReparaturKostenvoranschlaege = lazy(() => import("./pages/Reparatur/Kostenvoranschlaege"));
const ReparaturQuoteDetail = lazy(() => import("./pages/Reparatur/QuoteDetail"));
const ReparaturRueckversand = lazy(() => import("./pages/Reparatur/Rueckversand"));
const PublicRepairQuoteDecision = lazy(() => import("./pages/PublicRepairQuote/Decision"));
const BestellwesenErsatzteile = lazy(() => import("./pages/Bestellwesen/Ersatzteile"));
const Ersatzteilmanagement = lazy(() => import("./pages/Ersatzteilmanagement"));
const ManagementDashboard = lazy(() => import("./pages/ManagementDashboard"));
const ExecutiveCommandCenter = lazy(() => import("./pages/ExecutiveCommandCenter"));
const InfinityShowcase = lazy(() => import("./pages/InfinityShowcase"));
const Personalisierung = lazy(() => import("./pages/Personalisierung"));
const Sicherheit = lazy(() => import("./pages/Sicherheit"));
const AiCenter = lazy(() => import("./pages/AiCenter"));
const RoutePlanDetail = lazy(() => import("./pages/RoutePlanDetail"));
const RoutePlanForm = lazy(() => import("./pages/RoutePlanForm"));
const RoutePlanningSettings = lazy(() => import("./pages/RoutePlanningSettings"));
const SmsTemplateSettings = lazy(() => import("./pages/Mobile/SmsTemplateSettings"));
const TourenKalender = lazy(() => import("./pages/Tourenplanung/Kalender"));
const TourenKarte = lazy(() => import("./pages/Tourenplanung/Karte"));
const TourenDashboard = lazy(() => import("./pages/Tourenplanung/Dashboard"));
const Finance = lazy(() => import("./pages/Finance"));
const Ratenzahler = lazy(() => import("./pages/Ratenzahler"));
const WiederkehrendeZahler = lazy(() => import("./pages/Finance/WiederkehrendeZahler"));
const AlixFlex = lazy(() => import("./pages/AlixFlex"));
const Invoices = lazy(() => import("./pages/Invoices"));
const OffenePosten = lazy(() => import("./pages/OffenePosten"));
// const ZohoUnpaidInvoices = lazy(() => import("./pages/ZohoUnpaidInvoices")); // deaktiviert
const FinanceDetail = lazy(() => import("./pages/FinanceDetail"));
const Rechnungsvorschlaege = lazy(() => import("./pages/Rechnungsvorschlaege"));
const ServiceCockpit = lazy(() => import("./pages/ServiceCockpit"));
const FinanceForm = lazy(() => import("./pages/FinanceForm"));
const FinanceDashboardPhase1 = lazy(() => import("./pages/Finance/Dashboard"));
const FinanceAnzahlungen = lazy(() => import("./pages/Finance/Anzahlungen"));
const FinanceOffeneAnzahlungen = lazy(() => import("./pages/Finance/OffeneAnzahlungen"));
const FinanceKassenbuch = lazy(() => import("./pages/Finance/Kassenbuch"));
const FinanceBuchungsjournal = lazy(() => import("./pages/Finance/Buchungsjournal"));
const FinanceBankbuchungen = lazy(() => import("./pages/Finance/Bankbuchungen"));
const FinanceZahlungsuebersicht = lazy(() => import("./pages/Finance/Zahlungsuebersicht"));
const FinanceDatevExport = lazy(() => import("./pages/Finance/DatevExport"));
const FinanceAuditRevision = lazy(() => import("./pages/Finance/AuditRevision"));
const FinanceZahlungen = lazy(() => import("./pages/Finance/Zahlungen"));
const FinanceVertraege = lazy(() => import("./pages/Finance/Vertraege"));
const FinanceMahnwesen = lazy(() => import("./pages/Finance/Mahnwesen"));
const FinanceMahnwesenDetail = lazy(() => import("./pages/Finance/MahnwesenDetail"));
const FinanceMahnwesenSettings = lazy(() => import("./pages/Finance/MahnwesenSettings"));
const FinanceDatev = lazy(() => import("./pages/Finance/Datev"));
const FinanceBank = lazy(() => import("./pages/Finance/Bank"));
const FinanceSepa = lazy(() => import("./pages/Finance/Sepa"));
const FinanceSteuer = lazy(() => import("./pages/Finance/Steuer"));
const FinanceCockpit = lazy(() => import("./pages/Finance/Cockpit"));
const FinanceCockpitMandant = lazy(() => import("./pages/Finance/MandantDrilldown"));
const FinanceSystemstatus = lazy(() => import("./pages/Finance/Systemstatus"));
const FinanceRaten = lazy(() => import("./pages/Finance/Raten"));
const FinanceBelege = lazy(() => import("./pages/Finance/Belege"));
const FinanceEingangsrechnungen = lazy(() => import("./pages/Finance/Eingangsrechnungen"));
const FinanceAnlagen = lazy(() => import("./pages/Finance/Anlagen"));
const FinanceAfaLauf = lazy(() => import("./pages/Finance/AfaLauf"));
const FinanceLiquiditaet = lazy(() => import("./pages/Finance/Liquiditaet"));
const FinanceBwa = lazy(() => import("./pages/Finance/Bwa"));
const FinanceGuV = lazy(() => import("./pages/Finance/GuV"));
const FinanceBilanz = lazy(() => import("./pages/Finance/Bilanz"));
const FinanceJahresabschluss = lazy(() => import("./pages/Finance/Jahresabschluss"));
const FinanceBudget = lazy(() => import("./pages/Finance/Budget"));
const FinanceSollIst = lazy(() => import("./pages/Finance/SollIst"));
const FinanceForecast = lazy(() => import("./pages/Finance/Forecast"));
const FinanceControlling = lazy(() => import("./pages/Finance/Controlling"));
const FinanceAiInsights = lazy(() => import("./pages/Finance/AiInsights"));
const FinanceAnomalien = lazy(() => import("./pages/Finance/Anomalien"));
const FinanceAsk = lazy(() => import("./pages/Finance/Ask"));
const FinanceAutomations = lazy(() => import("./pages/Finance/Automations"));
const FinanceFreigaben = lazy(() => import("./pages/Finance/Freigaben"));
const FinanceCompliance = lazy(() => import("./pages/Finance/Compliance"));
const FinanceReports = lazy(() => import("./pages/Finance/Reports"));
const FinanceReportSchedules = lazy(() => import("./pages/Finance/ReportSchedules"));
const FinanceManagementPack = lazy(() => import("./pages/Finance/ManagementPack"));
const FinanceStakeholders = lazy(() => import("./pages/Finance/Stakeholders"));
const StakeholderPortal = lazy(() => import("./pages/StakeholderPortal"));
const PdfAb = lazy(() => import("./pages/PdfAb"));
const FinanceKonsolidierung = lazy(() => import("./pages/Finance/Konsolidierung"));
const FinanceKonsolidierungDetail = lazy(() => import("./pages/Finance/KonsolidierungDetail"));
const FinanceIntercompany = lazy(() => import("./pages/Finance/Intercompany"));
const FinanceFxRates = lazy(() => import("./pages/Finance/FxRates"));
const FinanceTreasury = lazy(() => import("./pages/Finance/Treasury"));
const FinanceP2P = lazy(() => import("./pages/Finance/P2P"));
const FinanceMeldewesen = lazy(() => import("./pages/Finance/Meldewesen"));
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
const BestellwesenOverview = lazy(() => import("./pages/BestellwesenOverview"));
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
const AngebotImport = lazy(() => import("./pages/AngebotImport"));
const SalesLeadsList = lazy(() => import("./pages/SalesLeads/List"));
const SalesLeadDetail = lazy(() => import("./pages/SalesLeads/Detail"));
const SalesFollowups = lazy(() => import("./pages/SalesLeads/Followups"));
const NeueAnfrage = lazy(() => import("./pages/SalesLeads/NeueAnfrage"));
const SalesLeadsDashboard = lazy(() => import("./pages/SalesLeads/Dashboard"));
const SalesLeadsImport = lazy(() => import("./pages/SalesLeads/Import"));
const PublicBeratung = lazy(() => import("./pages/PublicBeratung"));
const Angebote = lazy(() => import("./pages/Angebote"));
const AngebotsKalender = lazy(() => import("./pages/Sales/AngebotsKalender"));
const Anzahlungsrechnung = lazy(() => import("./pages/Anzahlungsrechnung"));
const Gutschriften = lazy(() => import("./pages/Gutschriften"));
const Freigabe = lazy(() => import("./pages/Freigabe"));
const VerkaufUebersicht = lazy(() => import("./pages/VerkaufUebersicht"));
const Operation = lazy(() => import("./pages/Operation"));
const SecurityCenter = lazy(() => import("./pages/SecurityCenter"));
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
const AuftragStatus = lazy(() => import("./pages/AuftragStatus"));
const Geraetesperren = lazy(() => import("./pages/Geraetesperren"));
const Systemwartung = lazy(() => import("./pages/Systemwartung"));
const HealthCheck = lazy(() => import("./pages/HealthCheck"));
const Nummernkreise = lazy(() => import("./pages/operation/Nummernkreise"));
const AngebotsKalenderConfig = lazy(() => import("./pages/Operation/AngebotsKalenderConfig"));
const SmsKonfiguration = lazy(() => import("./pages/operation/SmsKonfiguration"));
const AlixCopilotKonfiguration = lazy(() => import("./pages/Operation/AlixCopilotKonfiguration"));
const AlixCopilotConfig = lazy(() => import("./pages/Operation/AlixCopilotConfig"));
const KundenportalKonfiguration = lazy(() => import("./pages/Operation/KundenportalKonfiguration"));
const Datensicherung = lazy(() => import("./pages/operation/Datensicherung"));
const FortKnox = lazy(() => import("./pages/operation/FortKnox"));
const Mandanten = lazy(() => import("./pages/Mandanten"));
const TicketDepartments = lazy(() => import("./pages/Operation/TicketDepartments"));
const AppointmentAction = lazy(() => import("./pages/PublicAppointment/AppointmentAction"));
const KonzernDashboard = lazy(() => import("./pages/KonzernDashboard"));
const MobileLayout = lazy(() => import("./pages/Mobile/Layout"));
const MobileHome = lazy(() => import("./pages/Mobile/Home"));
const MobileEinsatz = lazy(() => import("./pages/Mobile/Einsatz"));
const MobileFotos = lazy(() => import("./pages/Mobile/Fotos"));
const MobileSignatur = lazy(() => import("./pages/Mobile/Signatur"));
const MobileChecklist = lazy(() => import("./pages/Mobile/Checkliste"));
const MobileSync = lazy(() => import("./pages/Mobile/Sync"));
const MobileProfil = lazy(() => import("./pages/Mobile/Profil"));
const MobileSprachnotiz = lazy(() => import("./pages/Mobile/Sprachnotiz"));
const AdminAuditLog = lazy(() => import("./pages/Admin/AuditLog"));
const AlixSmartMigration = lazy(() => import("./pages/AlixSmartMigration"));
const AlixSmartKonfliktaufloesung = lazy(() => import("./pages/AlixSmartKonfliktaufloesung"));
const Geraeteakte = lazy(() => import("./pages/Geraeteakte"));
const GeraeteLebenslauf = lazy(() => import("./pages/GeraeteLebenslauf"));
const Wartungscenter = lazy(() => import("./pages/Wartungscenter"));
const Wartungsmanagement = lazy(() => import("./pages/Wartungsmanagement"));
const Garantiecenter = lazy(() => import("./pages/Garantiecenter"));
const GarantieKulanz = lazy(() => import("./pages/GarantieKulanz"));
const AlixSignPublic = lazy(() => import("./pages/AlixSignPublic"));
const AlixSignPdfDownload = lazy(() => import("./pages/AlixSignPdfDownload"));
const OrderDocDownload = lazy(() => import("./pages/OrderDocDownload"));
const WhatsAppServiceCenter = lazy(() => import("./pages/WhatsAppServiceCenter"));
const BugCapaLayoutLazy = lazy(() => import("./pages/BugCapa/_shared").then(m => ({ default: m.BugCapaLayout })));
const BugCapaDashboard = lazy(() => import("./pages/BugCapa/BugCapaDashboard"));
const BugCapaBugs = lazy(() => import("./pages/BugCapa/Bugs"));
const BugCapaCapas = lazy(() => import("./pages/BugCapa/Capas"));
const BugCapaReklamationen = lazy(() => import("./pages/BugCapa/Reklamationen"));
const BugCapaAudit = lazy(() => import("./pages/BugCapa/AuditFindings"));
const BugCapaMassnahmen = lazy(() => import("./pages/BugCapa/Massnahmen"));
const BugCapaBerichte = lazy(() => import("./pages/BugCapa/Berichte"));
const BugCapaAnalytics = lazy(() => import("./pages/BugCapa/Analytics"));
const BugCapaIsoReport = lazy(() => import("./pages/BugCapa/IsoReport"));
const IsoLayoutLazy = lazy(() => import("./pages/Iso/_shared").then(m => ({ default: m.IsoLayout })));
const IsoDashboard = lazy(() => import("./pages/Iso/Dashboard"));
const IsoAudits = lazy(() => import("./pages/Iso/Audits"));
const IsoTrainings = lazy(() => import("./pages/Iso/Trainings"));
const IsoSuppliers = lazy(() => import("./pages/Iso/Suppliers"));
const IsoChanges = lazy(() => import("./pages/Iso/Changes"));
const IsoVigilance = lazy(() => import("./pages/Iso/Vigilance"));
const KatalogLayoutLazy = lazy(() => import("./pages/Katalog/_shared").then(m => ({ default: m.KatalogLayout })));
const KatalogDashboard = lazy(() => import("./pages/Katalog/Dashboard"));
const KatalogArtikel = lazy(() => import("./pages/Katalog/Artikel"));
const KatalogArtikelDetail = lazy(() => import("./pages/Katalog/ArtikelDetail"));
const KatalogKategorien = lazy(() => import("./pages/Katalog/Kategorien"));
const KatalogLaender = lazy(() => import("./pages/Katalog/Laender"));
const KatalogNiederlassungen = lazy(() => import("./pages/Katalog/Niederlassungen"));
const KatalogPreisregeln = lazy(() => import("./pages/Katalog/Preisregeln"));
const KatalogProtokolle = lazy(() => import("./pages/Katalog/Protokolle"));
const KatalogImport = lazy(() => import("./pages/Katalog/Import"));
const KatalogExport = lazy(() => import("./pages/Katalog/Export"));
const AicLayout = lazy(() => import("./pages/AIC/Layout"));
const AicDashboard = lazy(() => import("./pages/AIC/Dashboard"));
const AicUnternehmen = lazy(() => import("./pages/AIC/Unternehmen"));
const AicForderungen = lazy(() => import("./pages/AIC/Forderungen"));
const AicVertrieb = lazy(() => import("./pages/AIC/Vertrieb"));
const AicService = lazy(() => import("./pages/AIC/Service"));
const AicMitarbeiter = lazy(() => import("./pages/AIC/Mitarbeiter"));
const AicForecasts = lazy(() => import("./pages/AIC/Forecasts"));
const AicTasks = lazy(() => import("./pages/AIC/Tasks"));
const AicBerichte = lazy(() => import("./pages/AIC/Berichte"));
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
const TicketCsat = lazy(() => import("./pages/Public/TicketCsat"));
const SecurityCenterLayout = lazy(() => import("./pages/SecurityCenter/Layout").then(m => ({ default: m.default })));
const SecurityCenterOverview = lazy(() => import("./pages/SecurityCenter/Layout").then(m => ({ default: m.SecurityCenterOverview })));
const SecurityInventory = lazy(() => import("./pages/SecurityCenter/Inventory"));
const SecurityRoles = lazy(() => import("./pages/SecurityCenter/Roles"));
const SecurityPermissions = lazy(() => import("./pages/SecurityCenter/Permissions"));
const SecurityPolicies = lazy(() => import("./pages/SecurityCenter/Policies"));
const SecurityStorage = lazy(() => import("./pages/SecurityCenter/Storage"));
const SecurityMfa = lazy(() => import("./pages/SecurityCenter/Mfa"));
const RfLayout = lazy(() => import("./pages/RollenFreigaben/Layout"));
const RfOverview = lazy(() => import("./pages/RollenFreigaben/Overview"));
const RfMatrix = lazy(() => import("./pages/RollenFreigaben/Matrix"));
const RfRoles = lazy(() => import("./pages/RollenFreigaben/RolesCards"));
const RfEmployees = lazy(() => import("./pages/RollenFreigaben/EmployeesCards"));
const RfEffective = lazy(() => import("./pages/RollenFreigaben/EffectiveAccess"));
const RfCompare = lazy(() => import("./pages/RollenFreigaben/RoleCompare"));
const RfRequests = lazy(() => import("./pages/RollenFreigaben/Requests"));
const RfAudit = lazy(() => import("./pages/RollenFreigaben/SecurityAudit"));
const RfLog = lazy(() => import("./pages/RollenFreigaben/AuditLog"));
const RfViewAs = lazy(() => import("./pages/RollenFreigaben/ViewAs"));
const RfTempGrants = lazy(() => import("./pages/RollenFreigaben/TempGrants"));
const RfDataClasses = lazy(() => import("./pages/RollenFreigaben/DataClasses"));
const RfNotifications = lazy(() => import("./pages/RollenFreigaben/Notifications"));
const RfBulk = lazy(() => import("./pages/RollenFreigaben/BulkImportExport"));
const RfRecert = lazy(() => import("./pages/RollenFreigaben/Recertification"));
const RfTemplates = lazy(() => import("./pages/RollenFreigaben/TemplatesOnboarding"));
const RfAnalytics = lazy(() => import("./pages/RollenFreigaben/Analytics"));
const RfBreakGlass = lazy(() => import("./pages/RollenFreigaben/BreakGlass"));
const RfContext = lazy(() => import("./pages/RollenFreigaben/ContextPolicies"));
const RfSoD = lazy(() => import("./pages/RollenFreigaben/SoD"));
const RfSSO = lazy(() => import("./pages/RollenFreigaben/SSO"));
const RfScheduled = lazy(() => import("./pages/RollenFreigaben/ScheduledGrants"));
const RfChains = lazy(() => import("./pages/RollenFreigaben/ApprovalChains"));
const RfLifecycle = lazy(() => import("./pages/RollenFreigaben/LifecycleDashboard"));
const RfAuditExport = lazy(() => import("./pages/RollenFreigaben/AuditExport"));
const SelfServiceRoles = lazy(() => import("./pages/SelfService/Roles"));

const SecurityFindings = lazy(() => import("./pages/SecurityCenter/Findings"));
const SecurityPentest = lazy(() => import("./pages/SecurityCenter/Pentest"));
const SecurityCompliance = lazy(() => import("./pages/SecurityCenter/Compliance"));
const SecuritySimulate = lazy(() => import("./pages/SecurityCenter/Simulate"));
const SecurityPlan = lazy(() => import("./pages/SecurityCenter/Plan"));
const PortalStatus = lazy(() => import("./pages/Portal/Status"));
const PortalAdmin = lazy(() => import("./pages/PortalAdmin"));
const MailCenterLayout = lazy(() => import("./pages/MailCenter/Layout"));
const MailCenterDashboard = lazy(() => import("./pages/MailCenter/Dashboard"));
const MailCenterCompose = lazy(() => import("./pages/MailCenter/Compose"));
const MailCenterVorlagen = lazy(() => import("./pages/MailCenter/Vorlagen"));
const MailCenterKampagnen = lazy(() => import("./pages/MailCenter/Kampagnen"));
const MailCenterAutomationen = lazy(() => import("./pages/MailCenter/Automationen"));
const MailCenterTracking = lazy(() => import("./pages/MailCenter/Tracking"));
const MailCenterAbmeldungen = lazy(() => import("./pages/MailCenter/Abmeldungen"));
const MailCenterDomains = lazy(() => import("./pages/MailCenter/Domains"));
const MailCenterBerichte = lazy(() => import("./pages/MailCenter/Berichte"));
const MailCenterEinstellungen = lazy(() => import("./pages/MailCenter/Einstellungen"));
const MailCenterKIAssistent = lazy(() => import("./pages/MailCenter/KIAssistent"));
const MailCenterDokumentenCenter = lazy(() => import("./pages/MailCenter/DokumentenCenter"));
const MailCenterVersandnachweise = lazy(() => import("./pages/MailCenter/Versandnachweise"));
const MailCenterDokumentenVorlagen = lazy(() => import("./pages/MailCenter/DokumentenVorlagen"));
const MailCenterDokumentenAutomationen = lazy(() => import("./pages/MailCenter/DokumentenAutomationen"));
const CustomerPortalLayout = lazy(() => import("./pages/CustomerPortal/Layout"));
const CustomerPortalLogin = lazy(() => import("./pages/CustomerPortal/Login"));
const CustomerPortalDashboard = lazy(() => import("./pages/CustomerPortal/Dashboard"));
const CustomerPortalMessages = lazy(() => import("./pages/CustomerPortal/Messages"));
const CustomerPortalDocuments = lazy(() => import("./pages/CustomerPortal/Documents"));
const CustomerPortalInvoices = lazy(() => import("./pages/CustomerPortal/Invoices"));
const CustomerPortalQuotes = lazy(() => import("./pages/CustomerPortal/Quotes"));
const CustomerPortalRepairs = lazy(() => import("./pages/CustomerPortal/Repairs"));
const CustomerPortalSupport = lazy(() => import("./pages/CustomerPortal/Support"));
const CustomerPortalReviews = lazy(() => import("./pages/CustomerPortal/Reviews"));
const CustomerPortalTimeline = lazy(() => import("./pages/CustomerPortal/Timeline"));
const CustomerPortalDevices = lazy(() => import("./pages/CustomerPortal/Devices"));
const CustomerPortalOrders = lazy(() => import("./pages/CustomerPortal/Orders"));
const CustomerPortalMaintenance = lazy(() => import("./pages/CustomerPortal/Maintenance"));
const CustomerPortalWarranty = lazy(() => import("./pages/CustomerPortal/Warranty"));
const CustomerPortalTickets = lazy(() => import("./pages/CustomerPortal/Tickets"));
const CustomerPortalAppointments = lazy(() => import("./pages/CustomerPortal/Appointments"));
const CustomerPortalHealth = lazy(() => import("./pages/CustomerPortal/Health"));
const MailCenterPosteingang = lazy(() => import("./pages/MailCenter/Posteingang"));
const MailCenterGesendet = lazy(() => import("./pages/MailCenter/Gesendet"));
const MailCenterEntwuerfe = lazy(() => import("./pages/MailCenter/Entwuerfe"));
const MailCenterInternal = lazy(() => import("./pages/MailCenter/InterneNachrichten"));
const MailCenterTelefonnotizen = lazy(() => import("./pages/MailCenter/Telefonnotizen"));
const MailCenterGespraechsprotokolle = lazy(() => import("./pages/MailCenter/Gespraechsprotokolle"));
const MailCenterAufgaben = lazy(() => import("./pages/MailCenter/Aufgaben"));
const MailCenterWiedervorlagen = lazy(() => import("./pages/MailCenter/Wiedervorlagen"));
const MailCenterBerechtigungen = lazy(() => import("./pages/MailCenter/Berechtigungen"));
const MailCenterSystemstatus = lazy(() => import("./pages/MailCenter/Systemstatus"));
const MailCenterAuditLog = lazy(() => import("./pages/MailCenter/AuditLog"));
const MailCenterFehlerprotokoll = lazy(() => import("./pages/MailCenter/Fehlerprotokoll"));
const MailCenterTestcenter = lazy(() => import("./pages/MailCenter/Testcenter"));
const MailCenterProduktivfreigabe = lazy(() => import("./pages/MailCenter/Produktivfreigabe"));
const MailCenterExecutive = lazy(() => import("./pages/MailCenter/ExecutiveDashboard"));
const MailCenterTelefonie = lazy(() => import("./pages/MailCenter/Telefonie"));
const MailCenterBackup = lazy(() => import("./pages/MailCenter/BackupCenter"));
const MailCenterImport = lazy(() => import("./pages/MailCenter/ImportCenter"));
const MailCenterExport = lazy(() => import("./pages/MailCenter/ExportCenter"));
const MailCenterSpam = lazy(() => import("./pages/MailCenter/SpamCheck"));
const MailCenterQS = lazy(() => import("./pages/MailCenter/Qualitaetssicherung"));
const MailCenterSchulung = lazy(() => import("./pages/MailCenter/Schulungscenter"));
const MailCenterValidierung = lazy(() => import("./pages/MailCenter/Systemvalidierung"));
const TicketsList = lazy(() => import("./pages/Tickets/TicketsList"));
const TicketsDashboard = lazy(() => import("./pages/Tickets/TicketsDashboard"));
const TicketCalendar = lazy(() => import("./pages/Tickets/TicketCalendar"));
const TicketDetail = lazy(() => import("./pages/Tickets/TicketDetail"));
const TicketByExternal = lazy(() => import("./pages/Tickets/TicketByExternal"));
const TicketsApiSync = lazy(() => import("./pages/Tickets/ApiSyncSettings"));
const TicketsSyncMonitor = lazy(() => import("./pages/Tickets/SyncMonitor"));
const AiServiceCenter = lazy(() => import("./pages/AiServiceCenter"));
const OperationMahnungKonfiguration = lazy(() => import("./pages/Operation/MahnungKonfiguration"));
const AfterSalesDashboard = lazy(() => import("./pages/AfterSales/Dashboard"));
const AfterSalesCaseDetail = lazy(() => import("./pages/AfterSales/CaseDetail"));
const AfterSalesCompleted = lazy(() => import("./pages/AfterSales/Completed"));
const AfterSalesReports = lazy(() => import("./pages/AfterSales/Reports"));
// ESC – Enterprise Scheduling Center (Teamkalender)
const EscLayout = lazy(() => import("./components/esc/EscLayout"));
const EscOverview = lazy(() => import("./pages/ESC/Overview"));
const EscCalendar = lazy(() => import("./pages/ESC/Calendar"));
const EscDepartments = lazy(() => import("./pages/ESC/Departments"));
const EscAppointmentKinds = lazy(() => import("./pages/ESC/AppointmentKinds"));
const EscEmployees = lazy(() => import("./pages/ESC/Employees"));
const EscResources = lazy(() => import("./pages/ESC/Resources"));
const EscBookings = lazy(() => import("./pages/ESC/Bookings"));
const EscConfirmations = lazy(() => import("./pages/ESC/Confirmations"));
const EscSettings = lazy(() => import("./pages/ESC/Settings"));
const EscEmailTemplates = lazy(() => import("./pages/ESC/EmailTemplates"));
const EscAuditLog = lazy(() => import("./pages/ESC/AuditLog"));
const EscTouren = lazy(() => import("./pages/ESC/Touren"));
const RmHub = lazy(() => import("./pages/ESC/rm/Hub"));
const RmEmployees = lazy(() => import("./pages/ESC/rm/Employees"));
const RmVehicles = lazy(() => import("./pages/ESC/rm/Vehicles"));
const RmDevices = lazy(() => import("./pages/ESC/rm/Devices"));
const RmRooms = lazy(() => import("./pages/ESC/rm/Rooms"));
const RmField = lazy(() => import("./pages/ESC/rm/Field"));
const RmCapacity = lazy(() => import("./pages/ESC/rm/Capacity"));
const RmDispatch = lazy(() => import("./pages/ESC/rm/Dispatch"));
const RmLocations = lazy(() => import("./pages/ESC/rm/Locations"));
const AiLayout = lazy(() => import("./components/esc/ai/AiLayout"));
const AiDashboard = lazy(() => import("./pages/ESC/ai/Dashboard"));
const AiScheduler = lazy(() => import("./pages/ESC/ai/Scheduler"));
const AiResourcesPage = lazy(() => import("./pages/ESC/ai/Resources"));
const AiRoutesPage = lazy(() => import("./pages/ESC/ai/Routes"));
const AiCapacity = lazy(() => import("./pages/ESC/ai/Capacity"));
const AiForecasts = lazy(() => import("./pages/ESC/ai/Forecasts"));
const AiRecommendations = lazy(() => import("./pages/ESC/ai/Recommendations"));
const AiSearchPage = lazy(() => import("./pages/ESC/ai/Search"));
const AiProtocol = lazy(() => import("./pages/ESC/ai/Protocol"));
const AiSettingsPage = lazy(() => import("./pages/ESC/ai/Settings"));
const EchLayout = lazy(() => import("./components/esc/ech/EchLayout"));
const EchDashboard = lazy(() => import("./pages/ESC/ech/Dashboard"));
const EchCompose = lazy(() => import("./pages/ESC/ech/Compose"));
const EchCalendar = lazy(() => import("./pages/ESC/ech/Calendar"));
const EchReminders = lazy(() => import("./pages/ESC/ech/Reminders"));
const EchMeetings = lazy(() => import("./pages/ESC/ech/Meetings"));
const EchNotifications = lazy(() => import("./pages/ESC/ech/Notifications"));
const EchIntegrations = lazy(() => import("./pages/ESC/ech/Integrations"));
const EchTemplates = lazy(() => import("./pages/ESC/ech/Templates"));
const EchHistory = lazy(() => import("./pages/ESC/ech/History"));
const EchSettingsPage = lazy(() => import("./pages/ESC/ech/Settings"));
const EscBookingPortal = lazy(() => import("./pages/ESC/public/BookingPortal"));
const MediapaketWizard = lazy(() => import("./pages/mediapaket/MediapaketWizard"));
const MediapaketOverview = lazy(() => import("./pages/mediapaket/MediapaketOverview"));
const MediapaketAdmin = lazy(() => import("./pages/mediapaket/MediapaketAdmin"));
const MediapaketPrint = lazy(() => import("./pages/mediapaket/MediapaketPrint"));
const MediapaketPreview = lazy(() => import("./pages/mediapaket/MediapaketPreview"));
const MediapaketTemplates = lazy(() => import("./pages/mediapaket/MediapaketTemplates"));
const MediapaketAnalytics = lazy(() => import("./pages/mediapaket/MediapaketAnalytics"));
const MediapaketShowcase = lazy(() => import("./pages/mediapaket/MediapaketShowcase"));
const EscConfirmAppointment = lazy(() => import("./pages/ESC/public/ConfirmAppointment"));
const EscRescheduleAppointment = lazy(() => import("./pages/ESC/public/RescheduleAppointment"));
const EscCancelAppointment = lazy(() => import("./pages/ESC/public/CancelAppointment"));
const EscCheckin = lazy(() => import("./pages/ESC/public/Checkin"));

// EMP – Enterprise Mobile Platform
const EmpLayout = lazy(() => import("./components/emp/EmpLayout"));
const EmpHome = lazy(() => import("./pages/EMP/Home"));
const EmpCalendar = lazy(() => import("./pages/EMP/Calendar"));
const EmpCustomers = lazy(() => import("./pages/EMP/Customers"));
const EmpCustomerDetail = lazy(() => import("./pages/EMP/CustomerDetail"));
const EmpTasks = lazy(() => import("./pages/EMP/Tasks"));
const EmpMore = lazy(() => import("./pages/EMP/More"));
const EmpAppointmentDetail = lazy(() => import("./pages/EMP/AppointmentDetail"));
const EmpServiceReport = lazy(() => import("./pages/EMP/ServiceReport"));
const EmpApprovals = lazy(() => import("./pages/EMP/Approvals"));
const EmpDashboard = lazy(() => import("./pages/EMP/Dashboard"));
const EmpNotifications = lazy(() => import("./pages/EMP/Notifications"));
const EmpSync = lazy(() => import("./pages/EMP/Sync"));
const EmpSettingsPage = lazy(() => import("./pages/EMP/Settings"));

// ABIC – Enterprise Analytics & Business Intelligence Center
const AbicLayout = lazy(() => import("./components/abic/AbicLayout"));
const AbicSection = lazy(() => import("./pages/ABIC/SectionPage"));
const AbicKpiDesigner = lazy(() => import("./pages/ABIC/KpiDesigner"));
const AbicReports = lazy(() => import("./pages/ABIC/Reports"));
const AbicExplorer = lazy(() => import("./pages/ABIC/DataExplorer"));
const AbicDashboards = lazy(() => import("./pages/ABIC/Dashboards"));
const AbicGoals = lazy(() => import("./pages/ABIC/Goals"));

// ECQM – Enterprise Compliance & Quality Management Center
const EcqmLayout = lazy(() => import("./components/ecqm/EcqmLayout"));
const EcqmDashboard = lazy(() => import("./pages/ECQM/Dashboard"));
const EcqmDocuments = lazy(() => import("./pages/ECQM/Documents"));
const EcqmProcesses = lazy(() => import("./pages/ECQM/Processes"));
const EcqmCapa = lazy(() => import("./pages/ECQM/Capa"));
const EcqmComplaints = lazy(() => import("./pages/ECQM/Complaints"));
const EcqmRisks = lazy(() => import("./pages/ECQM/Risks"));
const EcqmAudits = lazy(() => import("./pages/ECQM/Audits"));
const EcqmSuppliers = lazy(() => import("./pages/ECQM/Suppliers"));
const EcqmChangeControl = lazy(() => import("./pages/ECQM/ChangeControl"));
const EcqmTraceability = lazy(() => import("./pages/ECQM/Traceability"));
const EcqmTrainings = lazy(() => import("./pages/ECQM/Trainings"));
const EcqmQualifications = lazy(() => import("./pages/ECQM/Qualifications"));
const EcqmManagementReview = lazy(() => import("./pages/ECQM/ManagementReview"));
const EcqmKpis = lazy(() => import("./pages/ECQM/Kpis"));
const EcqmApprovals = lazy(() => import("./pages/ECQM/Approvals"));
const EcqmArchive = lazy(() => import("./pages/ECQM/Archive"));
const EcqmSettings = lazy(() => import("./pages/ECQM/Settings"));

// EAOC – Enterprise Administration & Organization Center
const EaocLayout = lazy(() => import("./components/eaoc/EaocLayout"));
const EaocDashboard = lazy(() => import("./pages/EAOC/Dashboard"));
const EaocCompanies = lazy(() => import("./pages/EAOC/Companies"));
const EaocTenants = lazy(() => import("./pages/EAOC/Tenants"));
const EaocLocations = lazy(() => import("./pages/EAOC/Locations"));
const EaocDepartments = lazy(() => import("./pages/EAOC/Departments"));
const EaocTeams = lazy(() => import("./pages/EAOC/Teams"));
const EaocUsers = lazy(() => import("./pages/EAOC/Users"));
const EaocRoles = lazy(() => import("./pages/EAOC/Roles"));
const EaocPermissions = lazy(() => import("./pages/EAOC/Permissions"));
const EaocOrgChart = lazy(() => import("./pages/EAOC/OrgChart"));
const EaocBranding = lazy(() => import("./pages/EAOC/Branding"));
const EaocIntegrations = lazy(() => import("./pages/EAOC/Integrations"));
const EaocApiKeys = lazy(() => import("./pages/EAOC/ApiKeys"));
const EaocWebhooks = lazy(() => import("./pages/EAOC/Webhooks"));
const EaocLicenses = lazy(() => import("./pages/EAOC/Licenses"));
const EaocSecurity = lazy(() => import("./pages/EAOC/Security"));
const EaocBackups = lazy(() => import("./pages/EAOC/Backups"));
const EaocMonitoring = lazy(() => import("./pages/EAOC/Monitoring"));
const EaocMaintenance = lazy(() => import("./pages/EAOC/Maintenance"));
const EaocNotifications = lazy(() => import("./pages/EAOC/Notifications"));
const EaocExport = lazy(() => import("./pages/EAOC/Export"));
const EaocImport = lazy(() => import("./pages/EAOC/Import"));
const EaocJobs = lazy(() => import("./pages/EAOC/Jobs"));
const EaocSearch = lazy(() => import("./pages/EAOC/Search"));
const EaocPrivacy = lazy(() => import("./pages/EAOC/Privacy"));
const EaocAudit = lazy(() => import("./pages/EAOC/Audit"));
const EaocSettings = lazy(() => import("./pages/EAOC/Settings"));
const EaocDeveloper = lazy(() => import("./pages/EAOC/Developer"));

// EIG – Enterprise Integration Gateway
const EigLayout = lazy(() => import("./components/eig/EigLayout"));
const EigDashboard = lazy(() => import("./pages/EIG/Dashboard"));
const EigApiGateway = lazy(() => import("./pages/EIG/ApiGateway"));
const EigApiExplorer = lazy(() => import("./pages/EIG/ApiExplorer"));
const EigWebhooks = lazy(() => import("./pages/EIG/Webhooks"));
const EigEventBus = lazy(() => import("./pages/EIG/EventBus"));
const EigWorkflowEngine = lazy(() => import("./pages/EIG/WorkflowEngine"));
const EigIntegrations = lazy(() => import("./pages/EIG/Integrations"));
const EigMappings = lazy(() => import("./pages/EIG/Mappings"));
const EigImportExport = lazy(() => import("./pages/EIG/ImportExport"));
const EigJobs = lazy(() => import("./pages/EIG/Jobs"));
const EigQueues = lazy(() => import("./pages/EIG/Queues"));
const EigSync = lazy(() => import("./pages/EIG/Sync"));
const EigPlugins = lazy(() => import("./pages/EIG/Plugins"));
const EigApiKeys = lazy(() => import("./pages/EIG/ApiKeys"));
const EigErrors = lazy(() => import("./pages/EIG/Errors"));
const EigMonitoring = lazy(() => import("./pages/EIG/Monitoring"));
const EigLogs = lazy(() => import("./pages/EIG/Logs"));
const EigDeveloper = lazy(() => import("./pages/EIG/Developer"));

// RC1 – Enterprise Release Candidate
const Rc1Layout = lazy(() => import("./components/rc1/Rc1Layout"));
const Rc1Dashboard = lazy(() => import("./pages/RC1/Dashboard"));
const Rc1GoLive = lazy(() => import("./pages/RC1/GoLive"));
const Rc1Readiness = lazy(() => import("./pages/RC1/Readiness"));
const Rc1TestCenter = lazy(() => import("./pages/RC1/TestCenter"));
const Rc1Production = lazy(() => import("./pages/RC1/Production"));
const Rc1Updates = lazy(() => import("./pages/RC1/Updates"));
const Rc1GlobalSearch = lazy(() => import("./pages/RC1/GlobalSearch"));
const Rc1Quality = lazy(() => import("./pages/RC1/Quality"));
const Rc1License = lazy(() => import("./pages/RC1/License"));
const Rc1Info = {
  Navigation: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Navigation }))),
  Notifications: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Notifications }))),
  Performance: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Performance }))),
  Database: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Database }))),
  Security: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Security }))),
  Permissions: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Permissions }))),
  Accessibility: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Accessibility }))),
  Mobile: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Mobile }))),
  Errors: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Errors }))),
  Logging: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Logging }))),
  Monitoring: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Monitoring }))),
  Releases: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Releases }))),
  Installer: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Installer }))),
  Migration: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Migration }))),
  Docs: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Docs }))),
  DevDocs: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1DevDocs }))),
  DesignReview: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1DesignReview }))),
  I18n: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1I18n }))),
  Backup: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Backup }))),
  Startseite: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Startseite }))),
  Future: lazy(() => import("./pages/RC1/InfoPages").then(m => ({ default: m.Rc1Future }))),
};

// ECP – Enterprise Customer Portal
const EcpLayout = lazy(() => import("./components/ecp/EcpLayout"));
const EcpDashboard = lazy(() => import("./pages/ECP/Dashboard"));
const EcpAppointments = lazy(() => import("./pages/ECP/Appointments"));
const EcpDevices = lazy(() => import("./pages/ECP/Devices"));
const EcpDeviceDetail = lazy(() => import("./pages/ECP/DeviceDetail"));
const EcpService = lazy(() => import("./pages/ECP/Service"));
const EcpTickets = lazy(() => import("./pages/ECP/Tickets"));
const EcpTrainings = lazy(() => import("./pages/ECP/Trainings"));
const EcpDocuments = lazy(() => import("./pages/ECP/Documents"));
const EcpInvoices = lazy(() => import("./pages/ECP/Invoices"));
const EcpQuotes = lazy(() => import("./pages/ECP/Quotes"));
const EcpMessages = lazy(() => import("./pages/ECP/Messages"));
const EcpDownloads = lazy(() => import("./pages/ECP/Downloads"));
const EcpProfile = lazy(() => import("./pages/ECP/Profile"));
const EcpLocations = lazy(() => import("./pages/ECP/Locations"));
const EcpContacts = lazy(() => import("./pages/ECP/Contacts"));
const EcpDealer = lazy(() => import("./pages/ECP/Dealer"));
const EcpServicePartner = lazy(() => import("./pages/ECP/ServicePartner"));
const EcpSupplier = lazy(() => import("./pages/ECP/Supplier"));
const EcpSearch = lazy(() => import("./pages/ECP/Search"));
const EcpNotifications = lazy(() => import("./pages/ECP/Notifications"));
const EcpAdmin = lazy(() => import("./pages/ECP/Admin"));
import MaintenanceGate from "./components/MaintenanceGate";
import LeihgeraetReminder from "./components/LeihgeraetReminder";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Daten gelten 2 Minuten als frisch; danach wird im Hintergrund erneuert,
      // während der Cache sofort angezeigt wird (kein Spinner beim Zurücknavigieren).
      staleTime: 2 * 60_000,
      // Caches bleiben 15 Minuten nach dem letzten Verbrauch im Speicher.
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const ORDER_ROLES = ['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Tourenplanung', 'Finance', 'Österreich'];
const PLANNING_ROLES = ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Österreich'];
const FINANCE_ROLES = ['Admin', 'Super Admin'];
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
const TICKETS_ROLES = ['Admin', 'Super Admin', 'Kundenservice', 'Technik', 'Finance', 'Tourenplanung'];
const AI_SERVICE_ROLES = ['Admin', 'Super Admin', 'Service', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance'];

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
  if (!user) return <Navigate to="/alix-control" replace />;
  if (blockReason) return <AccountBlocked />;

  // MFA-Pflicht: Nur für definierte Rollen wird die Einrichtung erzwungen.
  // Wenn MFA bereits eingerichtet wurde, MUSS der Code in jedem Fall verifiziert werden.
  const mfaMandatory = isMfaMandatory(roles);
  if (mfaState === 'not_enrolled' && mfaMandatory) return <Navigate to="/mfa-setup" replace />;
  if (mfaState === 'challenge_required') return <Navigate to="/mfa-challenge" replace />;
  if (mfaState === 'unknown') return <FullscreenLoader />;
  // mfaState ist nun 'verified' ODER 'not_enrolled' für nicht-pflichtige Rollen → Zugriff erlauben.

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
  if (!user) return <Navigate to="/alix-control" replace />;
  if (blockReason) return <AccountBlocked />;
  if (mfaState === 'verified') return <Navigate to="/dashboard" replace />;
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
  if (roles.length > 0 && roles.every((r) => r === 'Finanzierungen')) {
    return <Navigate to="/finanzierungen" replace />;
  }
  // Rolle Österreich (ohne Admin) bekommt dediziertes AT-Dashboard
  if (roles.includes('Österreich') && !roles.includes('Super Admin') && !roles.includes('Admin')) {
    return <Navigate to="/at-dashboard" replace />;
  }
  return <Dashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  useSyncRevenueMaskGlobal();

  if (loading) return <FullscreenLoader />;

  return (
    <Suspense fallback={null}>
      <Routes>
        {/* Öffentliche Landing-Page: / und /login zeigen IMMER nur Landing, niemals Redirect */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Landing />} />
        {/* Verdeckte Login-Aliasse (nicht im Menü, nicht in Sitemap, noindex) */}
        <Route path="/alix-control" element={user ? <Navigate to="/dashboard" replace /> : <CovertLogin />} />
        <Route path="/alix-secure" element={user ? <Navigate to="/dashboard" replace /> : <CovertLogin />} />
        <Route path="/alix-enterprise" element={user ? <Navigate to="/dashboard" replace /> : <CovertLogin />} />
        <Route path="/passwort-setzen" element={<SetPassword />} />
        <Route path="/stakeholder/:token" element={<StakeholderPortal />} />
        <Route path="/pdf/ab" element={<PdfAb />} />
        <Route path="/mfa-setup" element={<MfaGate expect="not_enrolled"><MfaSetup /></MfaGate>} />
        <Route path="/mfa-challenge" element={<MfaGate expect="challenge_required"><MfaChallenge /></MfaGate>} />
        <Route path="/mfa-recovery" element={<MfaGate expect="any"><MfaRecovery /></MfaGate>} />
        {/* ESC – öffentliche Routen (kein Login) */}
        <Route path="/book" element={<EscBookingPortal />} />
        {/* ESC – öffentliche Routen (kein Login) */}
        <Route path="/book" element={<EscBookingPortal />} />
        <Route path="/book/mediapaket" element={<MediapaketWizard />} />
        <Route path="/preview/mediapaket" element={<MediapaketPreview />} />
        <Route path="/mediapaket/showcase/:token" element={<MediapaketShowcase />} />
        <Route path="/book/confirmation" element={<EscBookingPortal />} />
        <Route path="/book/:department" element={<EscBookingPortal />} />
        <Route path="/book/:department/:service" element={<EscBookingPortal />} />
        <Route path="/appointment/:token" element={<EscConfirmAppointment />} />
        <Route path="/appointment/reschedule/:token" element={<EscRescheduleAppointment />} />
        <Route path="/appointment/cancel/:token" element={<EscCancelAppointment />} />
        <Route path="/appointment/decline/:token" element={<EscCancelAppointment />} />
        <Route path="/booking/:token" element={<EscConfirmAppointment />} />
        <Route path="/termin-bestaetigen/:token" element={<EscConfirmAppointment />} />
        <Route path="/checkin/:token" element={<EscCheckin />} />
        <Route path="/esc/checkin/:token" element={<EscCheckin />} />
        <Route path="/termin/bestaetigen/:token" element={<AppointmentAction action="confirm" />} />
        <Route path="/termin/verschieben/:token" element={<AppointmentAction action="reschedule" />} />
        <Route path="/termin/ablehnen/:token" element={<AppointmentAction action="cancel" />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<HomeRoute />} />
          <Route path="/infinity-showcase" element={<InfinityShowcase />} />
          <Route path="/einstellungen/personalisierung" element={<Personalisierung />} />
          <Route path="/sicherheit" element={<Sicherheit />} />
          {/* ESC – Teamkalender */}
          <Route path="/esc" element={<ProtectedRoute><EscLayout /></ProtectedRoute>}>
            <Route index element={<EscOverview />} />
            <Route path="kalender" element={<EscCalendar />} />
            <Route path="ressourcen" element={<EscResources />} />
            <Route path="mitarbeiter" element={<EscEmployees />} />
            <Route path="abteilungen" element={<EscDepartments />} />
            <Route path="terminarten" element={<EscAppointmentKinds />} />
            <Route path="buchungen" element={<EscBookings />} />
            <Route path="bestaetigungen" element={<EscConfirmations />} />
            <Route path="einstellungen" element={<EscSettings />} />
            <Route path="einstellungen/email-vorlagen" element={<EscEmailTemplates />} />
            <Route path="audit" element={<EscAuditLog />} />
            <Route path="touren" element={<EscTouren />} />
            <Route path="rm" element={<RmHub />} />
            <Route path="rm/mitarbeiter" element={<RmEmployees />} />
            <Route path="rm/fahrzeuge" element={<RmVehicles />} />
            <Route path="rm/geraete" element={<RmDevices />} />
            <Route path="rm/raeume" element={<RmRooms />} />
            <Route path="rm/aussendienst" element={<RmField />} />
            <Route path="rm/kapazitaeten" element={<RmCapacity />} />
            <Route path="rm/einsatzplanung" element={<RmDispatch />} />
            <Route path="rm/standorte" element={<RmLocations />} />
          </Route>
          <Route path="/esc/ai" element={<ProtectedRoute><AiLayout /></ProtectedRoute>}>
            <Route index element={<AiDashboard />} />
            <Route path="terminassistent" element={<AiScheduler />} />
            <Route path="ressourcen" element={<AiResourcesPage />} />
            <Route path="touren" element={<AiRoutesPage />} />
            <Route path="kapazitaeten" element={<AiCapacity />} />
            <Route path="prognosen" element={<AiForecasts />} />
            <Route path="empfehlungen" element={<AiRecommendations />} />
            <Route path="suche" element={<AiSearchPage />} />
            <Route path="protokoll" element={<AiProtocol />} />
            <Route path="einstellungen" element={<AiSettingsPage />} />
          </Route>
          <Route path="/esc/ech" element={<ProtectedRoute><EchLayout /></ProtectedRoute>}>
            <Route index element={<EchDashboard />} />
            <Route path="kommunikation" element={<EchCompose />} />
            <Route path="kalender" element={<EchCalendar />} />
            <Route path="erinnerungen" element={<EchReminders />} />
            <Route path="meetings" element={<EchMeetings />} />
            <Route path="benachrichtigungen" element={<EchNotifications />} />
            <Route path="integrationen" element={<EchIntegrations />} />
            <Route path="vorlagen" element={<EchTemplates />} />
            <Route path="historie" element={<EchHistory />} />
            <Route path="einstellungen" element={<EchSettingsPage />} />
          </Route>
          <Route path="/at-dashboard" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Österreich']}><AtDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/bestellungen" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Auftragsverwaltung','Order','Bestellwesen','SACHBEARBEITUNG','Finance']}><BestellungenDashboard /></ProtectedRoute>} />
          <Route path="/dashboards/verkauf" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Auftragsverwaltung','Order','Vertrieb','Vertriebsleitung','SACHBEARBEITUNG']}><VerkaufDashboard /></ProtectedRoute>} />

          <Route path="/detailsuche" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Detailsuche /></ProtectedRoute>} />

          <Route path="/auftragsstatus" element={<ProtectedRoute><AuftragStatus /></ProtectedRoute>} />
          <Route path="/geraetesperren" element={<ProtectedRoute><Geraetesperren /></ProtectedRoute>} />
          <Route path="/kunden" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Customers /></ProtectedRoute>} />
          <Route path="/kunden/doppelte" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><DoppelteKunden /></ProtectedRoute>} />
          <Route path="/kunden/:id" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><CustomerDetail /></ProtectedRoute>} />
          <Route path="/auftraege" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Orders /></ProtectedRoute>} />
          <Route path="/auftraege-at" element={<ProtectedRoute><OrdersAt /></ProtectedRoute>} />
          <Route path="/auftraege-ch" element={<ProtectedRoute><OrdersCh /></ProtectedRoute>} />
          <Route path="/auftraege/in-klaerung" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><OrdersInClarification /></ProtectedRoute>} />
          <Route path="/auftraege/:id" element={<ProtectedRoute requiredRoles={[...ORDER_ROLES, 'Finanzierungen', 'Order']}><OrderDetail /></ProtectedRoute>} />
          <Route path="/mediapaket" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Order', 'Mediapaket', 'Auftragsverwaltung', 'SACHBEARBEITUNG']}><MediapaketOverview /></ProtectedRoute>} />
          <Route path="/mediapaket/admin" element={<ProtectedRoute requiredRoles={['Super Admin']}><MediapaketAdmin /></ProtectedRoute>} />
          <Route path="/mediapaket/templates" element={<ProtectedRoute requiredRoles={['Super Admin']}><MediapaketTemplates /></ProtectedRoute>} />
          <Route path="/mediapaket/print/:mpId" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Order', 'Mediapaket', 'Auftragsverwaltung', 'SACHBEARBEITUNG']}><MediapaketPrint /></ProtectedRoute>} />
          <Route path="/mediapaket/analytics" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin']}><MediapaketAnalytics /></ProtectedRoute>} />
          <Route path="/verkauf/artikel" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Artikel /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/katalog" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Katalog /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/kategorie" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Kategorie /></ProtectedRoute>} />
          <Route path="/verkauf/artikel/wareneingang" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Wareneingang /></ProtectedRoute>} />
          <Route path="/verkauf/artikel-uebersicht" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><ArtikelUebersicht /></ProtectedRoute>} />
          <Route path="/verkauf" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><VerkaufUebersicht /></ProtectedRoute>} />
          <Route path="/verkauf/angebot/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order']}><AngebotErstellen /></ProtectedRoute>} />
          <Route path="/verkauf/angebot/import" element={<ProtectedRoute requiredRoles={['Super Admin']}><AngebotImport /></ProtectedRoute>} />
          <Route path="/verkauf/anfragen" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><SalesLeadsList /></ProtectedRoute>} />
          <Route path="/verkauf/anfragen/:id" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><SalesLeadDetail /></ProtectedRoute>} />
          <Route path="/verkauf/nachfassen" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><SalesFollowups /></ProtectedRoute>} />
          <Route path="/verkauf/neue-anfrage" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><NeueAnfrage /></ProtectedRoute>} />
          <Route path="/verkauf/anfragen/neu" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><NeueAnfrage /></ProtectedRoute>} />
          <Route path="/verkauf/anfragen/dashboard" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><SalesLeadsDashboard /></ProtectedRoute>} />
          <Route path="/verkauf/anfragen/import" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><SalesLeadsImport /></ProtectedRoute>} />

          <Route path="/verkauf/angebote" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Angebote /></ProtectedRoute>} />
          <Route path="/verkauf/angebotskalender" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Vertrieb','Vertriebsleitung','Order','SACHBEARBEITUNG']}><AngebotsKalender /></ProtectedRoute>} />


          <Route path="/verkauf/anzahlungsrechnung" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Auftragsverwaltung', 'Order', 'Finance', 'Tourenplanung', 'Read Only Audit', 'Read Only', 'Geschäftsführung', 'Marketing', 'Technik', 'Kundenservice', 'Vertrieb', 'Reparaturannahme', 'Bestellwesen', 'Serviceleitung', 'Service', 'QM', 'SACHBEARBEITUNG']}><Anzahlungsrechnung /></ProtectedRoute>} />
          <Route path="/verkauf/gutschriften" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Gutschriften /></ProtectedRoute>} />
          <Route path="/verkauf/freigabe" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Freigabe /></ProtectedRoute>} />
          <Route path="/operation" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><Operation /></ProtectedRoute>} />
          <Route path="/operation/logfiles" element={<ProtectedRoute requiredRoles={SYSTEM_ROLES}><Logfiles /></ProtectedRoute>} />
          <Route path="/operation/email-vorlagen" element={<ProtectedRoute requiredRoles={ORDER_ROLES}><EmailTemplates /></ProtectedRoute>} />
          <Route path="/operation/systemwartung" element={<ProtectedRoute requiredRoles={['Super Admin']}><Systemwartung /></ProtectedRoute>} />
          <Route path="/operation/health-check" element={<ProtectedRoute requiredRoles={['Super Admin','Admin']}><HealthCheck /></ProtectedRoute>} />
          <Route path="/operation/nummernkreise" element={<ProtectedRoute requiredRoles={['Super Admin']}><Nummernkreise /></ProtectedRoute>} />
          <Route path="/operation/ticket-abteilungen" element={<ProtectedRoute requiredRoles={['Super Admin']}><TicketDepartments /></ProtectedRoute>} />
          <Route path="/operation/angebotskalender-config" element={<ProtectedRoute requiredRoles={['Super Admin']}><AngebotsKalenderConfig /></ProtectedRoute>} />
          <Route path="/operation/sms-konfiguration" element={<ProtectedRoute requiredRoles={['Super Admin','Admin']}><SmsKonfiguration /></ProtectedRoute>} />
          <Route path="/operation/alix-copilot" element={<ProtectedRoute requiredRoles={['Super Admin']}><AlixCopilotKonfiguration /></ProtectedRoute>} />
          <Route path="/operations/alix-copilot-config" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Geschäftsführung','QM']}><AlixCopilotConfig /></ProtectedRoute>} />
          <Route path="/operation/kundenportal" element={<ProtectedRoute requiredRoles={['Super Admin']}><KundenportalKonfiguration /></ProtectedRoute>} />
          <Route path="/operation/security-center" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Geschäftsführung']}><SecurityCenter /></ProtectedRoute>} />
          <Route path="/operation/datensicherung" element={<ProtectedRoute requiredRoles={['Super Admin']}><Datensicherung /></ProtectedRoute>} />
          <Route path="/operation/fort-knox" element={<ProtectedRoute requiredRoles={['Super Admin']}><FortKnox /></ProtectedRoute>} />
          <Route path="/mandanten" element={<ProtectedRoute requiredRoles={['Super Admin']}><Mandanten /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Geschäftsführung']}><AdminAuditLog /></ProtectedRoute>} />
          <Route path="/konzern/dashboard" element={<ProtectedRoute requiredRoles={['Super Admin','Admin']}><KonzernDashboard /></ProtectedRoute>} />
          <Route path="/operation/alixsmart-migration" element={<ProtectedRoute requiredRoles={['Super Admin','Admin']}><AlixSmartMigration /></ProtectedRoute>} />
          <Route path="/operation/alixsmart-konfliktaufloesung" element={<ProtectedRoute requiredRoles={['Super Admin','Admin']}><AlixSmartKonfliktaufloesung /></ProtectedRoute>} />
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
          <Route path="/tourenplanung/sms-vorlage" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><SmsTemplateSettings /></ProtectedRoute>} />
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
            <Route path="kostenvoranschlaege" element={<ReparaturKostenvoranschlaege />} />
            <Route path="kostenvoranschlaege/:id" element={<ReparaturQuoteDetail />} />
            <Route path="rueckversand" element={<ReparaturRueckversand />} />
            <Route path=":id" element={<ReparaturDetail />} />
          </Route>
          <Route path="/bestellwesen/ersatzteile" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Bestellwesen', 'Order', 'Technik']}><BestellwesenErsatzteile /></ProtectedRoute>} />
          <Route path="/ersatzteilmanagement" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Bestellwesen', 'Order', 'Technik', 'Reparaturannahme', 'Serviceleitung', 'Service', 'Finance']}><Ersatzteilmanagement /></ProtectedRoute>} />


          <Route path="/tourenplanung/kalender" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><TourenKalender /></ProtectedRoute>} />
          <Route path="/tourenplanung/karte" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><TourenKarte /></ProtectedRoute>} />
          <Route path="/tourenplanung/dashboard" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><TourenDashboard /></ProtectedRoute>} />
          <Route path="/tourenplanung/neu" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
          <Route path="/tourenplanung/:id" element={<ProtectedRoute requiredRoles={PLANNING_ROLES}><RoutePlanDetail /></ProtectedRoute>} />
          <Route path="/tourenplanung/:id/bearbeiten" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Tourenplanung']}><RoutePlanForm /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Finance /></ProtectedRoute>} />
          <Route path="/finance/ratenzahler" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Ratenzahler /></ProtectedRoute>} />
          <Route path="/finance/alix-flex" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin']}><AlixFlex /></ProtectedRoute>} />
          <Route path="/finance/rechnungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Invoices /></ProtectedRoute>} />
          <Route path="/finance/offene-posten" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><OffenePosten /></ProtectedRoute>} />
          {/* /finance/unpaid-zoho deaktiviert – Daten bleiben in DB für andere Übersichten */}
          <Route path="/finance/rechnungsvorschlaege" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><Rechnungsvorschlaege /></ProtectedRoute>} />
          <Route path="/finance/dashboard" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceDashboardPhase1 /></ProtectedRoute>} />
          <Route path="/finance/anzahlungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAnzahlungen /></ProtectedRoute>} />
          <Route path="/finance/offene-anzahlungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceOffeneAnzahlungen /></ProtectedRoute>} />
          <Route path="/finance/kassenbuch" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceKassenbuch /></ProtectedRoute>} />
          <Route path="/finance/buchungsjournal" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBuchungsjournal /></ProtectedRoute>} />
          <Route path="/finance/bankbuchungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBankbuchungen /></ProtectedRoute>} />
          <Route path="/finance/zahlungsuebersicht" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceZahlungsuebersicht /></ProtectedRoute>} />
          <Route path="/finance/datev-export" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceDatevExport /></ProtectedRoute>} />
          <Route path="/finance/audit-revision" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAuditRevision /></ProtectedRoute>} />

          <Route path="/finance/zahlungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceZahlungen /></ProtectedRoute>} />
          <Route path="/finance/vertraege" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceVertraege /></ProtectedRoute>} />
          <Route path="/finance/mahnwesen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceMahnwesen /></ProtectedRoute>} />
          <Route path="/finance/mahnwesen/einstellungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceMahnwesenSettings /></ProtectedRoute>} />
          <Route path="/finance/mahnwesen/:customerId" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceMahnwesenDetail /></ProtectedRoute>} />
          <Route path="/operation/anzahlung-mahnung-konfiguration" element={<ProtectedRoute requiredRoles={['Super Admin']}><OperationMahnungKonfiguration /></ProtectedRoute>} />
          <Route path="/finance/datev" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceDatev /></ProtectedRoute>} />
          <Route path="/finance/bank" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBank /></ProtectedRoute>} />
          <Route path="/finance/sepa" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceSepa /></ProtectedRoute>} />
          <Route path="/finance/steuer" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceSteuer /></ProtectedRoute>} />
          <Route path="/finance/cockpit" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceCockpit /></ProtectedRoute>} />
          <Route path="/finance/cockpit/mandant/:code" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceCockpitMandant /></ProtectedRoute>} />
          <Route path="/finance/wiederkehrende-zahler" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><WiederkehrendeZahler /></ProtectedRoute>} />
          <Route path="/finance/einstellungen/systemstatus" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceSystemstatus /></ProtectedRoute>} />
          <Route path="/finance/raten" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceRaten /></ProtectedRoute>} />
          <Route path="/finance/belege" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBelege /></ProtectedRoute>} />
          <Route path="/finance/eingangsrechnungen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceEingangsrechnungen /></ProtectedRoute>} />
          <Route path="/finance/anlagen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAnlagen /></ProtectedRoute>} />
          <Route path="/finance/anlagen/afa-lauf" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAfaLauf /></ProtectedRoute>} />
          <Route path="/finance/liquiditaet" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceLiquiditaet /></ProtectedRoute>} />
          <Route path="/finance/bwa" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBwa /></ProtectedRoute>} />
          <Route path="/finance/guv" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceGuV /></ProtectedRoute>} />
          <Route path="/finance/bilanz" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBilanz /></ProtectedRoute>} />
          <Route path="/finance/jahresabschluss" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceJahresabschluss /></ProtectedRoute>} />
          <Route path="/finance/budget" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceBudget /></ProtectedRoute>} />
          <Route path="/finance/soll-ist" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceSollIst /></ProtectedRoute>} />
          <Route path="/finance/forecast" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceForecast /></ProtectedRoute>} />
          <Route path="/finance/controlling" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceControlling /></ProtectedRoute>} />
          <Route path="/finance/ai-insights" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAiInsights /></ProtectedRoute>} />
          <Route path="/finance/anomalien" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAnomalien /></ProtectedRoute>} />
          <Route path="/finance/ask" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAsk /></ProtectedRoute>} />
          <Route path="/finance/automations" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceAutomations /></ProtectedRoute>} />
          <Route path="/finance/freigaben" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceFreigaben /></ProtectedRoute>} />
          <Route path="/finance/compliance" element={<ProtectedRoute requiredRoles={['Admin','Super Admin','Geschäftsführung']}><FinanceCompliance /></ProtectedRoute>} />
          <Route path="/finance/reports" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceReports /></ProtectedRoute>} />
          <Route path="/finance/schedules" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceReportSchedules /></ProtectedRoute>} />
          <Route path="/finance/management-pack" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceManagementPack /></ProtectedRoute>} />
          <Route path="/finance/stakeholders" element={<ProtectedRoute requiredRoles={['Super Admin','Geschäftsführung']}><FinanceStakeholders /></ProtectedRoute>} />
          <Route path="/finance/konsolidierung" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceKonsolidierung /></ProtectedRoute>} />
          <Route path="/finance/konsolidierung/:id" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceKonsolidierungDetail /></ProtectedRoute>} />
          <Route path="/finance/intercompany" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceIntercompany /></ProtectedRoute>} />
          <Route path="/finance/fx" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceFxRates /></ProtectedRoute>} />
          <Route path="/finance/treasury" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceTreasury /></ProtectedRoute>} />
          <Route path="/finance/p2p" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceP2P /></ProtectedRoute>} />
          <Route path="/finance/meldewesen" element={<ProtectedRoute requiredRoles={FINANCE_ROLES}><FinanceMeldewesen /></ProtectedRoute>} />
          <Route path="/service-cockpit" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Serviceleitung']}><ServiceCockpit /></ProtectedRoute>} />
          <Route path="/geraeteakte" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Technik', 'Kundenservice', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Tourenplanung', 'Finance']}><Geraeteakte /></ProtectedRoute>} />
          <Route path="/geraete-lebenslauf" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Technik', 'Kundenservice', 'Serviceleitung', 'Service', 'Reparaturannahme', 'Finance']}><GeraeteLebenslauf /></ProtectedRoute>} />
          <Route path="/wartungscenter" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung']}><Wartungscenter /></ProtectedRoute>} />
          <Route path="/wartungsmanagement" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung']}><Wartungsmanagement /></ProtectedRoute>} />
          <Route path="/service/wartungsmanagement" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung']}><Wartungsmanagement /></ProtectedRoute>} />
          <Route path="/garantiecenter" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Vertrieb']}><Garantiecenter /></ProtectedRoute>} />
          <Route path="/garantie-kulanz" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung']}><GarantieKulanz /></ProtectedRoute>} />
          <Route path="/service/garantie-kulanz" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Service', 'Serviceleitung', 'Technik', 'Kundenservice', 'Reparaturannahme', 'Finance', 'Tourenplanung']}><GarantieKulanz /></ProtectedRoute>} />
          <Route path="/management-dashboard" element={<ProtectedRoute requiredRoles={['Super Admin']}><ManagementDashboard /></ProtectedRoute>} />
          <Route path="/executive" element={<ProtectedRoute requiredRoles={['Super Admin']}><ExecutiveCommandCenter /></ProtectedRoute>} />
          <Route path="/ai-center" element={<ProtectedRoute requiredRoles={['Admin', 'Super Admin', 'Geschäftsführung', 'Serviceleitung', 'Service', 'Technik', 'Finance', 'Österreich']}><AiCenter /></ProtectedRoute>} />

          <Route path="/design-template" element={<Navigate to="/dashboard" replace />} />

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
          <Route path="/security-center" element={<ProtectedRoute requiredRoles={['Super Admin']}><SecurityCenterLayout /></ProtectedRoute>}>
            <Route index element={<SecurityCenterOverview />} />
            <Route path="inventory" element={<SecurityInventory />} />
            <Route path="roles" element={<SecurityRoles />} />
            <Route path="permissions" element={<SecurityPermissions />} />
            <Route path="policies" element={<SecurityPolicies />} />
            <Route path="storage" element={<SecurityStorage />} />
            <Route path="mfa" element={<SecurityMfa />} />
            <Route path="findings" element={<SecurityFindings />} />
            <Route path="pentest" element={<SecurityPentest />} />
            <Route path="compliance" element={<SecurityCompliance />} />
            <Route path="simulate" element={<SecuritySimulate />} />
            <Route path="plan" element={<SecurityPlan />} />
          </Route>
          <Route path="/admin/rollen-freigaben" element={<ProtectedRoute requiredRoles={['Super Admin']}><RfLayout /></ProtectedRoute>}>
            <Route index element={<RfOverview />} />
            <Route path="matrix" element={<RfMatrix />} />
            <Route path="rollen" element={<RfRoles />} />
            <Route path="mitarbeiter" element={<RfEmployees />} />
            <Route path="effektiv" element={<RfEffective />} />
            <Route path="vergleich" element={<RfCompare />} />
            <Route path="antraege" element={<RfRequests />} />
            <Route path="pruefung" element={<RfAudit />} />
            <Route path="ansicht-als" element={<RfViewAs />} />
            <Route path="befristet" element={<RfTempGrants />} />
            <Route path="datenklassen" element={<RfDataClasses />} />
            <Route path="benachrichtigungen" element={<RfNotifications />} />
            <Route path="bulk" element={<RfBulk />} />
            <Route path="rezertifizierung" element={<RfRecert />} />
            <Route path="vorlagen" element={<RfTemplates />} />
            <Route path="analytics" element={<RfAnalytics />} />
            <Route path="break-glass" element={<RfBreakGlass />} />
            <Route path="kontext" element={<RfContext />} />
            <Route path="sod" element={<RfSoD />} />
            <Route path="sso" element={<RfSSO />} />
            <Route path="geplant" element={<RfScheduled />} />
            <Route path="ketten" element={<RfChains />} />
            <Route path="lifecycle" element={<RfLifecycle />} />
            <Route path="exporte" element={<RfAuditExport />} />
            <Route path="protokoll" element={<RfLog />} />
          </Route>

          <Route path="/self-service/rollen" element={<ProtectedRoute><SelfServiceRoles /></ProtectedRoute>} />



          <Route path="/auftragsverwaltung/bestellungen" element={<ProtectedRoute requiredRoles={ORDER_MGMT_ROLES}><BestellwesenOverview /></ProtectedRoute>} />
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
            <Route path="analytics" element={<BugCapaAnalytics />} />
            <Route path="iso-report" element={<BugCapaIsoReport />} />
          </Route>

          <Route path="/katalog" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Katalog','Katalog Preise','Vertrieb','Vertriebsleitung','Marketing','Service','Geschäftsführung']}><KatalogLayoutLazy /></ProtectedRoute>}>
            <Route index element={<KatalogDashboard />} />
            <Route path="artikel" element={<KatalogArtikel />} />
            <Route path="artikel/:id" element={<KatalogArtikelDetail />} />
            <Route path="kategorien" element={<KatalogKategorien />} />
            <Route path="laender" element={<KatalogLaender />} />
            <Route path="niederlassungen" element={<KatalogNiederlassungen />} />
            <Route path="preisregeln" element={<KatalogPreisregeln />} />
            <Route path="protokolle" element={<KatalogProtokolle />} />
            <Route path="import" element={<KatalogImport />} />
            <Route path="export" element={<KatalogExport />} />
          </Route>


          <Route path="/iso" element={<ProtectedRoute requiredRoles={['Super Admin', 'Admin', 'QM']}><IsoLayoutLazy /></ProtectedRoute>}>
            <Route index element={<IsoDashboard />} />
            <Route path="audits" element={<IsoAudits />} />
            <Route path="trainings" element={<IsoTrainings />} />
            <Route path="suppliers" element={<IsoSuppliers />} />
            <Route path="changes" element={<IsoChanges />} />
            <Route path="vigilance" element={<IsoVigilance />} />
          </Route>

          <Route path="/tickets" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><TicketsList /></ProtectedRoute>} />
          <Route path="/tickets/dashboard" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><TicketsDashboard /></ProtectedRoute>} />
          <Route path="/tickets/kalender" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><TicketCalendar /></ProtectedRoute>} />

          <Route path="/tickets/api-sync" element={<ProtectedRoute requiredRoles={['Super Admin']}><TicketsApiSync /></ProtectedRoute>} />
          <Route path="/tickets/sync" element={<ProtectedRoute requiredRoles={['Super Admin', 'Admin']}><TicketsSyncMonitor /></ProtectedRoute>} />
          <Route path="/tickets/by-external/:externalId" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><TicketByExternal /></ProtectedRoute>} />
          <Route path="/tickets/:id" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><TicketDetail /></ProtectedRoute>} />
          <Route path="/whatsapp" element={<ProtectedRoute requiredRoles={TICKETS_ROLES}><WhatsAppServiceCenter /></ProtectedRoute>} />
          <Route path="/ai-service-center" element={<ProtectedRoute requiredRoles={AI_SERVICE_ROLES}><AiServiceCenter /></ProtectedRoute>} />

          <Route path="/aic" element={<ProtectedRoute><AicLayout /></ProtectedRoute>}>
            <Route index element={<AicDashboard />} />
            <Route path="unternehmen" element={<AicUnternehmen />} />
            <Route path="forderungen" element={<AicForderungen />} />
            <Route path="vertrieb" element={<AicVertrieb />} />
            <Route path="service" element={<AicService />} />
            <Route path="mitarbeiter" element={<AicMitarbeiter />} />
            <Route path="forecasts" element={<AicForecasts />} />
            <Route path="tasks" element={<AicTasks />} />
            <Route path="berichte" element={<AicBerichte />} />
          </Route>


          <Route path="/mailcenter" element={<ProtectedRoute><MailCenterLayout /></ProtectedRoute>}>
            <Route index element={<MailCenterDashboard />} />
            <Route path="schreiben" element={<MailCenterCompose />} />
            <Route path="posteingang" element={<MailCenterPosteingang />} />
            <Route path="gesendet" element={<MailCenterGesendet />} />
            <Route path="entwuerfe" element={<MailCenterEntwuerfe />} />
            <Route path="intern" element={<MailCenterInternal />} />
            <Route path="vorlagen" element={<MailCenterVorlagen />} />
            <Route path="kampagnen" element={<MailCenterKampagnen />} />
            <Route path="automationen" element={<MailCenterAutomationen />} />
            <Route path="tracking" element={<MailCenterTracking />} />
            <Route path="abmeldungen" element={<MailCenterAbmeldungen />} />
            <Route path="domains" element={<MailCenterDomains />} />
            <Route path="berichte" element={<MailCenterBerichte />} />
            <Route path="ki-assistent" element={<MailCenterKIAssistent />} />
            <Route path="dokumente" element={<MailCenterDokumentenCenter />} />
            <Route path="versandnachweise" element={<MailCenterVersandnachweise />} />
            <Route path="dokumente-vorlagen" element={<MailCenterDokumentenVorlagen />} />
            <Route path="dokumente-automationen" element={<MailCenterDokumentenAutomationen />} />
            <Route path="telefonnotizen" element={<MailCenterTelefonnotizen />} />
            <Route path="gespraechsprotokolle" element={<MailCenterGespraechsprotokolle />} />
            <Route path="aufgaben" element={<MailCenterAufgaben />} />
            <Route path="wiedervorlagen" element={<MailCenterWiedervorlagen />} />
            <Route path="berechtigungen" element={<MailCenterBerechtigungen />} />
            <Route path="einstellungen" element={<MailCenterEinstellungen />} />
            <Route path="systemstatus" element={<MailCenterSystemstatus />} />
            <Route path="audit-log" element={<MailCenterAuditLog />} />
            <Route path="fehlerprotokoll" element={<MailCenterFehlerprotokoll />} />
            <Route path="testcenter" element={<MailCenterTestcenter />} />
            <Route path="produktivfreigabe" element={<MailCenterProduktivfreigabe />} />
            <Route path="executive" element={<MailCenterExecutive />} />
            <Route path="telefonie" element={<MailCenterTelefonie />} />
            <Route path="backup" element={<MailCenterBackup />} />
            <Route path="import" element={<MailCenterImport />} />
            <Route path="export" element={<MailCenterExport />} />
            <Route path="spam" element={<MailCenterSpam />} />
            <Route path="qualitaetssicherung" element={<MailCenterQS />} />
            <Route path="schulungscenter" element={<MailCenterSchulung />} />
            <Route path="systemvalidierung" element={<MailCenterValidierung />} />
          </Route>

          <Route path="/mdr-ce" element={<ProtectedRoute requiredRoles={['Super Admin']}><MdrCe /></ProtectedRoute>} />
          

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

          <Route path="/crm/after-sales" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung']}><AfterSalesDashboard /></ProtectedRoute>} />
          <Route path="/crm/after-sales/erledigt" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung']}><AfterSalesCompleted /></ProtectedRoute>} />
          <Route path="/crm/after-sales/reports" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung']}><AfterSalesReports /></ProtectedRoute>} />
          <Route path="/crm/after-sales/:id" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','After Sales','Vertrieb','Marketing','Service','Geschäftsführung','Order','SACHBEARBEITUNG','Kundenservice','Auftragsverwaltung']}><AfterSalesCaseDetail /></ProtectedRoute>} />


        </Route>
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/repair-quote/:token" element={<PublicRepairQuoteDecision />} />
        <Route path="/bewertung/danke" element={<ReviewThanks />} />
        <Route path="/bewertung/:token" element={<PublicReviewForm />} />
        <Route path="/csat/:token" element={<TicketCsat />} />
        <Route path="/portal" element={<PortalLookup />} />
        <Route path="/portal/status" element={<PortalStatus />} />
        <Route path="/sign/:token" element={<AlixSignPublic />} />
        <Route path="/sign/pdf/:signatureId" element={<AlixSignPdfDownload />} />
        <Route path="/d/:token" element={<OrderDocDownload />} />
        <Route path="/beratung" element={<PublicBeratung />} />
        <Route path="/angebot" element={<PublicBeratung />} />
        <Route path="/kunde/login" element={<CustomerPortalLogin />} />
        <Route path="/kunde" element={<CustomerPortalLayout />}>
          <Route index element={<CustomerPortalDashboard />} />
          <Route path="nachrichten" element={<CustomerPortalMessages />} />
          <Route path="dokumente" element={<CustomerPortalDocuments />} />
          <Route path="rechnungen" element={<CustomerPortalInvoices />} />
          <Route path="angebote" element={<CustomerPortalQuotes />} />
          <Route path="reparaturen" element={<CustomerPortalRepairs />} />
          <Route path="support" element={<CustomerPortalSupport />} />
          <Route path="bewertungen" element={<CustomerPortalReviews />} />
          <Route path="verlauf" element={<CustomerPortalTimeline />} />
          <Route path="geraete" element={<CustomerPortalDevices />} />
          <Route path="bestellungen" element={<CustomerPortalOrders />} />
          <Route path="wartungen" element={<CustomerPortalMaintenance />} />
          <Route path="garantien" element={<CustomerPortalWarranty />} />
          <Route path="tickets" element={<CustomerPortalTickets />} />
          <Route path="termine" element={<CustomerPortalAppointments />} />
          <Route path="gesundheit" element={<CustomerPortalHealth />} />
        </Route>

        {/* Mobile Techniker-App – eigenes Layout (kein AppLayout) */}
        <Route path="/m" element={<ProtectedRoute requiredRoles={['Super Admin','Admin','Technik','Tourenplanung','Service','Reparaturannahme']}><MobileLayout /></ProtectedRoute>}>
          <Route index element={<MobileHome />} />
          <Route path="heute" element={<MobileHome />} />
          <Route path="sync" element={<MobileSync />} />
          <Route path="profil" element={<MobileProfil />} />
          <Route path="einsatz/:id" element={<MobileEinsatz />} />
          <Route path="einsatz/:id/fotos" element={<MobileFotos />} />
          <Route path="einsatz/:id/signatur" element={<MobileSignatur />} />
          <Route path="einsatz/:id/checkliste" element={<MobileChecklist />} />
          <Route path="einsatz/:id/sprachnotiz" element={<MobileSprachnotiz />} />
          <Route path="sprachnotiz" element={<MobileSprachnotiz />} />
        </Route>



        {/* EMP – Enterprise Mobile Platform (rollenbasierte mobile Oberfläche) */}
        <Route path="/emp" element={<ProtectedRoute><EmpLayout /></ProtectedRoute>}>
          <Route index element={<EmpHome />} />
          <Route path="kalender" element={<EmpCalendar />} />
          <Route path="kunden" element={<EmpCustomers />} />
          <Route path="kunde/:id" element={<EmpCustomerDetail />} />
          <Route path="aufgaben" element={<EmpTasks />} />
          <Route path="mehr" element={<EmpMore />} />
          <Route path="termin/:id" element={<EmpAppointmentDetail />} />
          <Route path="servicebericht" element={<EmpServiceReport />} />
          <Route path="genehmigungen" element={<EmpApprovals />} />
          <Route path="dashboard" element={<EmpDashboard />} />
          <Route path="benachrichtigungen" element={<EmpNotifications />} />
          <Route path="sync" element={<EmpSync />} />
          <Route path="einstellungen" element={<EmpSettingsPage />} />
        </Route>

        {/* ECP – Enterprise Customer Portal (rollenbasiert: Kunde, Händler, Servicepartner, ...) */}
        <Route path="/ecp" element={<ProtectedRoute><EcpLayout /></ProtectedRoute>}>
          <Route index element={<EcpDashboard />} />
          <Route path="termine" element={<EcpAppointments />} />
          <Route path="geraete" element={<EcpDevices />} />
          <Route path="geraete/:id" element={<EcpDeviceDetail />} />
          <Route path="service" element={<EcpService />} />
          <Route path="tickets" element={<EcpTickets />} />
          <Route path="schulungen" element={<EcpTrainings />} />
          <Route path="dokumente" element={<EcpDocuments />} />
          <Route path="rechnungen" element={<EcpInvoices />} />
          <Route path="angebote" element={<EcpQuotes />} />
          <Route path="nachrichten" element={<EcpMessages />} />
          <Route path="downloads" element={<EcpDownloads />} />
          <Route path="profil" element={<EcpProfile />} />
          <Route path="standorte" element={<EcpLocations />} />
          <Route path="ansprechpartner" element={<EcpContacts />} />
          <Route path="haendler" element={<EcpDealer />} />
          <Route path="servicepartner" element={<EcpServicePartner />} />
          <Route path="lieferant" element={<EcpSupplier />} />
          <Route path="suche" element={<EcpSearch />} />
          <Route path="benachrichtigungen" element={<EcpNotifications />} />
          <Route path="admin" element={<EcpAdmin />} />
        </Route>

        {/* ABIC – Enterprise Analytics & Business Intelligence Center */}
        <Route path="/abic" element={<ProtectedRoute><AbicLayout /></ProtectedRoute>}>
          <Route index element={<AbicSection sectionKey="executive" />} />
          <Route path="sales" element={<AbicSection sectionKey="sales" />} />
          <Route path="service" element={<AbicSection sectionKey="service" />} />
          <Route path="training" element={<AbicSection sectionKey="training" />} />
          <Route path="finance" element={<AbicSection sectionKey="finance" />} />
          <Route path="customers" element={<AbicSection sectionKey="customers" />} />
          <Route path="operations" element={<AbicSection sectionKey="operations" />} />
          <Route path="marketing" element={<AbicSection sectionKey="marketing" />} />
          <Route path="devices" element={<AbicSection sectionKey="devices" />} />
          <Route path="employees" element={<AbicSection sectionKey="employees" />} />
          <Route path="locations" element={<AbicSection sectionKey="locations" />} />
          <Route path="forecast" element={<AbicSection sectionKey="forecast" />} />
          <Route path="kpi-designer" element={<AbicKpiDesigner />} />
          <Route path="reports" element={<AbicReports />} />
          <Route path="explorer" element={<AbicExplorer />} />
          <Route path="dashboards" element={<AbicDashboards />} />
          <Route path="goals" element={<AbicGoals />} />
        </Route>

        {/* ECQM – Enterprise Compliance & Quality Management Center */}
        <Route path="/ecqm" element={<ProtectedRoute><EcqmLayout /></ProtectedRoute>}>
          <Route index element={<EcqmDashboard />} />
          <Route path="dokumente" element={<EcqmDocuments />} />
          <Route path="sops" element={<EcqmDocuments onlySop />} />
          <Route path="prozesse" element={<EcqmProcesses />} />
          <Route path="capa" element={<EcqmCapa />} />
          <Route path="reklamationen" element={<EcqmComplaints />} />
          <Route path="risiken" element={<EcqmRisks />} />
          <Route path="audits" element={<EcqmAudits />} />
          <Route path="lieferanten" element={<EcqmSuppliers />} />
          <Route path="schulungen" element={<EcqmTrainings />} />
          <Route path="qualifikationen" element={<EcqmQualifications />} />
          <Route path="change-control" element={<EcqmChangeControl />} />
          <Route path="rueckverfolgbarkeit" element={<EcqmTraceability />} />
          <Route path="managementbewertung" element={<EcqmManagementReview />} />
          <Route path="kennzahlen" element={<EcqmKpis />} />
          <Route path="freigaben" element={<EcqmApprovals />} />
          <Route path="archiv" element={<EcqmArchive />} />
          <Route path="einstellungen" element={<EcqmSettings />} />
        </Route>

        {/* EAOC – Enterprise Administration & Organization Center */}
        <Route path="/eaoc" element={<ProtectedRoute><EaocLayout /></ProtectedRoute>}>
          <Route index element={<EaocDashboard />} />
          <Route path="companies" element={<EaocCompanies />} />
          <Route path="tenants" element={<EaocTenants />} />
          <Route path="locations" element={<EaocLocations />} />
          <Route path="departments" element={<EaocDepartments />} />
          <Route path="teams" element={<EaocTeams />} />
          <Route path="users" element={<EaocUsers />} />
          <Route path="roles" element={<EaocRoles />} />
          <Route path="permissions" element={<EaocPermissions />} />
          <Route path="orgchart" element={<EaocOrgChart />} />
          <Route path="branding" element={<EaocBranding />} />
          <Route path="integrations" element={<EaocIntegrations />} />
          <Route path="api-keys" element={<EaocApiKeys />} />
          <Route path="webhooks" element={<EaocWebhooks />} />
          <Route path="licenses" element={<EaocLicenses />} />
          <Route path="security" element={<EaocSecurity />} />
          <Route path="backups" element={<EaocBackups />} />
          <Route path="monitoring" element={<EaocMonitoring />} />
          <Route path="maintenance" element={<EaocMaintenance />} />
          <Route path="notifications" element={<EaocNotifications />} />
          <Route path="export" element={<EaocExport />} />
          <Route path="import" element={<EaocImport />} />
          <Route path="jobs" element={<EaocJobs />} />
          <Route path="search" element={<EaocSearch />} />
          <Route path="privacy" element={<EaocPrivacy />} />
          <Route path="audit" element={<EaocAudit />} />
          <Route path="settings" element={<EaocSettings />} />
          <Route path="developer" element={<EaocDeveloper />} />
        </Route>

        {/* EIG – Enterprise Integration Gateway */}
        <Route path="/eig" element={<ProtectedRoute><EigLayout /></ProtectedRoute>}>
          <Route index element={<EigDashboard />} />
          <Route path="api" element={<EigApiGateway />} />
          <Route path="explorer" element={<EigApiExplorer />} />
          <Route path="webhooks" element={<EigWebhooks />} />
          <Route path="events" element={<EigEventBus />} />
          <Route path="workflows" element={<EigWorkflowEngine />} />
          <Route path="integrations" element={<EigIntegrations />} />
          <Route path="mappings" element={<EigMappings />} />
          <Route path="import-export" element={<EigImportExport />} />
          <Route path="jobs" element={<EigJobs />} />
          <Route path="queues" element={<EigQueues />} />
          <Route path="sync" element={<EigSync />} />
          <Route path="plugins" element={<EigPlugins />} />
          <Route path="api-keys" element={<EigApiKeys />} />
          <Route path="errors" element={<EigErrors />} />
          <Route path="monitoring" element={<EigMonitoring />} />
          <Route path="logs" element={<EigLogs />} />
          <Route path="developer" element={<EigDeveloper />} />
        </Route>

        {/* RC1 – Enterprise Release Candidate */}
        <Route path="/rc1" element={<ProtectedRoute><Rc1Layout /></ProtectedRoute>}>
          <Route index element={<Rc1Dashboard />} />
          <Route path="navigation" element={<Rc1Info.Navigation />} />
          <Route path="search" element={<Rc1GlobalSearch />} />
          <Route path="notifications" element={<Rc1Info.Notifications />} />
          <Route path="performance" element={<Rc1Info.Performance />} />
          <Route path="database" element={<Rc1Info.Database />} />
          <Route path="security" element={<Rc1Info.Security />} />
          <Route path="permissions" element={<Rc1Info.Permissions />} />
          <Route path="accessibility" element={<Rc1Info.Accessibility />} />
          <Route path="mobile" element={<Rc1Info.Mobile />} />
          <Route path="errors" element={<Rc1Info.Errors />} />
          <Route path="logging" element={<Rc1Info.Logging />} />
          <Route path="monitoring" element={<Rc1Info.Monitoring />} />
          <Route path="updates" element={<Rc1Updates />} />
          <Route path="releases" element={<Rc1Info.Releases />} />
          <Route path="installer" element={<Rc1Info.Installer />} />
          <Route path="migration" element={<Rc1Info.Migration />} />
          <Route path="docs" element={<Rc1Info.Docs />} />
          <Route path="devdocs" element={<Rc1Info.DevDocs />} />
          <Route path="test-center" element={<Rc1TestCenter />} />
          <Route path="quality" element={<Rc1Quality />} />
          <Route path="design-review" element={<Rc1Info.DesignReview />} />
          <Route path="i18n" element={<Rc1Info.I18n />} />
          <Route path="backup" element={<Rc1Info.Backup />} />
          <Route path="license" element={<Rc1License />} />
          <Route path="startseite" element={<Rc1Info.Startseite />} />
          <Route path="go-live" element={<Rc1GoLive />} />
          <Route path="production" element={<Rc1Production />} />
          <Route path="readiness" element={<Rc1Readiness />} />
          <Route path="future" element={<Rc1Info.Future />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ExperienceModeProvider>
        <DesignVariantProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <TenantProvider>
                  <MaintenanceGate>
                    <AIBackground />
                    <AppRoutes />
                    <AuroraSpotlight />
                    <CursorSpotlight />
                    <GlobalCommandBar />
                    <CopilotBar />
                    <ShortcutsOverlay />
                    <TopProgressBar />
                    <LeihgeraetReminder />
                    {/* TemplateSwitcher (Standard / ALIXWORK NEO) deaktiviert */}
                  </MaintenanceGate>
                </TenantProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </DesignVariantProvider>
      </ExperienceModeProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
