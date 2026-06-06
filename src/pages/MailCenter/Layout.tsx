import { Outlet } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

export default function MailCenterLayout() {
  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Alix MailCenter</h1>
        </div>
        <NotificationBell />
      </div>
      <Outlet />
    </div>
  );
}
