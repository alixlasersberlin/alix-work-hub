import {
  LayoutDashboard, Users, Target, FileText, FileCheck2, ClipboardList, ScrollText,
  CalendarDays, Package, Banknote, Megaphone, Ticket, FolderTree, Receipt, Wallet,
  AlertTriangle, BellRing, Undo2, FileDown, Landmark, Database, CreditCard, Repeat,
  Warehouse, Hash, PackageCheck, Truck, ListChecks, Building2, ShoppingCart, Factory,
  Inbox, CheckCircle2, ClipboardCheck, BadgeCheck, Activity, ShieldCheck, Briefcase,
  Wrench, CheckSquare, MapPin, Sparkles, Cog, Settings, TrendingUp, Circle,
} from 'lucide-react';

export const WORKSPACE_ICONS: Record<string, typeof Circle> = {
  LayoutDashboard, Users, Target, FileText, FileCheck2, ClipboardList, ScrollText,
  CalendarDays, Package, Banknote, Megaphone, Ticket, FolderTree, Receipt, Wallet,
  AlertTriangle, BellRing, Undo2, FileDown, Landmark, Database, CreditCard, Repeat,
  Warehouse, Hash, PackageCheck, Truck, ListChecks, Building2, ShoppingCart, Factory,
  Inbox, CheckCircle2, ClipboardCheck, BadgeCheck, Activity, ShieldCheck, Briefcase,
  Wrench, CheckSquare, MapPin, Sparkles, Cog, Settings, TrendingUp, Circle,
};

export function iconFor(name?: string | null) {
  return (name && WORKSPACE_ICONS[name]) || Circle;
}
