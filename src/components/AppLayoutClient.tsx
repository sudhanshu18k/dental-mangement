'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store';
import { AlertTriangle, Lock, Clock, MessageCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      <div className="main-area">
        {/* Pending Approval Banner */}
        {showPendingBanner && (
          <div className="subscription-banner subscription-banner-trial" style={{ background: 'linear-gradient(135deg, #f59e0b22, #d9770622)', borderBottom: '1px solid #f59e0b33' }}>
            <div className="subscription-banner-content">
              <div className="subscription-banner-icon" style={{ color: '#d97706' }}>
                <AlertTriangle size={18} strokeWidth={2.5} />
              </div>
              <div className="subscription-banner-text">
                <strong>Pending Approval</strong> — Your account is awaiting admin activation. You can view data but cannot make any changes.
              </div>
            </div>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn">
                <MessageCircle size={15} />
                Contact Admin on WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Trial Banner */}
        {showTrialBanner && !showExpiredBanner && !showRenewalWarning && (
          <div className="subscription-banner subscription-banner-trial">
            <div className="subscription-banner-content">
              <div className="subscription-banner-icon">
                <Clock size={18} strokeWidth={2.5} />
              </div>
              <div className="subscription-banner-text">
                <strong>Free Trial</strong> — You have <span className="subscription-banner-days">{subscriptionDaysLeft} day{subscriptionDaysLeft !== 1 ? 's' : ''}</span> left in your free trial.
              </div>
            </div>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn">
                <MessageCircle size={15} />
                Upgrade via WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Renewal Warning Banner — 3 days before active subscription expires */}
        {showRenewalWarning && (
          <div className="subscription-banner subscription-banner-renewal">
            <div className="subscription-banner-content">
              <div className="subscription-banner-icon">
                <AlertTriangle size={18} strokeWidth={2.5} />
              </div>
              <div className="subscription-banner-text">
                <strong>Subscription Expiring Soon</strong> — Your subscription expires in <span className="subscription-banner-days-urgent">{subscriptionDaysLeft} day{subscriptionDaysLeft !== 1 ? 's' : ''}</span>. Renew now to avoid interruption.
              </div>
            </div>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn subscription-whatsapp-btn-urgent">
                <MessageCircle size={15} />
                Renew via WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Expired / Read-Only Banner */}
        {showExpiredBanner && (
          <div className="subscription-banner subscription-banner-expired">
            <div className="subscription-banner-content">
              <div className="subscription-banner-icon">
                {status === 'locked' ? <Lock size={18} strokeWidth={2.5} /> : <AlertTriangle size={18} strokeWidth={2.5} />}
              </div>
              <div className="subscription-banner-text">
                <strong>{status === 'locked' ? 'Account Locked' : 'Subscription Expired'}</strong> — The app is in <span className="subscription-banner-readonly">read-only mode</span>. Contact admin to renew.
              </div>
            </div>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="subscription-whatsapp-btn subscription-whatsapp-btn-danger">
                <MessageCircle size={15} />
                Renew via WhatsApp
              </a>
            )}
          </div>
        )}

        <div className={`main-content-panel ${isReadOnly ? 'read-only-mode' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
