import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

/**
 * Shared shell for authenticated screens: a scrollable content area plus the
 * fixed bottom navigation. Mobile-first, centered with a max width on desktop.
 */
export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-black">
      <main className="flex-1 px-4 pb-28 pt-6">
        <Outlet />
      </main>
      <NavBar />
    </div>
  );
}
