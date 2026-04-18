'use client';

import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname === '/onboarding';

  if (isOnboarding) {
    return <div className="w-full min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <div className="main-content-panel">
          {children}
        </div>
      </div>
    </div>
  );
}
