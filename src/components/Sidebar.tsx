'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, CalendarDays, Receipt, Shield, Settings, LogOut, Clock, AlertTriangle, Lock, CheckCircle, Bell } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/store';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'Appointments', path: '/appointments', icon: CalendarDays },
  { name: 'Follow-ups', path: '/follow-ups', icon: Bell },
  { name: 'Billing', path: '/billing', icon: Receipt },
  { name: 'Admin', path: '/settings', icon: Shield },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { activeClinic, userData, isReadOnly, subscriptionDaysLeft, followUps } = useStore();

  const pendingFollowUpCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return followUps.filter(f => f.status === 'pending' && f.dueDate <= today).length;
  }, [followUps]);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.fullName || user?.firstName || 'Clinic Owner';
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isSuperAdmin = userData?.isSuperAdmin || (userData?.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com' || email.toLowerCase().trim() === 'sudhanshu18k@gmail.com';

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut({ redirectUrl: '/' });
  };

  // Subscription badge logic
  const status = activeClinic?.subscriptionStatus;
  const getBadge = () => {
    if (isSuperAdmin) return null;
    if (status === 'pending') {
      return { label: 'Pending', color: '#d97706', bg: '#fef3c7', icon: AlertTriangle };
    }
    if (status === 'expired' || status === 'locked' || isReadOnly) {
      return { label: status === 'locked' ? 'Locked' : 'Expired', color: '#dc2626', bg: '#fee2e2', icon: status === 'locked' ? Lock : AlertTriangle };
    }
    if (status === 'trial' && subscriptionDaysLeft !== null && subscriptionDaysLeft >= 0) {
      return { label: `Trial · ${subscriptionDaysLeft}d`, color: '#d97706', bg: '#fef3c7', icon: Clock };
    }
    if (status === 'active') {
      return { label: 'Active', color: '#059669', bg: '#d1fae5', icon: CheckCircle };
    }
    return null;
  };
  const badge = getBadge();

  return (
    <aside className="sidebar">
      {/* Brand & Clinic Switcher */}
      <div className="sidebar-brand" style={{ position: 'relative' }}>
        <div 
          className="sidebar-user-tile"
          style={{ width: '100%', marginBottom: 0, padding: '0.75rem', display: 'flex', gap: '0.5rem', background: 'transparent', border: '1px solid var(--outline-variant)' }}
        >
          <div className="sidebar-logo" style={{ width: '32px', height: '32px', fontSize: '1rem', borderRadius: '8px' }}>
            {activeClinic?.name?.slice(0, 2).toUpperCase() || 'SS'}
          </div>
          <div className="sidebar-user-info" style={{ textAlign: 'left' }}>
            <div className="userName" style={{ fontSize: '0.9rem' }}>{activeClinic?.name || 'SmileSync'}</div>
            <div className="userEmail" style={{ fontSize: '0.65rem' }}>WORKSPACE</div>
          </div>
        </div>
      </div>

      {/* Subscription Badge */}
      {badge && (
        <div className="sidebar-sub-badge" style={{
          margin: '0 0.75rem 0.5rem',
          padding: '0.4rem 0.75rem',
          borderRadius: '0.6rem',
          background: badge.bg,
          color: badge.color,
          fontSize: '0.72rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          letterSpacing: '0.02em',
        }}>
          <badge.icon size={13} strokeWidth={2.5} />
          {badge.label}
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
          // Rename 'Admin' to 'Settings' visually if it points to /settings
          const itemName = item.name === 'Admin' ? 'Settings' : item.name;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="nav-label">{itemName}</span>
              {item.name === 'Follow-ups' && pendingFollowUpCount > 0 && (
                <span className="sidebar-followup-badge">{pendingFollowUpCount}</span>
              )}
            </Link>
          );
        })}
        {/* SUPER ADMIN */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}
            style={{ 
              marginTop: '1rem', 
              color: 'var(--danger)', 
              background: pathname === '/admin' ? 'var(--danger-bg)' : 'transparent',
              border: '1px solid var(--danger-bg)' 
            }}
          >
            <Shield size={20} strokeWidth={2.5} />
            <span className="nav-label" style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Super Admin</span>
          </Link>
        )}
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
