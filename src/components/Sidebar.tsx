'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, CalendarDays, Receipt, Shield, Settings, LogOut } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useRef, useEffect } from 'react';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'Appointments', path: '/appointments', icon: CalendarDays },
  { name: 'Billing', path: '/billing', icon: Receipt },
  { name: 'Admin', path: '/settings', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const displayName = user?.fullName || user?.firstName || 'Clinic Owner';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut({ redirectUrl: '/' });
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <h1 className="sidebar-brand-text">SmileSync</h1>
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
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="nav-label">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Card Footer */}
      <div className="sidebar-footer" ref={menuRef}>
        <button
          className={`sidebar-user-tile ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <div className="sidebar-avatar">
            {initials}
          </div>
          <div className="sidebar-user-info">
            <div className="userName">{displayName}</div>
            <div className="userEmail">{email}</div>
          </div>
          <div className="sidebar-chevron">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </div>
        </button>

        {/* Popup Menu */}
        {menuOpen && (
          <div className="sidebar-popup-menu">
            <button
              className="sidebar-popup-item"
              onClick={() => { setMenuOpen(false); router.push('/settings'); }}
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <div className="sidebar-popup-divider" />
            <button
              className="sidebar-popup-item sidebar-popup-danger"
              onClick={handleSignOut}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
        
        <div className="sidebar-legal">
          Made by AEONS LAB
        </div>
      </div>
    </aside>
  );
}
