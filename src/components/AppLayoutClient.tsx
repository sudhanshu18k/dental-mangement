'use client';

import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store';
import { AlertTriangle, Lock, Clock, Zap } from 'lucide-react';

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeClinic, isReadOnly, subscriptionDaysLeft, userData } = useStore();
  const isOnboarding = pathname === '/onboarding';
  const isSuperAdmin = userData?.isSuperAdmin || userData?.email === 'sudhanshu18k@gmail.com';

  if (isOnboarding) {
    return <div className="w-full min-h-screen bg-slate-50">{children}</div>;
  }

  // Determine banner
  const status = activeClinic?.subscriptionStatus;
  const showTrialBanner = status === 'trial' && subscriptionDaysLeft !== null && subscriptionDaysLeft >= 0 && !isSuperAdmin;
  const showExpiredBanner = (status === 'expired' || status === 'locked' || (subscriptionDaysLeft !== null && subscriptionDaysLeft < 0)) && !isSuperAdmin;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        {/* Trial Banner */}
        {showTrialBanner && !showExpiredBanner && (
          <div className="subscription-banner subscription-banner-trial">
            <div className="subscription-banner-content">
              <div className="subscription-banner-icon">
                <Clock size={18} strokeWidth={2.5} />
              </div>
              <div className="subscription-banner-text">
                <strong>Free Trial</strong> — You have <span className="subscription-banner-days">{subscriptionDaysLeft} day{subscriptionDaysLeft !== 1 ? 's' : ''}</span> left in your free trial.
              </div>
            </div>
            <div className="subscription-banner-action">
              <Zap size={14} />
              Contact admin to upgrade
            </div>
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
                <strong>{status === 'locked' ? 'Account Locked' : 'Subscription Expired'}</strong> — The app is in <span className="subscription-banner-readonly">read-only mode</span>. Contact your administrator to renew your subscription.
              </div>
            </div>
          </div>
        )}

        <div className={`main-content-panel ${isReadOnly ? 'read-only-mode' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
