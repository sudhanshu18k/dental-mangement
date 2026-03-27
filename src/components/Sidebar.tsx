'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CalendarDays, Receipt } from 'lucide-react';
import { UserButton, useUser } from '@clerk/nextjs';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'Appointments', path: '/appointments', icon: CalendarDays },
  { name: 'Billing', path: '/billing', icon: Receipt },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">S</div>
        <div>
          <div className="sidebar-title">SmileSync</div>
          <div className="sidebar-subtitle">Owner Edition</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer with Clerk UserButton */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <UserButton
            appearance={{
              elements: {
                avatarBox: {
                  width: '36px',
                  height: '36px',
                },
                userButtonPopoverCard: {
                  backdropFilter: 'blur(20px)',
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  borderRadius: '1rem',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
                },
              },
            }}
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.fullName || user?.firstName || 'Clinic Owner'}</span>
            <span className="sidebar-user-email">{user?.primaryEmailAddress?.emailAddress || ''}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
