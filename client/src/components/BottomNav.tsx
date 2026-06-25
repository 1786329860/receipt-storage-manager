import { NavLink } from 'react-router-dom';
import { Home, Receipt, PlusCircle, BarChart3, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/receipts', icon: Receipt, label: '小票' },
  { to: '/add', icon: PlusCircle, label: '记一笔', special: true },
  { to: '/analytics', icon: BarChart3, label: '统计' },
  { to: '/settings', icon: Settings, label: '我的' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-100 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-1">
        {navItems.map(({ to, icon: Icon, label, special }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                special
                  ? 'text-primary-600 -mt-3'
                  : isActive
                  ? 'text-primary-600'
                  : 'text-slate-400 active:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {special ? (
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200 ${isActive ? 'bg-primary-700' : 'bg-primary-600'}`}>
                    <Icon size={24} className="text-white" />
                  </div>
                ) : (
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                )}
                <span className={`text-[10px] ${special ? 'font-medium mt-0.5' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
