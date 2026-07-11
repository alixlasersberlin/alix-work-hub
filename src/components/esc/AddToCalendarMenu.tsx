import { Calendar, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { calendarLinks } from '@/lib/esc/calendar-sync';
import type { EscAppointment } from '@/lib/esc/types';

interface Props {
  appointment: EscAppointment;
  size?: 'sm' | 'default' | 'icon';
  variant?: 'ghost' | 'outline' | 'default';
  label?: string;
}

export function AddToCalendarMenu({ appointment, size = 'sm', variant = 'outline', label = 'Zum Kalender hinzufügen' }: Props) {
  const links = calendarLinks(appointment);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} onClick={(e) => e.stopPropagation()}>
          <Calendar className="h-4 w-4 mr-2" />
          {size !== 'icon' && label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Kalender</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={links.google} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />Google Kalender
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.office365} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />Microsoft 365 / Outlook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.outlookWeb} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />Outlook.com
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.yahoo} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />Yahoo Kalender
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Apple / iOS · Thunderbird · Samsung · Exchange · CalDAV
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => links.icsDownload()}>
          <Download className="h-4 w-4 mr-2" />ICS-Datei (öffnet in Kalender-App)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
