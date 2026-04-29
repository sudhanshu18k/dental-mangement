'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store';
import { AlertTriangle, Lock, Clock, MessageCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SignOutButton } from '@clerk/nextjs';

// Strip everything except digits from a phone string
function normalizePhone(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeClinic, isReadOnly, subscriptionDaysLeft, userData } = useStore();
  const isOnboarding = pathname === '/onboarding';
  const isSuperAdmin = userData?.isSuperAdmin || (userData?.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com';

  // Read WhatsApp settings from Firestore (platformSettings/global) — set by admin
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waMessage, setWaMessage] = useState('Hi, I would like to renew my SmileSync subscription.');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'platformSettings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.waPhone) {
          const normalized = normalizePhone(data.waPhone);
          if (normalized.length >= 10) {
            setWaPhone(normalized);
          }
        }
        if (data.waMessage) {
          setWaMessage(data.waMessage);
        }
      }
    });
    return () => unsub();
  }, []);

  // Force update user document in Firestore to isSuperAdmin: true if email matches
  useEffect(() => {
    if (userData && userData.id && !userData.isSuperAdmin && (userData.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com') {
      import('firebase/firestore').then(({ updateDoc, doc }) => {
        updateDoc(doc(db, 'users', userData.id), { isSuperAdmin: true })
          .then(() => console.log('Successfully updated user to super admin in Firestore'))
          .catch(err => console.error('Failed to update super admin status:', err));
      });
    }
  }, [userData]);

  if (isOnboarding) {
    return <div className="w-full min-h-screen bg-slate-50">{children}</div>;
  }

  // Handle completely locked out users
  if (userData?.isLocked) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-red-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={36} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Account Disabled</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Your account has been locked by the administrator. You currently do not have access to the application.
          </p>
          
          <div className="flex flex-col gap-3">
            {waPhone && (
              <a 
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent('Hi, I need help with my locked SmileSync account.')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-50 text-emerald-700 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle size={18} /> Contact Support
              </a>
            )}
            <SignOutButton>
              <button className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors">
                Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  // Determine which banner to show
  const status = activeClinic?.subscriptionStatus;
  const showPendingBanner = status === 'pending' && !isSuperAdmin;
  const showTrialBanner = status === 'trial' && subscriptionDaysLeft !== null && subscriptionDaysLeft >= 0 && !isSuperAdmin;
  const showRenewalWarning = status === 'active' && subscriptionDaysLeft !== null && subscriptionDaysLeft >= 0 && subscriptionDaysLeft <= 3 && !isSuperAdmin;
  const showExpiredBanner = (status === 'expired' || status === 'locked' || (subscriptionDaysLeft !== null && subscriptionDaysLeft < 0)) && !isSuperAdmin && !showPendingBanner;

  // Build WhatsApp URL with the admin-configured message
  const whatsappUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`
    : null;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area" style={{ padding: 0 }}>
        {/* Banners (Subscription, etc.) */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
          {showPendingBanner && (
            <div className="subscription-banner subscription-banner-trial" style={{ background: 'linear-gradient(135deg, #f59e0b22, #d9770622)', borderBottom: '1px solid #f59e0b33', margin: 0, borderRadius: 0 }}>
              <div className="subscription-banner-content">
                <div className="subscription-banner-icon" style={{ color: '#d97706' }}>
                  <AlertTriangle size={18} strokeWidth={2.5} />
                </div>
                <div className="subscription-banner-text">
                  <strong>Pending Approval</strong> — Your account is awaiting admin activation.
                </div>
              </div>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn">
                  <MessageCircle size={15} />
                  Contact Admin
                </a>
              )}
            </div>
          )}

          {showTrialBanner && !showExpiredBanner && !showRenewalWarning && (
            <div className="subscription-banner subscription-banner-trial" style={{ margin: 0, borderRadius: 0 }}>
              <div className="subscription-banner-content">
                <div className="subscription-banner-icon">
                  <Clock size={18} strokeWidth={2.5} />
                </div>
                <div className="subscription-banner-text">
                  <strong>Free Trial</strong> — <span className="subscription-banner-days">{subscriptionDaysLeft} days</span> left.
                </div>
              </div>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn">
                  <MessageCircle size={15} />
                  Upgrade
                </a>
              )}
            </div>
          )}

          {showRenewalWarning && (
            <div className="subscription-banner subscription-banner-renewal" style={{ margin: 0, borderRadius: 0 }}>
              <div className="subscription-banner-content">
                <div className="subscription-banner-icon">
                  <AlertTriangle size={18} strokeWidth={2.5} />
                </div>
                <div className="subscription-banner-text">
                  <strong>Expiring Soon</strong> — <span className="subscription-banner-days-urgent">{subscriptionDaysLeft} days</span> left.
                </div>
              </div>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn subscription-whatsapp-btn-urgent">
                  <MessageCircle size={15} />
                  Renew
                </a>
              )}
            </div>
          )}

          {showExpiredBanner && (
            <div className="subscription-banner subscription-banner-expired" style={{ margin: 0, borderRadius: 0 }}>
              <div className="subscription-banner-content">
                <div className="subscription-banner-icon">
                  {status === 'locked' ? <Lock size={18} strokeWidth={2.5} /> : <AlertTriangle size={18} strokeWidth={2.5} />}
                </div>
                <div className="subscription-banner-text">
                  <strong>{status === 'locked' ? 'Account Locked' : 'Subscription Expired'}</strong> — Read-only mode.
                </div>
              </div>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn subscription-whatsapp-btn-danger">
                  <MessageCircle size={15} />
                  Renew
                </a>
              )}
            </div>
          )}

          {/* Notification Top Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0.75rem 2.5rem',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            <NotificationBell />
          </div>
        </div>

        <div className={`main-content-panel ${isReadOnly ? 'read-only-mode' : ''}`} style={{ padding: '2.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
