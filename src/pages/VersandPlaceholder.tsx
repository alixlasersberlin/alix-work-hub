import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';

interface Props {
  title: string;
  description?: string;
  icon: LucideIcon;
}

export default function VersandPlaceholder({ title, description, icon: Icon }: Props) {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={Icon}
        title={title}
        subtitle={description}
        noBreadcrumbs
      />
      <Card className="p-12 flex flex-col items-center justify-center text-center gap-4 border-dashed">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <Icon className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Dieser Bereich wird in Kürze mit Inhalten gefüllt.
          </p>
        </div>
      </Card>
    </div>
  );
}
