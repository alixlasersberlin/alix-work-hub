import * as Icons from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EscDepartment } from '@/lib/esc/types';

export function DepartmentBadge({ dept, size = 'sm' }: { dept: EscDepartment | undefined; size?: 'sm' | 'md' }) {
  if (!dept) return null;
  const Icon = (Icons as any)[dept.icon] || Icons.Circle;
  return (
    <Badge
      variant="outline"
      className={size === 'md' ? 'gap-1.5 py-1 px-2 text-[12px]' : 'gap-1 py-0.5 px-1.5 text-[11px]'}
      style={{ borderColor: dept.color, color: dept.color }}
    >
      <Icon className="w-3 h-3" />
      {dept.name}
    </Badge>
  );
}
