'use client';

import React, { useEffect, useState } from 'react';
import { useStore } from '@/store';
import { collection, getDocs, doc, deleteDoc, getCountFromServer, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { UserData, Clinic } from '@/types';
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
  Ban, 
  Trash2 
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

  useEffect(() => {
    if (isLoading) return;
    if (!userData?.isSuperAdmin && userData?.email !== 'sudhanshu18k@gmail.com') {
      router.push('/dashboard');
      return;
    }
    fetchAdminData();
  }, [userData, isLoading, router]);

  const fetchAdminData = async () => {
    setLoadingData(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedStats: AdminStats[] = [];

      for (const userDoc of usersSnap.docs) {
        const uData = userDoc.data() as UserData;
        if (!uData.clinics || uData.clinics.length === 0) continue;

        for (const clinicRef of uData.clinics) {
          if (clinicRef.role !== 'owner') continue;

          let pCount = 0; let aCount = 0;
          let subStatus = 'active'; let subPlan = 'Pro Plan'; let subEndDate = '1/1/2030';

          try {
            const clinicSnap = await getDoc(doc(db, 'clinics', clinicRef.clinicId));
            if (clinicSnap.exists()) {
              const cData = clinicSnap.data() as Clinic;
              subStatus = cData.subscriptionStatus || 'active';
              subPlan = cData.subscriptionPlan || 'manual';
              subEndDate = cData.subscriptionEndDate || '-';
            }
          } catch (e) { console.error("Error fetching clinic metadata", e); }

          try {
            const pSnap = await getCountFromServer(collection(db, 'clinics', clinicRef.clinicId, 'patients'));
            const aSnap = await getCountFromServer(collection(db, 'clinics', clinicRef.clinicId, 'appointments'));
            pCount = pSnap.data().count;
            aCount = aSnap.data().count;
          } catch {
            console.error("Failed to fetch counts for clinic", clinicRef.clinicId);
          }

          fetchedStats.push({
            userId: uData.id,
            email: uData.email,
            isSuperAdmin: !!uData.isSuperAdmin || uData.email === 'sudhanshu18k@gmail.com',
            clinicId: clinicRef.clinicId,
            clinicName: clinicRef.name,
            patientCount: pCount,
            appointmentCount: aCount,
            subStatus,
            subPlan,
            subEndDate
          });
        }
      }
      setStats(fetchedStats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoadingData(false);
    }
  };

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
              filteredStats.map((stat, idx) => (
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
                  <td style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ background: ['active', 'manual'].includes(stat.subStatus) ? '#d1fae5' : '#fee2e2', color: ['active', 'manual'].includes(stat.subStatus) ? '#059669' : '#b91c1c', padding: '0.15rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', width: 'fit-content' }}>
                      {stat.subStatus}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{stat.subPlan}</span>
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Until {stat.subEndDate}</span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                      <select style={{ padding: '0.4rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 600, color: '#475569', outline: 'none' }}>
                        <option>Plan...</option>
                        <option>Active</option>
                        <option>Expired</option>
                      </select>
                      <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }} title="Ban User" onClick={() => handleDeleteUserClinic(stat.userId, stat.clinicId)}>
                        <Ban size={18} />
                      </button>
                      <button style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex' }} title="Lock Account">
                        <Lock size={18} />
                      </button>
                      <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }} title="Delete Account" onClick={() => handleDeleteUserClinic(stat.userId, stat.clinicId)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// Subcomponents for the UI

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
