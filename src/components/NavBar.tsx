import { NavLink } from 'react-router-dom';
import { HomeIcon, PlusIcon } from './icons';

const items = [
  { to: '/', label: 'Collection', icon: HomeIcon, end: true },
  { to: '/add', label: 'Add Card', icon: PlusIcon, end: false },
];

/**
 * Fixed bottom navigation, echoing the reference app's rounded pill bar.
 * Kept intentionally small — this is a two-screen personal tool.
 */
export function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto max-w-2xl px-4 pb-4">
        <div className="flex items-center justify-around rounded-2xl border border-white/10 bg-bg-elevated/95 px-2 py-2 backdrop-blur">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-white/50 hover:text-white/80'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
