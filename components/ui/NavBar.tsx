import React from 'react';
import { FilePlus2, Database, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

type View = 'extraction' | 'database' | 'settings';

interface NavItem {
  name: string;
  view: View;
  icon: React.ElementType;
}

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navItems: NavItem[] = [
    { name: 'Extractor', view: 'extraction', icon: FilePlus2 },
    { name: 'Database', view: 'database', icon: Database },
    { name: 'Settings', view: 'settings', icon: Settings },
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-black border-r border-neutral-900 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-10 p-2">
         <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-black font-bold text-lg">
           V
         </div>
        <span className="text-xl font-semibold text-white">VAULTY</span>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.name}
              onClick={() => onViewChange(item.view)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                'text-neutral-400 hover:bg-neutral-900 hover:text-white',
                isActive && 'bg-neutral-800 text-white'
              )}
            >
              <Icon size={18} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto text-xs text-neutral-600 p-2">
        &copy; {new Date().getFullYear()} VAULTY Corp.
      </div>
    </aside>
  );
}