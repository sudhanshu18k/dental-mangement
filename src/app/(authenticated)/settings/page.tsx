'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store';
import {
  User, Shield, Building2, Palette, Eye, EyeOff,
  Check, AlertCircle, Users, CalendarDays, Receipt,
  Save, Phone, MapPin, CreditCard, Moon
} from 'lucide-react';

type TabId = 'profile' | 'security' | 'clinic' | 'appearance';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'clinic', label: 'Clinic', icon: Building2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const THEMES = [
  { id: 'ocean', label: 'Ocean Blue', primary: '#0ea5e9', secondary: '#a855f7', accent: '#ec4899', gradient: 'linear-gradient(135deg, #0ea5e9, #a855f7, #ec4899)' },
  { id: 'violet', label: 'Violet', primary: '#8b5cf6', secondary: '#6366f1', accent: '#a855f7', gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1, #a855f7)' },
  { id: 'rose', label: 'Rose', primary: '#e11d48', secondary: '#f43f5e', accent: '#fb7185', gradient: 'linear-gradient(135deg, #e11d48, #f43f5e, #fb7185)' },
  { id: 'emerald', label: 'Emerald', primary: '#10b981', secondary: '#059669', accent: '#34d399', gradient: 'linear-gradient(135deg, #10b981, #059669, #34d399)' },
  { id: 'amber', label: 'Amber', primary: '#f59e0b', secondary: '#d97706', accent: '#fbbf24', gradient: 'linear-gradient(135deg, #f59e0b, #d97706, #fbbf24)' },
];

export default function SettingsPage() {
  const { user } = useUser();
  const { patients, appointments, invoices } = useStore();
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securitySaving, setSecuritySaving] = useState(false);

  // Clinic state
  const [clinicName, setClinicName] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicUPI, setClinicUPI] = useState('');
  const [clinicMsg, setClinicMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Appearance state
  const [selectedTheme, setSelectedTheme] = useState('ocean');
  const [isDark, setIsDark] = useState(false);

  // Load clinic settings from localStorage
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (user) {
      setDisplayName(user.fullName || user.firstName || '');
    }
    const saved = localStorage.getItem('smilesync_clinic');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setClinicName(data.clinicName || '');
        setClinicPhone(data.clinicPhone || '');
        setClinicAddress(data.clinicAddress || '');
        setClinicUPI(data.clinicUPI || '');
      } catch { /* ignore */ }
    }
    const savedTheme = localStorage.getItem('smilesync_theme');
    if (savedTheme) setSelectedTheme(savedTheme);
    
    const savedDark = localStorage.getItem('smilesync_dark');
    if (savedDark === 'true') setIsDark(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);



  // Save profile
  const handleSaveProfile = async () => {
    if (!user || !displayName.trim()) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await user.update({ firstName: displayName.split(' ')[0], lastName: displayName.split(' ').slice(1).join(' ') || undefined });
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch {
      setProfileMsg({ type: 'error', text: 'Failed to update profile. Please try again.' });
    }
    setProfileSaving(false);
    setTimeout(() => setProfileMsg(null), 4000);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!user) return;
    setSecurityMsg(null);
    if (newPassword.length < 8) {
      setSecurityMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSecuritySaving(true);
    try {
      await user.updatePassword({ currentPassword, newPassword });
      setSecurityMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setSecurityMsg({ type: 'error', text: 'Failed to change password. Check your current password.' });
    }
    setSecuritySaving(false);
    setTimeout(() => setSecurityMsg(null), 4000);
  };

  // Save clinic settings
  const handleSaveClinic = () => {
    localStorage.setItem('smilesync_clinic', JSON.stringify({ clinicName, clinicPhone, clinicAddress, clinicUPI }));
    setClinicMsg({ type: 'success', text: 'Clinic settings saved!' });
    setTimeout(() => setClinicMsg(null), 3000);
  };

  // Save theme & broadcast to ThemeProvider
  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    localStorage.setItem('smilesync_theme', themeId);
    window.dispatchEvent(new CustomEvent('smilesync:theme-change', { detail: themeId }));
  };

  // Toggle Dark Mode
  const handleToggleDark = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    localStorage.setItem('smilesync_dark', newVal.toString());
    window.dispatchEvent(new CustomEvent('smilesync:dark-change', { detail: newVal }));
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Tab Navigation */}
        <div className="settings-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'settings-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="settings-content">

          {/* ═══ PROFILE TAB ═══ */}
          {activeTab === 'profile' && (
            <div className="settings-panel">
              <h2 className="settings-panel-title">
                <User size={20} /> Profile Information
              </h2>

              <div className="settings-profile-header">
                <div className="settings-profile-avatar">
                  {(user?.fullName || user?.firstName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="settings-profile-name">{user?.fullName || user?.firstName || 'User'}</div>
                  <div className="settings-profile-email">{user?.primaryEmailAddress?.emailAddress || ''}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  value={user?.primaryEmailAddress?.emailAddress || ''}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Email is managed by your authentication provider.</span>
              </div>

              {profileMsg && (
                <div className={`settings-msg settings-msg-${profileMsg.type}`}>
                  {profileMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
                  {profileMsg.text}
                </div>
              )}

              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileSaving} style={{ marginTop: '0.5rem' }}>
                <Save size={16} /> {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>

              {/* Quick Stats */}
              <div className="settings-stats-grid">
                <div className="settings-quick-stat">
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                  <span className="settings-stat-num">{patients.length}</span>
                  <span className="settings-stat-lbl">Patients</span>
                </div>
                <div className="settings-quick-stat">
                  <CalendarDays size={18} style={{ color: 'var(--secondary)' }} />
                  <span className="settings-stat-num">{appointments.length}</span>
                  <span className="settings-stat-lbl">Appointments</span>
                </div>
                <div className="settings-quick-stat">
                  <Receipt size={18} style={{ color: 'var(--success)' }} />
                  <span className="settings-stat-num">{invoices.length}</span>
                  <span className="settings-stat-lbl">Invoices</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SECURITY TAB ═══ */}
          {activeTab === 'security' && (
            <div className="settings-panel">
              <h2 className="settings-panel-title">
                <Shield size={20} /> Change Password
              </h2>

              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div className="settings-password-wrap">
                  <input
                    className="form-input"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <button className="settings-eye-btn" type="button" onClick={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="settings-password-wrap">
                  <input
                    className="form-input"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <button className="settings-eye-btn" type="button" onClick={() => setShowNew(!showNew)}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword && newPassword.length < 8 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Password must be at least 8 characters</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div className="settings-password-wrap">
                  <input
                    className="form-input"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                  <button className="settings-eye-btn" type="button" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Passwords do not match</span>
                )}
              </div>

              {securityMsg && (
                <div className={`settings-msg settings-msg-${securityMsg.type}`}>
                  {securityMsg.type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
                  {securityMsg.text}
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={handleChangePassword}
                disabled={securitySaving || !currentPassword || !newPassword || !confirmPassword}
                style={{ marginTop: '0.5rem' }}
              >
                <Shield size={16} /> {securitySaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          )}

          {/* ═══ CLINIC TAB ═══ */}
          {activeTab === 'clinic' && (
            <div className="settings-panel">
              <h2 className="settings-panel-title">
                <Building2 size={20} /> Clinic Configuration
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                These details are used in invoice PDFs and clinic branding.
              </p>

              <div className="form-group">
                <label className="form-label"><Building2 size={14} /> Clinic Name</label>
                <input className="form-input" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="SmileSync Dental Care" />
              </div>

              <div className="form-group">
                <label className="form-label"><Phone size={14} /> Clinic Phone</label>
                <input className="form-input" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>

              <div className="form-group">
                <label className="form-label"><MapPin size={14} /> Clinic Address</label>
                <input className="form-input" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} placeholder="123 Healthcare Avenue, City" />
              </div>

              <div className="form-group">
                <label className="form-label"><CreditCard size={14} /> UPI ID (for Invoice QR)</label>
                <input className="form-input" value={clinicUPI} onChange={e => setClinicUPI(e.target.value)} placeholder="yourname@upi" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>This UPI ID will be encoded in the QR code on invoice PDFs.</span>
              </div>

              {clinicMsg && (
                <div className={`settings-msg settings-msg-${clinicMsg.type}`}>
                  <Check size={15} /> {clinicMsg.text}
                </div>
              )}

              <button className="btn btn-primary" onClick={handleSaveClinic} style={{ marginTop: '0.5rem' }}>
                <Save size={16} /> Save Clinic Settings
              </button>
            </div>
          )}

          {/* ═══ APPEARANCE TAB ═══ */}
          {activeTab === 'appearance' && (
            <div className="settings-panel">
              <h2 className="settings-panel-title">
                <Palette size={20} /> Appearance
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Choose a color theme and viewing mode for the application.
              </p>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--glass-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', color: 'var(--primary)' }}>
                      <Moon size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>Dark Mode</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Easy on the eyes for low-light environments</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleToggleDark}
                    style={{ 
                      width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: isDark ? 'var(--primary)' : 'rgba(148, 163, 184, 0.3)',
                      position: 'relative', transition: 'var(--transition-fast)'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', top: '2px', left: isDark ? '22px' : '2px',
                      width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                      transition: 'var(--transition-fast)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                    }} />
                  </button>
                </div>
              </div>

              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Accent Colors</div>
              <div className="settings-theme-grid">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    className={`settings-theme-card ${selectedTheme === theme.id ? 'settings-theme-active' : ''}`}
                    onClick={() => handleThemeSelect(theme.id)}
                  >
                    <div className="settings-theme-preview" style={{ background: theme.gradient }} />
                    <div className="settings-theme-info">
                      <span className="settings-theme-name">{theme.label}</span>
                      <div className="settings-theme-dots">
                        <span style={{ background: theme.primary }} />
                        <span style={{ background: theme.secondary }} />
                        <span style={{ background: theme.accent }} />
                      </div>
                    </div>
                    {selectedTheme === theme.id && (
                      <div className="settings-theme-check">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
