'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store';
import { collection, getDocs, doc, deleteDoc, getCountFromServer, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { UserData, Clinic, SubscriptionPlan, SubscriptionHistoryEntry } from '@/types';
import { 
  Shield, 
  Loader2, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  List, 
  History, 
  Headset, 
  Settings, 
  ChevronDown, 
  CalendarDays, 
  Trash2,
  Plus,
  X,
  Edit3,
  CreditCard,
  Crown,
  Zap,
  Eye,
  Search,
  MessageCircle
} from 'lucide-react';

type AdminStats = {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  clinicId: string;
  clinicName: string;
  patientCount: number;
  appointmentCount: number;
  subStatus: string;
  subPlan: string;
  subPlanId: string;
  subEndDate: string;
};

export default function AdminPage() {
  const { userData, isLoading } = useStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState('All');

  // Subscription Plans state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('30');

  // Assign plan modal state
  const [assignModal, setAssignModal] = useState<{ userId: string; clinicId: string; email: string } | null>(null);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignCycle, setAssignCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [savingAssign, setSavingAssign] = useState(false);

  // History state
  const [history, setHistory] = useState<SubscriptionHistoryEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState('');

  // Platform Settings state
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [trialDays, setTrialDays] = useState(7);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('Hi, I would like to renew my SmileSync subscription.');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!userData?.isSuperAdmin && (userData?.email || '').toLowerCase().trim() !== 'sudhanshu18k@gmail.com') {
      router.push('/dashboard');
      return;
    }
    fetchAdminData();
  }, [userData, isLoading, router]);

  // Realtime subscription plans
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      const fetchedPlans: SubscriptionPlan[] = snap.docs.map(d => ({ ...(d.data() as SubscriptionPlan), id: d.id }));
      setPlans(fetchedPlans.sort((a, b) => a.monthlyPrice - b.monthlyPrice));
    });
    return () => unsub();
  }, []);

  // Realtime subscription history
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscriptionHistory'), (snap) => {
      const entries: SubscriptionHistoryEntry[] = snap.docs.map(d => ({ ...(d.data() as SubscriptionHistoryEntry), id: d.id }));
      setHistory(entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });
    return () => unsub();
  }, []);

  // Load platform settings from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'platformSettings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.trialEnabled !== undefined) setTrialEnabled(data.trialEnabled);
        if (data.trialDays) setTrialDays(data.trialDays);
        if (data.waPhone) setWaPhone(data.waPhone);
        if (data.waMessage) setWaMessage(data.waMessage);
      }
    });
    return () => unsub();
  }, []);

  // Save platform settings
  const handleSavePlatformSettings = async () => {
    setSettingsSaving(true);
    setSettingsMsg(null);
    try {
      await setDoc(doc(db, 'platformSettings', 'global'), {
        trialEnabled,
        trialDays,
        waPhone: waPhone.trim(),
        waMessage: waMessage.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: userData?.email || 'admin',
      }, { merge: true });
      setSettingsMsg({ type: 'success', text: 'Platform settings saved successfully!' });
    } catch {
      setSettingsMsg({ type: 'error', text: 'Failed to save settings. Please try again.' });
    }
    setSettingsSaving(false);
    setTimeout(() => setSettingsMsg(null), 4000);
  };

  // Helper: log a subscription history entry
  const logHistory = async (entry: Omit<SubscriptionHistoryEntry, 'id' | 'timestamp' | 'performedBy'>) => {
    const ref = doc(collection(db, 'subscriptionHistory'));
    await setDoc(ref, {
      ...entry,
      id: ref.id,
      timestamp: new Date().toISOString(),
      performedBy: userData?.email || 'system',
    });
  };

  const fetchAdminData = async () => {
    setLoadingData(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));

      // Build all fetch tasks in parallel
      const tasks: Promise<AdminStats | null>[] = [];

      for (const userDoc of usersSnap.docs) {
        const uData = userDoc.data() as UserData;
        if (!uData.clinics || uData.clinics.length === 0) continue;

        for (const clinicRef of uData.clinics) {
          if (clinicRef.role !== 'owner') continue;

          // Each clinic is fetched in parallel
          tasks.push((async () => {
            let pCount = 0, aCount = 0;
            let subStatus = 'active', subPlan = 'manual', subEndDate = '-', subPlanId = '';

            try {
              // Run clinic doc + counts in parallel
              const [clinicSnap, pSnap, aSnap] = await Promise.all([
                getDoc(doc(db, 'clinics', clinicRef.clinicId)),
                getCountFromServer(collection(db, 'clinics', clinicRef.clinicId, 'patients')).catch(() => null),
                getCountFromServer(collection(db, 'clinics', clinicRef.clinicId, 'appointments')).catch(() => null),
              ]);

              if (clinicSnap.exists()) {
                const cData = clinicSnap.data() as Clinic;
                subStatus = cData.subscriptionStatus || 'active';
                subPlan = cData.subscriptionPlan || 'manual';
                subEndDate = cData.subscriptionEndDate || '-';
                subPlanId = cData.subscriptionPlanId || '';
              }
              pCount = pSnap?.data().count ?? 0;
              aCount = aSnap?.data().count ?? 0;
            } catch (e) {
              console.error('Error fetching clinic data', clinicRef.clinicId, e);
            }

            return {
              userId: uData.id,
              email: uData.email,
              isSuperAdmin: !!uData.isSuperAdmin || (uData.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com',
              clinicId: clinicRef.clinicId,
              clinicName: clinicRef.name,
              patientCount: pCount,
              appointmentCount: aCount,
              subStatus,
              subPlan,
              subPlanId,
              subEndDate
            };
          })());
        }
      }

      const results = await Promise.all(tasks);
      setStats(results.filter((r): r is AdminStats => r !== null));
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoadingData(false);
    }
  };

  // ─── Plan CRUD ───
  const handleCreateOrUpdatePlan = async () => {
    if (!planName.trim() || !planPrice) return;
    const price = Number(planPrice) || 0;
    const duration = parseInt(planDuration) || 30;
    const planData = {
      name: planName.trim(),
      monthlyPrice: price,
      yearlyPrice: price * (duration > 30 ? 1 : 12),
      features: [] as string[],
      isActive: true,
      duration,
      createdAt: editingPlan?.createdAt || new Date().toISOString(),
    };

    if (editingPlan) {
      await updateDoc(doc(db, 'subscriptionPlans', editingPlan.id), planData);
      setEditingPlan(null);
    } else {
      const ref = doc(collection(db, 'subscriptionPlans'));
      await setDoc(ref, { ...planData, id: ref.id });
    }
    setPlanName('');
    setPlanPrice('');
    setPlanDuration('30');
  };

  const startEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanPrice(plan.monthlyPrice.toString());
    setPlanDuration((plan.duration || 30).toString());
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanPrice('');
    setPlanDuration('30');
  };

  const handleDeletePlan = async (planId: string) => {
    const isUsed = stats.some(s => s.subPlanId === planId);
    if (isUsed) {
      alert('This plan is currently assigned to one or more clinics and cannot be deleted.');
      return;
    }
    if (!confirm('Delete this plan?')) return;
    await deleteDoc(doc(db, 'subscriptionPlans', planId));
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlan) => {
    await updateDoc(doc(db, 'subscriptionPlans', plan.id), { isActive: !plan.isActive });
  };

  // ─── User Actions ───
  const handleDeleteUserClinic = async (userId: string, clinicId: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete clinic ${clinicId}? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'clinics', clinicId));
      const confirmUserDelete = window.confirm(`Would you also like to delete User Account: ${userId}?`);
      if (confirmUserDelete) {
        await deleteDoc(doc(db, 'users', userId));
      }
      fetchAdminData();
    } catch (error) {
      console.error("Error deleting user/clinic", error);
      alert('Failed to delete user.');
    }
  };

  const handleLockClinic = async (clinicId: string) => {
    if (!confirm('Lock this clinic? Users will enter read-only mode.')) return;
    await updateDoc(doc(db, 'clinics', clinicId), { subscriptionStatus: 'locked' });
    const stat = stats.find(s => s.clinicId === clinicId);
    await logHistory({ clinicId, email: stat?.email || '', action: 'locked', note: 'Admin locked account' });
    fetchAdminData();
  };

  const handleQuickActivate = async (clinicId: string) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await updateDoc(doc(db, 'clinics', clinicId), {
      subscriptionStatus: 'active',
      subscriptionPlan: 'Manual Activation',
      subscriptionStartDate: new Date().toISOString(),
      subscriptionEndDate: endDate.toISOString(),
    });
    const stat = stats.find(s => s.clinicId === clinicId);
    await logHistory({ clinicId, email: stat?.email || '', action: 'activated', planName: 'Manual Activation', note: 'Quick 30-day activation' });
    fetchAdminData();
  };

  const handleApproveTrial = async (clinicId: string) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    await updateDoc(doc(db, 'clinics', clinicId), {
      subscriptionStatus: 'trial',
      subscriptionPlan: 'Free Trial',
      trialStartDate: new Date().toISOString(),
      subscriptionStartDate: new Date().toISOString(),
      subscriptionEndDate: endDate.toISOString(),
    });
    const stat = stats.find(s => s.clinicId === clinicId);
    await logHistory({ clinicId, email: stat?.email || '', action: 'trial_started', planName: 'Free Trial', note: 'Admin approved 7-day trial' });
    fetchAdminData();
  };

  const handleDeactivatePlan = async (clinicId: string) => {
    if (!confirm('Deactivate this user\'s plan? They will enter read-only mode.')) return;
    await updateDoc(doc(db, 'clinics', clinicId), {
      subscriptionStatus: 'expired',
      subscriptionPlan: '',
      subscriptionPlanId: '',
    });
    const stat = stats.find(s => s.clinicId === clinicId);
    await logHistory({ clinicId, email: stat?.email || '', action: 'deactivated', planName: stat?.subPlan || '', note: 'Admin deactivated plan' });
    fetchAdminData();
  };

  // ─── Assign Plan to User ───
  const openAssignModal = (stat: AdminStats) => {
    setAssignModal({ userId: stat.userId, clinicId: stat.clinicId, email: stat.email });
    setAssignPlanId(stat.subPlanId || (plans.length > 0 ? plans[0].id : ''));
    setAssignCycle('monthly');
  };

  const handleAssignPlan = useCallback(async () => {
    if (!assignModal || !assignPlanId) return;
    setSavingAssign(true);
    try {
      const plan = plans.find(p => p.id === assignPlanId);
      if (!plan) { setSavingAssign(false); return; }

      const now = new Date();
      const endDate = new Date();
      if (assignCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await updateDoc(doc(db, 'clinics', assignModal.clinicId), {
        subscriptionStatus: 'active',
        subscriptionPlanId: plan.id,
        subscriptionPlan: `${plan.name} (${assignCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
        subscriptionStartDate: now.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
      });

      await logHistory({
        clinicId: assignModal.clinicId,
        email: assignModal.email,
        action: 'plan_assigned',
        planName: plan.name,
        amount: assignCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
        cycle: assignCycle,
        note: `Assigned ${plan.name} (${assignCycle}) — ₹${assignCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}`,
      });

      setAssignModal(null);
      fetchAdminData();
    } catch (error) {
      console.error('Failed to assign plan', error);
      alert('Failed to assign plan.');
    }
    setSavingAssign(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignModal, assignPlanId, assignCycle, plans]);

  if (isLoading || loadingData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={48} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // Calculate top stats
  const activeSubs = stats.filter(s => ['active', 'manual'].includes(s.subStatus)).length;
  const trialUsers = stats.filter(s => s.subStatus === 'trial').length;
  const expiredUsers = stats.filter(s => ['expired', 'locked'].includes(s.subStatus)).length;

  const filteredStats = stats.filter(s => {
    const matchesSearch = s.email.toLowerCase().includes(searchQuery.toLowerCase()) || s.clinicName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPill = filterPill === 'All' 
      ? true 
      : filterPill === 'Active' ? ['active', 'manual'].includes(s.subStatus)
      : filterPill.toLowerCase() === s.subStatus.toLowerCase();
    return matchesSearch && matchesPill;
  });

  const formatDate = (d: string) => {
    if (!d || d === '-') return '-';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return d; }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'manual': return { bg: '#d1fae5', text: '#059669' };
      case 'trial': return { bg: '#fef3c7', text: '#d97706' };
      case 'expired': return { bg: '#fee2e2', text: '#b91c1c' };
      case 'locked': return { bg: '#fce7f3', text: '#be185d' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <div style={{ padding: '0 1rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Shield size={35} color="#e11d48" />
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.03em', margin: 0 }}>Admin Panel</h1>
      </div>

      {/* Top Stat Cards Grid */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <StatCard icon={<Users size={24} />} color="#f43f5e" bg="#ffe4e6" label="Total Users" value={stats.length} />
        <StatCard icon={<CheckCircle size={24} />} color="#10b981" bg="#d1fae5" label="Active Subs" value={activeSubs} />
        <StatCard icon={<AlertTriangle size={24} />} color="#f59e0b" bg="#fef3c7" label="Trial Users" value={trialUsers} />
        <StatCard icon={<Lock size={24} />} color="#f43f5e" bg="#ffe4e6" label="Expired/Locked" value={expiredUsers} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1.5rem', background: 'var(--surface-container-lowest)', padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-full)', marginBottom: '1.5rem', width: 'fit-content', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
        <TabItem icon={<Users size={18} />} label={`Users (${stats.length})`} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <TabItem icon={<AlertTriangle size={18} />} label="Expiring Soon" active={activeTab === 'expiring'} onClick={() => setActiveTab('expiring')} />
        <TabItem icon={<List size={18} />} label="Subscription Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
        <TabItem icon={<History size={18} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <TabItem icon={<Headset size={18} />} label="Support Tickets" active={activeTab === 'support'} onClick={() => setActiveTab('support')} />
        <TabItem icon={<Settings size={18} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </div>

      {/* ═══════════════════════════════════
          TAB: USERS
         ═══════════════════════════════════ */}
      {activeTab === 'users' && (
        <>
          {/* Search and Filter Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Search by email or clinic name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '400px', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.9rem', color: 'var(--on-surface)', outline: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
            />
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
              {['All', 'Active', 'Trial', 'Expired', 'Locked'].map(pill => (
                <button 
                  key={pill}
                  onClick={() => setFilterPill(pill)}
                  style={{ 
                    background: filterPill === pill ? '#e11d48' : 'transparent',
                    color: filterPill === pill ? '#ffffff' : 'inherit',
                    padding: '0.4rem 1.25rem',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: filterPill === pill ? 700 : 600,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Main Table */}
          <div className="table-wrapper card" style={{ padding: 0, borderRadius: '1.5rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>EMAIL</th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>CLINIC</th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap:'0.4rem'}}><Users size={17} /> PATIENTS</div></th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap:'0.4rem'}}><CalendarDays size={17} /> APPTS</div></th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>ROLE</th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>SUBSCRIPTION</th>
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontWeight: 700 }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                      No users match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStats.map((stat, idx) => {
                    const sc = getStatusColor(stat.subStatus);
                    return (
                      <tr key={idx} style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <ChevronDown size={20} color="#cbd5e1" />
                          {stat.email}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>
                          {stat.clinicName}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: 'var(--on-surface-variant)' }}>
                          {stat.patientCount}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: 'var(--on-surface-variant)' }}>
                          {stat.appointmentCount}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          {stat.isSuperAdmin ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#ffe4e6', color: '#e11d48', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                               <Shield size={14} /> admin
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.8rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                              user
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ background: sc.bg, color: sc.text, padding: '0.15rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', width: 'fit-content' }}>
                              {stat.subStatus}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{stat.subPlan}</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Until {formatDate(stat.subEndDate)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => openAssignModal(stat)}
                              style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                              title="Assign Plan & Mark Paid"
                            >
                              <CreditCard size={13} /> Assign Plan
                            </button>
                            {(stat.subStatus === 'expired' || stat.subStatus === 'locked' || stat.subStatus === 'trial' || stat.subStatus === 'pending') && (
                              <button
                                onClick={() => handleQuickActivate(stat.clinicId)}
                                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                                title="Quick activate for 30 days"
                              >
                                <Zap size={13} /> Activate
                              </button>
                            )}
                            {stat.subStatus === 'pending' && (
                              <button
                                onClick={() => handleApproveTrial(stat.clinicId)}
                                style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                                title="Approve 7-day free trial"
                              >
                                <CheckCircle size={13} /> Approve Trial
                              </button>
                            )}
                            <button style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', padding: '0.3rem' }} title="Lock Account" onClick={() => handleLockClinic(stat.clinicId)}>
                              <Lock size={17} />
                            </button>
                            {(stat.subStatus === 'active' || stat.subStatus === 'trial') && (
                              <button
                                onClick={() => handleDeactivatePlan(stat.clinicId)}
                                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                                title="Deactivate plan — user enters read-only mode"
                              >
                                <X size={13} /> Deactivate
                              </button>
                            )}
                            <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '0.3rem' }} title="Delete Account" onClick={() => handleDeleteUserClinic(stat.userId, stat.clinicId)}>
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════
          TAB: EXPIRING SOON 
         ═══════════════════════════════════ */}
      {activeTab === 'expiring' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--on-surface)' }}>
            <AlertTriangle size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: '#f59e0b' }} />
            Expiring Within 7 Days
          </h2>
          <div className="table-wrapper card" style={{ padding: 0, borderRadius: '1.5rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>EMAIL</th>
                  <th style={thStyle}>CLINIC</th>
                  <th style={thStyle}>STATUS</th>
                  <th style={thStyle}>EXPIRES</th>
                  <th style={thStyle}>DAYS LEFT</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const expiring = stats.filter(s => {
                    if (!s.subEndDate || s.subEndDate === '-') return false;
                    try {
                      const d = Math.ceil((new Date(s.subEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return d >= 0 && d <= 7;
                    } catch { return false; }
                  });
                  if (expiring.length === 0) {
                    return (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No users expiring soon 🎉</td></tr>
                    );
                  }
                  return expiring.map((s, i) => {
                    const daysLeft = Math.ceil((new Date(s.subEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const sc = getStatusColor(s.subStatus);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={tdStyle}>{s.email}</td>
                        <td style={tdStyle}>{s.clinicName}</td>
                        <td style={tdStyle}>
                          <span style={{ background: sc.bg, color: sc.text, padding: '0.15rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>{s.subStatus}</span>
                        </td>
                        <td style={tdStyle}>{formatDate(s.subEndDate)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 800, color: daysLeft <= 2 ? '#ef4444' : '#f59e0b', fontSize: '1.1rem' }}>{daysLeft}</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.3rem' }}>days</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => openAssignModal(s)}
                            style={{ background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <CreditCard size={14} /> Renew
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: SUBSCRIPTION PLANS
         ═══════════════════════════════════ */}
      {activeTab === 'plans' && (
        <div>
          {/* Inline Create/Edit Form */}
          <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem', borderRadius: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={18} /> {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <input
                value={planName}
                onChange={e => setPlanName(e.target.value)}
                placeholder="Plan name (e.g. Monthly)"
                style={{ flex: '1 1 200px', padding: '0.7rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)', fontSize: '0.88rem', color: 'var(--on-surface)', outline: 'none' }}
              />
              <input
                value={planPrice}
                onChange={e => setPlanPrice(e.target.value)}
                placeholder="Price (₹)"
                type="number"
                style={{ flex: '0 1 140px', padding: '0.7rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)', fontSize: '0.88rem', color: 'var(--on-surface)', outline: 'none' }}
              />
              <input
                value={planDuration}
                onChange={e => setPlanDuration(e.target.value)}
                placeholder="Days"
                type="number"
                style={{ flex: '0 1 100px', padding: '0.7rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)', fontSize: '0.88rem', color: 'var(--on-surface)', outline: 'none' }}
              />
              <button
                onClick={handleCreateOrUpdatePlan}
                disabled={!planName.trim() || !planPrice}
                style={{
                  padding: '0.7rem 1.75rem', borderRadius: 'var(--radius-full)', border: 'none',
                  background: editingPlan ? '#3b82f6' : 'linear-gradient(135deg, var(--primary), var(--primary-container))',
                  color: '#fff', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: (!planName.trim() || !planPrice) ? 0.5 : 1,
                  transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
              >
                <Plus size={16} strokeWidth={3} /> {editingPlan ? 'Update' : 'Create'}
              </button>
              {editingPlan && (
                <button
                  onClick={cancelEdit}
                  style={{ padding: '0.7rem 1.25rem', borderRadius: 'var(--radius-full)', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Plans Table */}
          <div className="table-wrapper card" style={{ padding: 0, borderRadius: '1.25rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontWeight: 500 }}>
                      No plans created yet. Use the form above to create one.
                    </td>
                  </tr>
                ) : (
                  plans.map(plan => {
                    const dur = plan.duration || 30;
                    return (
                      <tr key={plan.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--on-surface)' }}>{plan.name}</td>
                        <td style={tdStyle}>₹{plan.monthlyPrice.toLocaleString()}</td>
                        <td style={tdStyle}>{dur} days</td>
                        <td style={tdStyle}>
                          <span style={{
                            background: plan.isActive ? '#d1fae5' : '#fee2e2',
                            color: plan.isActive ? '#059669' : '#dc2626',
                            padding: '0.2rem 0.65rem', borderRadius: '1rem',
                            fontSize: '0.72rem', fontWeight: 700
                          }}>
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleTogglePlanActive(plan)}
                              style={{ padding: '0.3rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#fff', color: plan.isActive ? '#dc2626' : '#059669', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              {plan.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => startEditPlan(plan)}
                              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                              title="Edit"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: HISTORY
         ═══════════════════════════════════ */}
      {activeTab === 'history' && (
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--on-surface)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={20} /> Subscription History
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                placeholder="Filter by email..."
                style={{ paddingLeft: '2.25rem', padding: '0.6rem 1rem 0.6rem 2.25rem', borderRadius: 'var(--radius-full)', border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem', color: 'var(--on-surface)', outline: 'none', width: '300px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
              />
            </div>
          </div>

          <div className="table-wrapper card" style={{ padding: 0, borderRadius: '1.25rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}>By</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = historyFilter.trim()
                    ? history.filter(h => h.email.toLowerCase().includes(historyFilter.toLowerCase()))
                    : history;
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontWeight: 500 }}>
                          {historyFilter ? 'No history found for this email.' : 'No subscription history yet.'}
                        </td>
                      </tr>
                    );
                  }
                  return filtered.map(h => {
                    const actionColors: Record<string, { bg: string; text: string }> = {
                      plan_assigned: { bg: '#dbeafe', text: '#1d4ed8' },
                      activated: { bg: '#d1fae5', text: '#059669' },
                      deactivated: { bg: '#fee2e2', text: '#dc2626' },
                      locked: { bg: '#fce7f3', text: '#be185d' },
                      expired: { bg: '#fee2e2', text: '#b91c1c' },
                      trial_started: { bg: '#fef3c7', text: '#d97706' },
                      plan_created: { bg: '#e0e7ff', text: '#4338ca' },
                      plan_deleted: { bg: '#fef2f2', text: '#991b1b' },
                    };
                    const ac = actionColors[h.action] || { bg: '#f1f5f9', text: '#64748b' };
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {new Date(h.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                            {new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--on-surface)', fontSize: '0.85rem' }}>{h.email}</td>
                        <td style={tdStyle}>
                          <span style={{
                            background: ac.bg, color: ac.text,
                            padding: '0.15rem 0.6rem', borderRadius: '1rem',
                            fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap'
                          }}>
                            {h.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.85rem' }}>{h.planName || '—'}</td>
                        <td style={{ ...tdStyle, fontSize: '0.85rem', fontWeight: h.amount ? 700 : 400 }}>
                          {h.amount ? `₹${h.amount.toLocaleString()}` : '—'}
                          {h.cycle && <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.2rem' }}>/{h.cycle === 'monthly' ? 'mo' : 'yr'}</span>}
                        </td>
                        <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#64748b', maxWidth: '220px' }}>{h.note || '—'}</td>
                        <td style={{ ...tdStyle, fontSize: '0.75rem', color: '#94a3b8' }}>{h.performedBy?.split('@')[0] || 'system'}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: SUPPORT (placeholder)
         ═══════════════════════════════════ */}
      {activeTab === 'support' && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>
          <Headset size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
          <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Support Tickets</h3>
          <p>Coming soon — manage support requests from users.</p>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: SETTINGS (placeholder)
         ═══════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div style={{ maxWidth: '700px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={22} /> Platform Settings
          </h2>

          {/* Free Trial Toggle */}
          <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '1rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--on-surface)' }}>Free Trial for New Users</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>New users get a {trialDays}-day free trial upon signup.</div>
              </div>
              <button
                onClick={() => setTrialEnabled(!trialEnabled)}
                style={{
                  width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                  background: trialEnabled ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'rgba(148, 163, 184, 0.3)',
                  position: 'relative', transition: 'all 0.25s ease', flexShrink: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: '3px', left: trialEnabled ? '24px' : '3px',
                  width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                  transition: 'all 0.25s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }} />
              </button>
            </div>
          </div>

          {/* Trial status indicator */}
          <div style={{
            padding: '0.6rem 1.25rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)',
            background: trialEnabled ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${trialEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            fontSize: '0.8rem', fontWeight: 600,
            color: trialEnabled ? '#059669' : '#dc2626',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            Current status:
            <span style={{
              background: trialEnabled ? '#d1fae5' : '#fee2e2',
              color: trialEnabled ? '#059669' : '#dc2626',
              padding: '0.15rem 0.65rem', borderRadius: '1rem',
              fontSize: '0.72rem', fontWeight: 700
            }}>
              {trialEnabled ? `Enabled — ${trialDays} days` : 'Disabled'}
            </span>
          </div>

          {/* WhatsApp Settings */}
          <div className="card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem', borderRadius: '1.25rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Admin WhatsApp Phone Number
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Enter the phone number users will contact for subscription renewal (with country code, e.g. 919876543210).
              </div>
              <input
                value={waPhone}
                onChange={e => setWaPhone(e.target.value)}
                placeholder="919876543210"
                style={{
                  width: '100%', padding: '0.75rem 1rem', marginTop: '0.75rem',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)',
                  background: 'var(--surface-container-lowest)', fontSize: '0.9rem',
                  color: 'var(--on-surface)', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--on-surface)' }}>
                WhatsApp Renewal Message
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Customize the pre-filled message users see when they click &quot;Renew via WhatsApp&quot;.
              </div>
              <input
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                placeholder="Hi, I would like to renew my SmileSync subscription."
                style={{
                  width: '100%', padding: '0.75rem 1rem', marginTop: '0.75rem',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)',
                  background: 'var(--surface-container-lowest)', fontSize: '0.9rem',
                  color: 'var(--on-surface)', outline: 'none'
                }}
              />
            </div>

            {settingsMsg && (
              <div style={{
                padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem',
                background: settingsMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                color: settingsMsg.type === 'success' ? '#059669' : '#dc2626',
                fontSize: '0.82rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}>
                {settingsMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                {settingsMsg.text}
              </div>
            )}

            <button
              onClick={handleSavePlatformSettings}
              disabled={settingsSaving}
              style={{
                padding: '0.6rem 1.5rem', borderRadius: 'var(--radius-full)', border: 'none',
                background: 'linear-gradient(135deg, #25d366, #128c7e)', color: '#fff',
                fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                opacity: settingsSaving ? 0.6 : 1, transition: 'all 0.2s'
              }}
            >
              <MessageCircle size={16} /> {settingsSaving ? 'Saving...' : 'Save WhatsApp Settings'}
            </button>
          </div>
        </div>
      )}



      {/* ═══════════════════════════════════
          MODAL: Assign Plan to User
         ═══════════════════════════════════ */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal-content" style={{ width: '480px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <CreditCard size={22} color="#059669" />
                Assign Plan & Mark Paid
              </h2>
              <button onClick={() => setAssignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Eye size={18} color="#059669" />
              <div>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.9rem' }}>{assignModal.email}</div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>Clinic ID: {assignModal.clinicId.slice(0, 12)}...</div>
              </div>
            </div>

            {plans.filter(p => p.isActive).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                <Crown size={32} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                <p>No active plans available. Create a plan first.</p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Select Plan</label>
                  <select
                    className="form-select"
                    value={assignPlanId}
                    onChange={e => setAssignPlanId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {plans.filter(p => p.isActive).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.monthlyPrice}/mo · ₹{p.yearlyPrice}/yr
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Cycle</label>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setAssignCycle('monthly')}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)', border: assignCycle === 'monthly' ? '2px solid #059669' : '1px solid #e2e8f0',
                        background: assignCycle === 'monthly' ? '#f0fdf4' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: assignCycle === 'monthly' ? '#166534' : 'var(--on-surface)', fontSize: '1rem' }}>Monthly</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        ₹{plans.find(p => p.id === assignPlanId)?.monthlyPrice.toLocaleString() || 0}/mo
                      </div>
                    </button>
                    <button
                      onClick={() => setAssignCycle('yearly')}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 'var(--radius-md)', border: assignCycle === 'yearly' ? '2px solid #059669' : '1px solid #e2e8f0',
                        background: assignCycle === 'yearly' ? '#f0fdf4' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: assignCycle === 'yearly' ? '#166534' : 'var(--on-surface)', fontSize: '1rem' }}>Yearly</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        ₹{plans.find(p => p.id === assignPlanId)?.yearlyPrice.toLocaleString() || 0}/yr
                      </div>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button onClick={() => setAssignModal(null)} className="btn btn-secondary btn-sm">Cancel</button>
                  <button onClick={handleAssignPlan} className="btn btn-primary btn-sm" disabled={savingAssign} style={{ background: '#059669' }}>
                    <CreditCard size={16} /> {savingAssign ? 'Saving...' : 'Assign & Mark Paid'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Shared Styles ───
const thStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700, textAlign: 'left'
};
const tdStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem', fontSize: '0.9rem', color: 'var(--on-surface-variant)'
};

// ─── Subcomponents ───

function StatCard({ icon, color, bg, label, value }: { icon: React.ReactNode, color: string, bg: string, label: string, value: number }) {
  return (
    <div style={{ flex: '1 1 200px', background: 'var(--surface-container-lowest)', borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: '0.2rem' }}>{label}</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', lineHeight: 1 }}>{value}</span>
      </div>
    </div>
  );
}

function TabItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{ 
        display: 'flex', alignItems: 'center', gap: '0.5rem', 
        background: 'none', border: 'none', cursor: 'pointer',
        color: active ? '#1e293b' : '#94a3b8',
        fontWeight: active ? 700 : 600,
        fontSize: '0.85rem',
        padding: '0.4rem', borderBottom: active ? '2px solid transparent' : '2px solid transparent',
        transition: 'all 0.2s ease'
      }}
    >
      {icon}
      {label}
    </button>
  );
}
