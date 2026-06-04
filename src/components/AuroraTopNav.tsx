import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type NavChild = { path: string; label: string; icon: any; roles: string[] | null; children?: NavChild[] };

interface Props {
  items: NavChild[];
  labelWithCount: (path: string, label: string) => React.ReactNode;
}

export default function AuroraTopNav({ items, labelWithCount }: Props) {
  const { pathname } = useLocation();
  const isActive = (p: string) => p === '/' ? pathname === '/' : pathname.startsWith(p);

  const renderChild = (child: NavChild) => {
    if (child.children && child.children.length > 0) {
      return (
        <DropdownMenuSub key={child.path}>
          <DropdownMenuSubTrigger className="gap-2 text-[13px]">
            <child.icon className="w-4 h-4 text-primary/80" />
            <span>{labelWithCount(child.path, child.label)}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[220px]">
            {child.children.map((g) => (
              <DropdownMenuItem key={g.path} asChild>
                <Link to={g.path} className="gap-2 text-[13px]">
                  <g.icon className="w-4 h-4 text-primary/70" />
                  <span>{labelWithCount(g.path, g.label)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }
    return (
      <DropdownMenuItem key={child.path} asChild>
        <Link to={child.path} className="gap-2 text-[13px]">
          <child.icon className="w-4 h-4 text-primary/70" />
          <span>{labelWithCount(child.path, child.label)}</span>
        </Link>
      </DropdownMenuItem>
    );
  };

  return (
    <nav className="hidden md:flex flex-col gap-0.5 overflow-y-auto scroll-touch h-full w-full px-2 py-2">
      {items.map((item) => {
        const active = isActive(item.path);
        const hasChildren = item.children && item.children.length > 0;
        if (!hasChildren) {
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] font-medium whitespace-nowrap transition-colors',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-foreground/80 hover:text-primary hover:bg-primary/10',
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        }
        return (
          <DropdownMenu key={item.path}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'text-foreground/80 hover:text-primary hover:bg-primary/10',
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{item.label}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="left" className="min-w-[240px] z-[300]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">{item.label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {item.children!.map(renderChild)}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
