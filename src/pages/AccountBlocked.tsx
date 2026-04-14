import { ShieldAlert, KeyRound, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, AccountBlockReason } from '@/hooks/useAuth';

const blockInfo: Record<NonNullable<AccountBlockReason>, { icon: React.ReactNode; title: string; message: string }> = {
  inactive: {
    icon: <UserX className="w-10 h-10 text-destructive" />,
    title: 'Konto deaktiviert',
    message: 'Ihr Konto wurde deaktiviert. Bitte wenden Sie sich an Ihren Administrator.',
  },
  not_accepted: {
    icon: <ShieldAlert className="w-10 h-10 text-warning" />,
    title: 'Einladung ausstehend',
    message: 'Ihre Einladung wurde noch nicht akzeptiert. Bitte prüfen Sie Ihre E-Mails oder wenden Sie sich an Ihren Administrator.',
  },
  password_reset: {
    icon: <KeyRound className="w-10 h-10 text-primary" />,
    title: 'Passwort-Änderung erforderlich',
    message: 'Aus Sicherheitsgründen müssen Sie Ihr Passwort ändern, bevor Sie fortfahren können. Bitte wenden Sie sich an Ihren Administrator.',
  },
};

export default function AccountBlocked() {
  const { signOut, blockReason } = useAuth();
  const info = blockReason ? blockInfo[blockReason] : blockInfo.inactive;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-muted mb-6">
          {info.icon}
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">{info.title}</h1>
        <p className="text-muted-foreground mb-8">{info.message}</p>
        <Button
          variant="outline"
          onClick={signOut}
          className="border-border text-muted-foreground hover:text-foreground"
        >
          Abmelden
        </Button>
      </div>
    </div>
  );
}
