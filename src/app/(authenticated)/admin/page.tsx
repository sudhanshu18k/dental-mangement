'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '@/store';
import { collection, getDocs, doc, deleteDoc, getCountFromServer, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { UserData, Clinic, SubscriptionPlan, SubscriptionHistoryEntry, SupportTicket, BroadcastNotification, PaymentRecord } from '@/types';
import { 
  Shield, 
  Loader2, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Unlock,
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
  MessageCircle,
  Phone,
  Send
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
  isLocked: boolean;
  name?: string;
  phone?: string;
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
  const [assignModal, setAssignModal] = useState<{ userId: string; clinicId: string; email: string; name?: string } | null>(null);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignCycle, setAssignCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [assignPaymentAmount, setAssignPaymentAmount] = useState('');
  const [assignUpiRef, setAssignUpiRef] = useState('');
  const [assignPaymentDate, setAssignPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assignPaymentMethod, setAssignPaymentMethod] = useState<'upi' | 'cash'>('upi');
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

  // Support Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Broadcasts state
  const [broadcastAudience, setBroadcastAudience] = useState('All');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastNotification[]>([]);

  // Payments state
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Calendar state (Current month starts at 01)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

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

  // Realtime support tickets
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'support_tickets'), (snap) => {
      const fetchedTickets: SupportTicket[] = snap.docs.map(d => ({ ...(d.data() as SupportTicket), id: d.id }));
      setTickets(fetchedTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsub();
  }, []);

  // Realtime broadcasts
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'broadcastNotifications'), (snap) => {
      const bs: BroadcastNotification[] = snap.docs.map(d => ({ ...(d.data() as BroadcastNotification), id: d.id }));
      setBroadcastHistory(bs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
    });
    return () => unsub();
  }, []);

  // Realtime payments
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'subscriptionPayments'), (snap) => {
      const ps: PaymentRecord[] = snap.docs.map(d => ({ ...(d.data() as PaymentRecord), id: d.id }));
      setPayments(ps.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()));
    });
    return () => unsub();
  }, []);

  // Delete Payment
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'subscriptionPayments', paymentId));
    } catch (error) {
      console.error('Failed to delete payment', error);
      alert('Failed to delete payment record.');
    }
  };

  // Send Broadcast Notification
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setSendingBroadcast(true);

    try {
      let targets = stats;
      if (broadcastAudience !== 'All') {
        targets = stats.filter(s => {
          if (broadcastAudience === 'Active') return s.subStatus === 'active';
          if (broadcastAudience === 'Trial') return s.subStatus === 'trial';
          if (broadcastAudience === 'Expired') return s.subStatus === 'expired';
          if (broadcastAudience === 'Expiring') {
            if (!s.subEndDate || s.subEndDate === '-') return false;
            const days = Math.ceil((new Date(s.subEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 7;
          }
          return false;
        });
      }

      const broadcastRef = doc(collection(db, 'broadcastNotifications'));
      const broadcastData: BroadcastNotification = {
        id: broadcastRef.id,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        targetGroup: broadcastAudience.toLowerCase() as BroadcastNotification['targetGroup'],
        sentAt: new Date().toISOString(),
        sentBy: userData?.email || 'admin',
        recipientCount: targets.length
      };
      await setDoc(broadcastRef, broadcastData);

      const pushPromises = targets.map(target => {
        const notifRef = doc(collection(db, 'clinics', target.clinicId, 'notifications'));
        return setDoc(notifRef, {
          id: notifRef.id,
          broadcastId: broadcastRef.id,
          title: broadcastData.title,
          message: broadcastData.message,
          sentAt: broadcastData.sentAt,
          sentBy: broadcastData.sentBy,
          isRead: false
        });
      });
      await Promise.all(pushPromises);

      setBroadcastTitle('');
      setBroadcastMessage('');
      alert('Broadcast sent successfully to ' + targets.length + ' clinics.');
    } catch (e) {
      console.error(e);
      alert('Failed to send broadcast');
    }
    setSendingBroadcast(false);
  };

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
              subEndDate,
              isLocked: !!uData.isLocked,
              name: uData.name,
              phone: uData.phone
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
    setPlanName(plan.name);
    setPlanPrice(plan.monthlyPrice.toString());
    setPlanDuration(plan.duration.toString());
  };

  // ─── Support Actions ───
  const handleResolveTicket = async (id: string) => {
    setResolvingId(id);
    try {
      await updateDoc(doc(db, 'support_tickets', id), {
        status: 'resolved',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error resolving ticket:", err);
    }
    setResolvingId(null);
  };

  const handleUpdateTicketStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
    try {
      await updateDoc(doc(db, 'support_tickets', id), {
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error updating ticket status:", err);
    }
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

  const handleToggleUserLock = async (userId: string, currentLockState: boolean) => {
    const action = currentLockState ? 'unlock' : 'lock';
    if (!confirm(`Are you sure you want to ${action} this user? ${!currentLockState ? 'They will be unable to sign in.' : 'They will regain access.'}`)) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), { isLocked: !currentLockState });
      fetchAdminData();
    } catch (err) {
      console.error('Failed to toggle user lock:', err);
      alert('Failed to update user status.');
    }
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
    setAssignModal({ userId: stat.userId, clinicId: stat.clinicId, email: stat.email, name: stat.name || stat.clinicName });
    const activePlans = plans.filter(p => p.isActive);
    const currentPlan = plans.find(p => p.id === stat.subPlanId);
    const defaultId = (currentPlan && currentPlan.isActive) ? stat.subPlanId : (activePlans.length > 0 ? activePlans[0].id : '');
    setAssignPlanId(defaultId);
    setAssignCycle('monthly');
    setAssignPaymentAmount(currentPlan ? String(currentPlan.monthlyPrice) : '');
    setAssignUpiRef('');
    setAssignPaymentMethod('upi');
    setAssignPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleAssignPlan = useCallback(async () => {
    if (!assignModal || !assignPlanId) return;
    setSavingAssign(true);
    try {
      const plan = plans.find(p => p.id === assignPlanId);
      if (!plan) { setSavingAssign(false); return; }

      const now = new Date();
      const endDate = new Date();
      const durationDays = plan.duration || 30;
      
      if (assignCycle === 'monthly') {
        endDate.setDate(endDate.getDate() + durationDays);
      } else {
        const multiplier = durationDays > 30 ? 1 : 12;
        endDate.setDate(endDate.getDate() + (durationDays * multiplier));
      }

      await updateDoc(doc(db, 'clinics', assignModal.clinicId), {
        subscriptionStatus: 'active',
        subscriptionPlanId: plan.id,
        subscriptionPlan: `${plan.name} (${assignCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
        subscriptionStartDate: now.toISOString(),
        subscriptionEndDate: endDate.toISOString(),
      });

      // Log payment record if amount is provided
      if (assignPaymentAmount && Number(assignPaymentAmount) > 0) {
        const paymentRef = doc(collection(db, 'subscriptionPayments'));
        await setDoc(paymentRef, {
          id: paymentRef.id,
          clinicId: assignModal.clinicId,
          clinicName: assignModal.name || assignModal.email,
          email: assignModal.email,
          amount: Number(assignPaymentAmount),
          paymentMethod: assignPaymentMethod,
          transactionId: assignUpiRef || '',
          planName: `${plan.name} (${assignCycle === 'monthly' ? 'Monthly' : 'Yearly'})`,
          paidAt: new Date(assignPaymentDate).toISOString(),
          recordedBy: userData?.email || 'admin',
          cycle: assignCycle
        });
      }

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
      
      {/* Header Section */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Shield size={28} color="var(--primary)" />
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Admin Control Center</h1>
        </div>
        <p style={{ color: 'var(--on-surface-variant)', fontWeight: 500, fontSize: '0.95rem' }}>
          Manage global platform settings, subscription plans, and monitor system-wide activity.
        </p>
      </div>

      {/* Stats Summary Section */}
      <div className="grid grid-4 gap-6 mb-10">
        <StatCard 
          icon={<Users size={24} />} 
          color="#0ea5e9" 
          bg="rgba(14, 165, 233, 0.1)" 
          label="Total Users" 
          value={stats.length} 
        />
        <StatCard 
          icon={<CheckCircle size={24} />} 
          color="#10b981" 
          bg="rgba(16, 185, 129, 0.1)" 
          label="Active Clinics" 
          value={stats.filter(s => s.subStatus === 'active' || s.subStatus === 'trial').length} 
        />
        <StatCard 
          icon={<AlertTriangle size={24} />} 
          color="#f59e0b" 
          bg="rgba(245, 158, 11, 0.1)" 
          label="Expiring Soon" 
          value={stats.filter(s => {
            if (!s.subEndDate) return false;
            const days = Math.ceil((new Date(s.subEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return days !== null && days >= 0 && days <= 7 && s.subStatus !== 'expired';
          }).length} 
        />
        <StatCard 
          icon={<Lock size={24} />} 
          color="#ef4444" 
          bg="rgba(239, 68, 68, 0.1)" 
          label="Expired/Locked" 
          value={stats.filter(s => s.subStatus === 'expired' || s.subStatus === 'locked').length} 
        />
      </div>

      {/* Tab Navigation - Pill Style */}
      <div style={{ 
        display: 'flex',
        flexWrap: 'wrap', 
        padding: '0.4rem', 
        background: 'rgba(0,0,0,0.03)', 
        borderRadius: '1.25rem', 
        marginBottom: '2.5rem',
        gap: '0.25rem'
      }}>
        <TabItem icon={<Users size={18} />} label={`Users (${stats.length})`} active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        <TabItem icon={<AlertTriangle size={18} />} label="Expiring Soon" active={activeTab === 'expiring'} onClick={() => setActiveTab('expiring')} />
        <TabItem icon={<CalendarDays size={18} />} label="Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
        <TabItem icon={<MessageCircle size={18} />} label="Broadcasts" active={activeTab === 'broadcasts'} onClick={() => setActiveTab('broadcasts')} />
        <TabItem icon={<CreditCard size={18} />} label="Payments" active={activeTab === 'payments'} onClick={() => setActiveTab('payments')} />
        <TabItem icon={<List size={18} />} label="Subscription Plans" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
        <TabItem icon={<History size={18} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <TabItem icon={<Headset size={18} />} label="Support" active={activeTab === 'support'} onClick={() => setActiveTab('support')} />
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
                  <th style={{ padding: '1.5rem', background: '#ffffff', color: 'var(--on-surface-variant)', fontSize: '0.8rem', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>USER INFO</th>
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
                        <td style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '0.75rem' }}>
                          <ChevronDown size={20} color="#cbd5e1" style={{ marginTop: '0.2rem' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--on-surface)', fontSize: '0.9rem' }}>{stat.name || 'Unknown User'}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>{stat.email}</span>
                            {stat.phone && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{stat.phone}</span>}
                          </div>
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
                            <button 
                              style={{ background: 'none', border: 'none', color: stat.isLocked ? '#10b981' : '#f59e0b', cursor: 'pointer', display: 'flex', padding: '0.3rem' }} 
                              title={stat.isLocked ? "Unlock User" : "Lock User"} 
                              onClick={() => handleToggleUserLock(stat.userId, stat.isLocked)}
                            >
                              {stat.isLocked ? <Unlock size={17} /> : <Lock size={17} />}
                            </button>
                            {(stat.subStatus === 'active' || stat.subStatus === 'trial' || stat.subStatus === 'manual') && (
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
                  <th style={thStyle}>USER INFO</th>
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
                        <td style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--on-surface)', fontSize: '0.9rem' }}>{s.name || 'Unknown User'}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>{s.email}</span>
                          {s.phone && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.phone}</span>}
                        </td>
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
        <div className="animate-slide-up" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(225,29,72,0.1))', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>Subscription Plans</h2>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Manage platform tiers and pricing options.</p>
            </div>
          </div>

          {/* Inline Create/Edit Form */}
          <div style={{ background: '#ffffff', padding: '1.5rem 2rem', marginBottom: '2rem', borderRadius: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingPlan ? <><Edit3 size={16} /> Edit Plan Details</> : <><Plus size={16} /> Create New Plan</>}
            </h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 250px', position: 'relative' }}>
                <input
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="Plan Name (e.g. Premium)"
                  style={{ width: '100%', padding: '1rem 1.5rem', borderRadius: '1rem', border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--on-surface)', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                />
              </div>
              <div style={{ flex: '0 1 180px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 700 }}>₹</div>
                <input
                  value={planPrice}
                  onChange={e => setPlanPrice(e.target.value)}
                  placeholder="0"
                  type="number"
                  style={{ width: '100%', padding: '1rem 1.5rem 1rem 2.5rem', borderRadius: '1rem', border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--on-surface)', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                />
              </div>
              <div style={{ flex: '0 1 150px', position: 'relative' }}>
                <input
                  value={planDuration}
                  onChange={e => setPlanDuration(e.target.value)}
                  placeholder="Days"
                  type="number"
                  style={{ width: '100%', padding: '1rem 1.5rem', borderRadius: '1rem', border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--on-surface)', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                />
              </div>
              <button
                onClick={handleCreateOrUpdatePlan}
                disabled={!planName.trim() || !planPrice}
                style={{
                  padding: '1rem 2rem', borderRadius: '1rem', border: 'none',
                  background: editingPlan ? 'var(--primary)' : '#e11d48',
                  color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (!planName.trim() || !planPrice) ? 0.5 : 1,
                  transition: 'all 0.2s', boxShadow: editingPlan ? '0 8px 20px rgba(0,97,163,0.2)' : '0 8px 20px rgba(225,29,72,0.2)'
                }}
              >
                {editingPlan ? <><CheckCircle size={18} /> Update Plan</> : <><Plus size={18} strokeWidth={3} /> Create</>}
              </button>
              {editingPlan && (
                <button
                  onClick={cancelEdit}
                  style={{ padding: '1rem 1.5rem', borderRadius: '1rem', border: 'none', background: '#f1f5f9', color: '#475569', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Plans List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {plans.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '1.5rem', color: '#94a3b8' }}>
                <Crown size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)' }}>No Plans Yet</h3>
                <p>Create your first subscription plan above.</p>
              </div>
            ) : (
              plans.map(plan => {
                const dur = plan.duration || 30;
                return (
                  <div key={plan.id} style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden', border: plan.isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.05)' }}>
                    {!plan.isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.6)', zIndex: 1, pointerEvents: 'none' }} />}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                      <div>
                        <span style={{ 
                          display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '2rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
                          background: plan.isActive ? '#d1fae5' : '#fee2e2', color: plan.isActive ? '#059669' : '#dc2626'
                        }}>
                          {plan.isActive ? 'Active Plan' : 'Inactive'}
                        </span>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>{plan.name}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => startEditPlan(plan)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s', zIndex: 2 }} title="Edit"><Edit3 size={16} /></button>
                        <button onClick={() => handleDeletePlan(plan.id)} style={{ background: '#fee2e2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s', zIndex: 2 }} title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>₹{plan.monthlyPrice.toLocaleString()}</span>
                      <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>/ {dur} days</span>
                    </div>

                    <div style={{ paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', zIndex: 2, position: 'relative' }}>
                      <button
                        onClick={() => handleTogglePlanActive(plan)}
                        style={{ width: '100%', padding: '0.85rem', borderRadius: '1rem', border: 'none', background: plan.isActive ? '#f1f5f9' : '#10b981', color: plan.isActive ? '#64748b' : '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        {plan.isActive ? 'Deactivate Plan' : 'Activate Plan'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: HISTORY
         ═══════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease' }}>
          {/* Header & Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.1))', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <History size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Subscription History</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Audit log of all billing and plan changes.</p>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                placeholder="Search by email..."
                style={{ 
                  padding: '1rem 1.5rem 1rem 3rem', borderRadius: '2rem', border: 'none', background: '#ffffff', 
                  fontSize: '0.95rem', fontWeight: 600, color: 'var(--on-surface)', outline: 'none', width: '320px', 
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)', transition: 'all 0.2s' 
                }}
              />
            </div>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: 0, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Date & Time</th>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Clinic Email</th>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Action</th>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Plan Details</th>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Amount</th>
                    <th style={{ padding: '1.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>Performed By</th>
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
                          <td colSpan={6} style={{ textAlign: 'center', padding: '5rem 2rem', color: '#94a3b8' }}>
                            <History size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--on-surface)' }}>No Records Found</h3>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>{historyFilter ? 'Try a different search term.' : 'Your audit log is currently empty.'}</p>
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map((h, idx) => {
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
                      const isLast = idx === filtered.length - 1;
                      
                      return (
                        <tr key={h.id} style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.03)', transition: 'background 0.2s', cursor: 'default' }} className="hover:bg-slate-50">
                          <td style={{ padding: '1.25rem 1.5rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 800, color: 'var(--on-surface)', fontSize: '0.9rem' }}>
                              {new Date(h.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.2rem' }}>
                              {new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--on-surface)', fontSize: '0.9rem' }}>
                            {h.email}
                            {h.note && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: '0.25rem', maxWidth: '200px', whiteSpace: 'normal', lineHeight: 1.4 }}>{h.note}</div>}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <span style={{
                              background: ac.bg, color: ac.text,
                              padding: '0.4rem 0.8rem', borderRadius: '2rem',
                              fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap'
                            }}>
                              {h.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
                            {h.planName || '—'}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            {h.amount ? (
                              <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
                                ₹{h.amount.toLocaleString()}
                                {h.cycle && <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginLeft: '0.2rem' }}>/{h.cycle === 'monthly' ? 'mo' : 'yr'}</span>}
                              </div>
                            ) : <span style={{ color: '#cbd5e1', fontWeight: 600 }}>—</span>}
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
                            {h.performedBy?.split('@')[0] || 'System Automated'}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: SUPPORT
         ═══════════════════════════════════ */}
      {activeTab === 'support' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.1))', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Headset size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Support Tickets</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Manage and resolve issues reported by clinic owners.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ background: '#ffffff', border: '1px solid rgba(16,185,129,0.2)', color: '#059669', padding: '0.75rem 1.25rem', borderRadius: '1rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <CheckCircle size={18} /> {tickets.filter(t => t.status === 'resolved').length} Resolved
              </div>
              <div style={{ background: '#ffffff', border: '1px solid rgba(239,68,68,0.2)', color: '#dc2626', padding: '0.75rem 1.25rem', borderRadius: '1rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <AlertTriangle size={18} /> {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length} Active
              </div>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 2rem', background: '#fff', borderRadius: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.02)' }}>
              <Headset size={64} color="#e2e8f0" style={{ marginBottom: '1.5rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--on-surface)' }}>Inbox Zero 🎉</h3>
              <p style={{ color: '#64748b', marginTop: '0.5rem' }}>No support tickets have been submitted yet. Everything is running smoothly!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tickets.map((ticket) => (
                <div key={ticket.id} style={{ background: '#ffffff', borderRadius: '1.25rem', padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '250px 1fr auto', gap: '2rem', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: ticket.status === 'resolved' ? '1px solid transparent' : '1px solid rgba(139,92,246,0.1)', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                  {ticket.status !== 'resolved' && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'linear-gradient(to bottom, #8b5cf6, #6366f1)' }} />}
                  
                  {/* Column 1: Info */}
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--on-surface)', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                      {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{ticket.clinicName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600, marginTop: '0.2rem' }}>{ticket.userEmail}</div>
                  </div>

                  {/* Column 2: Subject & Description */}
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 0.5rem 0' }}>{ticket.subject}</h4>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
                  </div>

                  {/* Column 3: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={ticket.status} 
                        onChange={(e) => handleUpdateTicketStatus(ticket.id, e.target.value as 'open' | 'in_progress' | 'resolved')}
                        style={{
                          padding: '0.6rem 2.5rem 0.6rem 1.25rem', borderRadius: '2rem', border: 'none',
                          fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', appearance: 'none',
                          background: ticket.status === 'resolved' ? '#d1fae5' : ticket.status === 'in_progress' ? '#fef3c7' : '#fee2e2',
                          color: ticket.status === 'resolved' ? '#059669' : ticket.status === 'in_progress' ? '#d97706' : '#dc2626',
                          textTransform: 'uppercase', letterSpacing: '0.05em', outline: 'none'
                        }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <ChevronDown size={14} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: ticket.status === 'resolved' ? '#059669' : ticket.status === 'in_progress' ? '#d97706' : '#dc2626' }} />
                    </div>

                    {ticket.status !== 'resolved' && (
                      <button 
                        onClick={() => handleResolveTicket(ticket.id)}
                        disabled={resolvingId === ticket.id}
                        style={{ 
                          background: '#fff', border: '1px solid #e2e8f0', color: '#059669', 
                          padding: '0.5rem 1.25rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', transition: 'all 0.2s',
                          opacity: resolvingId === ticket.id ? 0.6 : 1
                        }}
                      >
                        {resolvingId === ticket.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: SETTINGS
         ═══════════════════════════════════ */}
      {activeTab === 'settings' && (
        <div className="animate-slide-up" style={{ maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(56,189,248,0.1))', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={28} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Platform Configuration</h2>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Manage global rules and contact information for all clinics.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {/* Free Trial Toggle Card */}
            <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <Zap size={24} />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.5rem', margin: 0 }}>Growth Engine</h3>
                <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '2rem' }}>
                  Enable automatic free trials for all new users. This helps increase signup conversion rates and allows clinics to test features.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: trialEnabled ? '#059669' : '#94a3b8' }}>
                  {trialEnabled ? 'Active (7 Days)' : 'Disabled'}
                </span>
                <button
                  onClick={() => setTrialEnabled(!trialEnabled)}
                  style={{
                    width: '64px', height: '34px', borderRadius: '17px', border: 'none', cursor: 'pointer',
                    background: trialEnabled ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'rgba(148, 163, 184, 0.2)',
                    position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0,
                    boxShadow: trialEnabled ? '0 4px 15px rgba(14, 165, 233, 0.3)' : 'none'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '4px', left: trialEnabled ? '34px' : '4px',
                    width: '26px', height: '26px', borderRadius: '50%', background: 'white',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            </div>

            {/* Admin Info Card */}
            <div style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderRadius: '1.5rem', padding: '2.5rem', border: '1px solid rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <MessageCircle size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--on-surface)', margin: '0 0 0.5rem 0' }}>Admin WhatsApp</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                This is the primary contact method displayed to clinics when they need support or their subscription is expiring.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: '#fff', padding: '1rem 1.5rem', borderRadius: '1rem', color: '#10b981', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <Phone size={18} />
                <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.02em' }}>{waPhone || 'Not Configured'}</span>
              </div>
            </div>
          </div>

          {/* Form Configuration Area */}
          <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '1.5rem' }}>Communication Settings</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Support Contact Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    value={waPhone}
                    onChange={e => setWaPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    style={{
                      width: '100%', padding: '1rem 1.25rem 1rem 3rem', borderRadius: '1rem', border: 'none',
                      background: 'var(--surface-container-lowest)', fontSize: '1rem', fontWeight: 600,
                      color: 'var(--on-surface)', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Renewal Template Message</label>
                <textarea
                  value={waMessage}
                  onChange={e => setWaMessage(e.target.value)}
                  rows={2}
                  placeholder="Hi, I would like to renew my SmileSync subscription."
                  style={{
                    width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: 'none',
                    background: 'var(--surface-container-lowest)', fontSize: '0.95rem', fontWeight: 500,
                    color: 'var(--on-surface)', outline: 'none', transition: 'all 0.2s',
                    minHeight: '48px', resize: 'vertical', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', lineHeight: 1.5
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <div>
                {settingsMsg && (
                  <div style={{
                    color: settingsMsg.type === 'success' ? '#059669' : '#dc2626', background: settingsMsg.type === 'success' ? '#d1fae5' : '#fee2e2',
                    padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', animation: 'fadeIn 0.3s ease'
                  }}>
                    {settingsMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {settingsMsg.text}
                  </div>
                )}
              </div>
              <button
                onClick={handleSavePlatformSettings}
                disabled={settingsSaving}
                style={{ 
                  padding: '1rem 2.5rem', borderRadius: '2rem', border: 'none', background: '#10b981', color: 'white',
                  fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s'
                }}
              >
                {settingsSaving ? <><Loader2 size={18} className="animate-spin" /> Syncing...</> : <><CheckCircle size={18} /> Update Settings</>}
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ═══════════════════════════════════
          MODAL: Assign Plan to User
         ═══════════════════════════════════ */}
      {/* ═══════════════════════════════════
          TAB: BROADCASTS
         ═══════════════════════════════════ */}
      {activeTab === 'broadcasts' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Broadcast Announcements</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Send in-app notifications to selected groups.</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
            {/* Composer */}
            <div className="card" style={{ padding: '2.5rem', borderRadius: '1.5rem', background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                  <MessageCircle size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Compose Message</h3>
              </div>
              
              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Target Audience
                </label>
                <div style={{ position: 'relative' }}>
                  <select 
                    value={broadcastAudience} 
                    onChange={e => setBroadcastAudience(e.target.value)}
                    style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: 'var(--on-surface)', backgroundColor: '#f8fafc', outline: 'none', appearance: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <option value="All">All Users</option>
                    <option value="Active">Active Subscription</option>
                    <option value="Trial">Trial Users</option>
                    <option value="Expiring">Expiring Soon (≤ 7 days)</option>
                    <option value="Expired">Expired Users</option>
                  </select>
                  <div style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Users size={14} /> This will send an in-app notification to the selected clinics.
                </div>
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Notification Title
                </label>
                <input 
                  type="text" 
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. System Maintenance on Sunday"
                  style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: 'var(--on-surface)', backgroundColor: '#f8fafc', outline: 'none', fontWeight: 500 }}
                />
              </div>

              <div style={{ marginBottom: '2.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Message Content
                </label>
                <textarea 
                  value={broadcastMessage}
                  onChange={e => setBroadcastMessage(e.target.value)}
                  placeholder="Write your announcement here..."
                  rows={6}
                  style={{ width: '100%', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #e2e8f0', fontSize: '0.95rem', color: 'var(--on-surface)', backgroundColor: '#f8fafc', outline: 'none', resize: 'vertical', lineHeight: '1.6' }}
                />
              </div>

              <button 
                onClick={handleSendBroadcast}
                disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                style={{ 
                  width: '100%', padding: '1.1rem', borderRadius: '1rem', border: 'none', 
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white',
                  fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  opacity: (sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()) ? 0.6 : 1,
                  boxShadow: '0 8px 20px rgba(99,102,241,0.25)', transition: 'all 0.2s'
                }}
              >
                {sendingBroadcast ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send Broadcast
              </button>
            </div>

            {/* History */}
            <div className="card" style={{ padding: '2rem', borderRadius: '1.5rem', background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', maxHeight: '700px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Past Broadcasts</h3>
                <div style={{ padding: '0.3rem 0.75rem', background: '#f1f5f9', color: '#64748b', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {broadcastHistory.length} Sent
                </div>
              </div>

              {broadcastHistory.length === 0 ? (
                <div style={{ padding: '4rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                    <MessageCircle size={24} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>No broadcasts sent yet.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {broadcastHistory.map(b => (
                    <div key={b.id} style={{ 
                      padding: '1.25rem', borderRadius: '1rem', background: '#f8fafc', 
                      border: '1px solid #f1f5f9', borderLeft: '4px solid #6366f1',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          To: {b.targetGroup} ({b.recipientCount})
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>
                          {new Date(b.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--on-surface)', marginBottom: '0.5rem', wordBreak: 'break-word' }}>
                        {b.title}
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5',
                        wordBreak: 'break-word', overflowWrap: 'anywhere'
                      }}>
                        {b.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: PAYMENTS
         ═══════════════════════════════════ */}
      {activeTab === 'payments' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(16,185,129,0.1))', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Payment Records</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Proofs of payment (UPI/Cash) linked to subscriptions.</p>
              </div>
            </div>
            <div style={{ background: '#f0fdf4', color: '#059669', padding: '0.75rem 1.5rem', borderRadius: '1rem', fontWeight: 800, fontSize: '1.1rem' }}>
              Total: ₹{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
            </div>
          </div>

          <div className="table-wrapper card" style={{ padding: 0, borderRadius: '1.5rem' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>DATE</th>
                  <th style={thStyle}>CLINIC / USER</th>
                  <th style={thStyle}>PLAN</th>
                  <th style={thStyle}>AMOUNT</th>
                  <th style={thStyle}>METHOD & REF</th>
                  <th style={thStyle}>RECORDED BY</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No payment records found.</td></tr>
                ) : (
                  payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>
                        {new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--on-surface)' }}>{p.clinicName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.email}</div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>
                        {p.planName}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
                        ₹{p.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                          {p.paymentMethod}
                        </div>
                        {p.transactionId ? (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem', fontFamily: 'monospace' }}>{p.transactionId}</div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.3rem', fontStyle: 'italic' }}>No Reference</div>
                        )}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                        {p.recordedBy.split('@')[0]}
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeletePayment(p.id)}
                          style={{
                            background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.5rem', borderRadius: '0.5rem',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Delete Payment Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          TAB: CALENDAR
         ═══════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(219,39,119,0.1))', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays size={28} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', margin: 0 }}>Subscription Calendar</h2>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', margin: '0.2rem 0 0 0' }}>Track upcoming renewals and expirations visually.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                Previous
              </button>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, minWidth: '150px', textAlign: 'center' }}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <button 
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                Next
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', borderRadius: '1.5rem', background: '#fff', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} style={{ textAlign: 'center', fontWeight: 800, color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>{day}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem' }}>
              {(() => {
                const year = calendarMonth.getFullYear();
                const month = calendarMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];
                
                // Empty cells before 1st
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} style={{ minHeight: '100px', background: '#f8fafc', borderRadius: '1rem', opacity: 0.5 }} />);
                }
                
                // Days
                for (let i = 1; i <= daysInMonth; i++) {
                  const currentDateStr = new Date(year, month, i).toISOString().split('T')[0];
                  
                  // Find clinics expiring on this day
                  const expiringClinics = stats.filter(s => {
                    if (!s.subEndDate || s.subEndDate === '-') return false;
                    try {
                      return s.subEndDate.split('T')[0] === currentDateStr;
                    } catch { return false; }
                  });

                  const isToday = new Date().toISOString().split('T')[0] === currentDateStr;

                  cells.push(
                    <div key={i} style={{ 
                      minHeight: '120px', padding: '0.75rem', borderRadius: '1rem', 
                      background: isToday ? '#fff0f6' : '#ffffff', 
                      border: isToday ? '2px solid #fbcfe8' : '1px solid #f1f5f9',
                      display: 'flex', flexDirection: 'column'
                    }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isToday ? '#db2777' : '#64748b', marginBottom: '0.5rem' }}>{i}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, overflowY: 'auto' }}>
                        {expiringClinics.map(s => (
                          <div key={s.clinicId} style={{ 
                            padding: '0.3rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                            background: s.subStatus === 'expired' ? '#fee2e2' : '#fef3c7',
                            color: s.subStatus === 'expired' ? '#dc2626' : '#d97706',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }} title={s.name || s.clinicName}>
                            {s.name || s.clinicName}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>
        </div>
      )}


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

                <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CreditCard size={16} color="#059669" /> Payment Proof <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>(Optional)</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setAssignPaymentMethod('upi')}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: assignPaymentMethod === 'upi' ? '2px solid #059669' : '1px solid #e2e8f0',
                          background: assignPaymentMethod === 'upi' ? '#f0fdf4' : '#fff', color: assignPaymentMethod === 'upi' ? '#059669' : '#64748b',
                          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        UPI
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignPaymentMethod('cash')}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: assignPaymentMethod === 'cash' ? '2px solid #059669' : '1px solid #e2e8f0',
                          background: assignPaymentMethod === 'cash' ? '#f0fdf4' : '#fff', color: assignPaymentMethod === 'cash' ? '#059669' : '#64748b',
                          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        Cash
                      </button>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Amount Paid (₹)</label>
                      <input 
                        type="number" 
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                        value={assignPaymentAmount}
                        onChange={e => setAssignPaymentAmount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Date</label>
                      <input 
                        type="date" 
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                        value={assignPaymentDate}
                        onChange={e => setAssignPaymentDate(e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>
                        {assignPaymentMethod === 'upi' ? 'UPI Reference ID' : 'Receipt Number or Note'} <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(Optional)</span>
                      </label>
                      <input 
                        type="text" 
                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.9rem' }}
                        value={assignUpiRef}
                        onChange={e => setAssignUpiRef(e.target.value)}
                        placeholder={assignPaymentMethod === 'upi' ? "e.g. UPI1234567890" : "e.g. Cash Receipt #123"}
                      />
                    </div>
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
        display: 'flex', alignItems: 'center', gap: '0.65rem', 
        background: active ? '#ffffff' : 'transparent', 
        border: 'none', cursor: 'pointer',
        color: active ? 'var(--primary)' : '#64748b',
        fontWeight: active ? 700 : 600,
        fontSize: '0.88rem',
        padding: '0.75rem 1.5rem', 
        borderRadius: '1rem',
        boxShadow: active ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ opacity: active ? 1 : 0.7 }}>{icon}</span>
      {label}
    </button>
  );
}
